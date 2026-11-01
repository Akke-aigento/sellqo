-- RAPPORT-HORECA-1 — analyse van de kassa over een periode, voor Rapporten › Horeca in beheer.
--
-- Eén functie, enkel lezen. Definities (één bron per getal):
--   omzet      = pos_transactions met status 'completed' en zonder order_id, som van total
--                (zelfde regel als de cockpit, src/lib/cockpitRevenue.ts toSales: kassaticket dat
--                aan een order hangt, zit al in de order). Een tafel- of toogbetaling (horeca_pay)
--                heeft nooit een order_id, dus voor horeca is dit ook het Z-totaal.
--   rekening   = een afgerekende rekening (check_payments) van zo'n ticket; couverts = dining_checks.guests.
--   productmix = de verstuurde lijnen (check_lines.state = 'sent') van afgerekende rekeningen,
--                bedrag via horeca_line_total (zoals het Z-rapport), plus de artikels van tickets
--                op de klassieke kassa (pos_transactions.items).
--   per uur    = Brusselse klok van het ticket.
--   periode    = bedrijfsdagen (p_from_day t/m p_to_day), met de afkapuur van de zaak zoals de Z
--                (kassa_day_start). Zo is het periodetotaal gelijk aan de som van de Z-rapporten.
--   fooi       = check_payments.tip_cents (zoals het Z-rapport), per medewerker.
-- Bedragen in centen.
--
-- Additief (één nieuwe functie). Idempotent. Handmatig terugdraaien:
--   drop function if exists public.horeca_analysis(uuid, date, date);

create or replace function public.horeca_analysis(p_tenant_id uuid, p_from_day date, p_to_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v jsonb;
  v_from timestamptz;
  v_to timestamptz;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'accountant']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if p_from_day is null or p_to_day is null or p_to_day < p_from_day or p_to_day - p_from_day > 400 then
    raise exception 'periode ongeldig (max. 400 dagen)' using errcode = '22023';
  end if;
  v_from := public.kassa_day_start(p_tenant_id, p_from_day);
  v_to := public.kassa_day_start(p_tenant_id, p_to_day + 1);
  with done as (
    select t.id, t.created_at, round(t.total * 100)::bigint as cents, t.pos_cashier_id, t.items
    from public.pos_transactions t
    where t.tenant_id = p_tenant_id and t.status = 'completed' and t.order_id is null
      and t.created_at >= v_from and t.created_at < v_to
  ), cp as (
    select cp.*, d.cents as tx_cents from public.check_payments cp join done d on d.id = cp.pos_transaction_id
  ), checks as (
    select cp.check_id, cp.tx_cents, c.guests from cp join public.dining_checks c on c.id = cp.check_id
  ), mix as (
    select coalesce(x.product_id::text, 'name:' || x.name) as k, max(x.name) as name, sum(x.qty)::bigint as qty,
           sum(public.horeca_line_total(x))::bigint as cents
    from cp join public.check_lines x on x.check_id = cp.check_id and x.state = 'sent'
    group by 1
    union all
    select coalesce(nullif(i ->> 'product_id', ''), 'name:' || coalesce(i ->> 'name', '?')), max(coalesce(i ->> 'name', '?')),
           sum(coalesce((i ->> 'quantity')::numeric, 0))::bigint, round(sum(coalesce((i ->> 'total')::numeric, 0)) * 100)::bigint
    from done d cross join lateral jsonb_array_elements(case when jsonb_typeof(d.items) = 'array' then d.items else '[]'::jsonb end) i
    where not exists (select 1 from cp where cp.pos_transaction_id = d.id)
    group by 1
  ), mix2 as (
    select k, max(name) as name, sum(qty)::bigint as qty, sum(cents)::bigint as cents from mix group by k
  ), staff as (
    select coalesce(cp.staff_id, d.pos_cashier_id) as staff_id, count(*) as cnt, sum(d.cents)::bigint as cents,
           coalesce(sum(cp.tip_cents), 0)::bigint as tips
    from done d left join cp on cp.pos_transaction_id = d.id
    group by 1
  ), hours as (
    select extract(hour from d.created_at at time zone 'Europe/Brussels')::int as h, count(*) as cnt, sum(d.cents)::bigint as cents
    from done d group by 1
  ), days as (
    select public.kassa_business_day(p_tenant_id, d.created_at) as day, count(*) as cnt, sum(d.cents)::bigint as cents
    from done d group by 1
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to, 'from_day', p_from_day, 'to_day', p_to_day,
    'totals', jsonb_build_object(
      'revenue_cents', coalesce((select sum(cents) from done), 0),
      'tickets', (select count(*) from done),
      'checks', (select count(*) from checks),
      'checks_revenue_cents', coalesce((select sum(tx_cents) from checks), 0),
      'guests', coalesce((select sum(guests) from checks where guests > 0), 0),
      'guests_revenue_cents', coalesce((select sum(tx_cents) from checks where guests > 0), 0),
      'tips_cents', coalesce((select sum(tip_cents) from cp), 0)
    ),
    'products', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'name', name, 'qty', qty, 'cents', cents) order by cents desc, qty desc, name)
                          from (select * from mix2 order by cents desc, qty desc, name limit 200) m), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(jsonb_build_object('hour', h, 'count', cnt, 'cents', cents) order by h) from hours), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'count', cnt, 'cents', cents) order by day) from days), '[]'::jsonb),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('staff_id', s.staff_id, 'name', pc.display_name, 'count', s.cnt,
                                                          'cents', s.cents, 'tips_cents', s.tips) order by s.cents desc)
                       from staff s left join public.pos_cashiers pc on pc.id = s.staff_id), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
revoke all on function public.horeca_analysis(uuid, date, date) from public, anon;
grant execute on function public.horeca_analysis(uuid, date, date) to authenticated;
