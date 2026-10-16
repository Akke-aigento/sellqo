-- FONSKE-READY-1 — 16 oktober 2026
-- Drie fouten uit de nachtelijke e2e-test van de ticketketen (Speeltuin):
--   1. Een geannuleerde of terugbetaalde order liet zijn tickets geldig: ze scanden nog
--      en hielden een plaats bezet.
--   2. generate_order_number deed MAX+1 zonder lock: twee gelijktijdige checkouts bij
--      dezelfde tenant gaven een 500 op orders_tenant_id_order_number_key.
--   3. Overboeking ná betaling (verloren race) werd alleen in admin_actions_log gezet;
--      niemand zag dat een klant betaald had zonder ticket.
--
-- Idempotent: twee keer draaien geeft hetzelfde resultaat.
--
-- Handmatig terugdraaien:
--   drop trigger if exists trg_orders_cancel_tickets on public.orders;
--   drop function if exists public.trg_orders_cancel_tickets();
--   generate_order_number en issue_tickets_for_order_core: de vorige definities staan
--   in ops.fonske_ready_1_prev_functions (snapshot vóór deze migratie).
--   drop table if exists public.order_number_counters;  (pas nadat generate_order_number terug is)

-- ── 0. Snapshot van de oude functiedefinities ─────────────────────────────────
create schema if not exists ops;
create table if not exists ops.fonske_ready_1_prev_functions (
  proname text primary key,
  definition text not null,
  saved_at timestamptz not null default now()
);
insert into ops.fonske_ready_1_prev_functions (proname, definition)
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('generate_order_number', 'issue_tickets_for_order_core')
on conflict (proname) do nothing;

-- ── 1. Atomaire ordernummers ──────────────────────────────────────────────────
-- Eén rij per tenant; de UPSERT neemt een rijlock, dus gelijktijdige aanroepen
-- krijgen elk een eigen nummer, ook als ze in aparte transacties zitten.
-- GREATEST houdt rekening met nummers die buiten deze functie om in orders kwamen.
create table if not exists public.order_number_counters (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  last_number integer not null,
  updated_at timestamptz not null default now()
);
alter table public.order_number_counters enable row level security;
-- Geen policies: alleen de SECURITY DEFINER-functie hieronder leest en schrijft.
revoke all on public.order_number_counters from anon, authenticated;

create or replace function public.generate_order_number(_tenant_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_max integer;
  next_number integer;
begin
  if auth.uid() is not null and not (public.is_platform_admin(auth.uid())
      or _tenant_id in (select public.get_user_tenant_ids(auth.uid()))) then
    raise exception 'Geen toegang tot deze tenant' using errcode = '42501';
  end if;

  select coalesce(max(cast(substring(order_number from 2) as integer)), 0)
    into v_max
  from public.orders
  where tenant_id = _tenant_id;

  insert into public.order_number_counters as c (tenant_id, last_number)
  values (_tenant_id, v_max + 1)
  on conflict (tenant_id) do update
    set last_number = greatest(c.last_number, excluded.last_number - 1) + 1,
        updated_at = now()
  returning c.last_number into next_number;

  return '#' || lpad(next_number::text, 4, '0');
end;
$function$;

-- ── 2. Annuleren of volledig terugbetalen neemt de tickets mee ───────────────
-- Alleen tickets met status 'valid'. Wie al binnen is (checked_in) blijft zo.
-- Gedeeltelijke terugbetaling (partially_refunded) raakt niets: welke tickets
-- vervallen is dan een keuze van de organisator.
-- Wordt een order later teruggezet, dan worden tickets NIET automatisch heropend.
create or replace function public.trg_orders_cancel_tickets()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_new_status text;
begin
  begin
    v_new_status := case when new.payment_status::text = 'refunded' then 'refunded' else 'cancelled' end;
    update public.ticket_instances
       set status = v_new_status
     where order_id = new.id
       and status = 'valid';
  exception when others then
    raise warning 'trg_orders_cancel_tickets failed for order %: %', new.id, sqlerrm;
  end;
  return null;
end;
$function$;

drop trigger if exists trg_orders_cancel_tickets on public.orders;
create trigger trg_orders_cancel_tickets
  after update of status, payment_status on public.orders
  for each row
  when (
    (new.status::text = 'cancelled' and old.status is distinct from new.status)
    or (new.payment_status::text = 'refunded' and old.payment_status is distinct from new.payment_status)
  )
  execute function public.trg_orders_cancel_tickets();

-- ── 3. Overboeking na betaling: dringende melding aan de winkel ──────────────
-- Identiek aan de vorige definitie, plus order_number in de select en een
-- send_notification (category 'orders', priority 'urgent') naast de bestaande log.
create or replace function public.issue_tickets_for_order_core(p_order_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_order RECORD;
  v_item RECORD;
  i int;
  v_cap jsonb;
  v_already int;
  v_needed int;
  v_admin uuid;
BEGIN
  SELECT id, tenant_id, order_number, payment_status, customer_name, customer_email, total
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND OR v_order.payment_status <> 'paid' THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT id, event_detail_id, product_id, COALESCE(quantity, 0) AS quantity
    FROM public.order_items
    WHERE order_id = p_order_id
      AND event_detail_id IS NOT NULL
  LOOP
    -- Race-safe: serialiseer alle issuance voor dit event binnen deze transactie.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.event_detail_id::text, 0));

    -- Idempotentie: al uitgegeven tickets voor dit order_item niet dubbel tellen.
    SELECT COUNT(*)::int INTO v_already
    FROM public.ticket_instances
    WHERE order_item_id = v_item.id;

    v_needed := v_item.quantity - v_already;
    IF v_needed <= 0 THEN
      CONTINUE;
    END IF;

    v_cap := public.check_event_capacity(v_item.event_detail_id, v_item.product_id, v_needed);

    IF NOT COALESCE((v_cap->>'ok')::boolean, false) THEN
      -- Verloren race ná betaling: geen tickets, glashelder loggen. Geen auto-refund.
      SELECT u.id INTO v_admin
      FROM auth.users u
      JOIN public.tenants t ON lower(t.owner_email) = lower(u.email)
      WHERE t.id = v_order.tenant_id
      LIMIT 1;

      IF v_admin IS NULL THEN
        SELECT ur.user_id INTO v_admin
        FROM public.user_roles ur
        WHERE ur.role = 'platform_admin'
        LIMIT 1;
      END IF;

      IF v_admin IS NOT NULL THEN
        INSERT INTO public.admin_actions_log (
          admin_user_id, target_tenant_id, action_type, action_details
        ) VALUES (
          v_admin, v_order.tenant_id, 'ticket_issuance_overbooking_prevented',
          jsonb_build_object(
            'order_id', v_order.id,
            'order_item_id', v_item.id,
            'event_detail_id', v_item.event_detail_id,
            'product_id', v_item.product_id,
            'quantity', v_needed,
            'reason', v_cap->>'reason',
            'paid_amount', v_order.total
          )
        );
      ELSE
        RAISE WARNING 'overbooking prevented but no admin user found (order %)', v_order.id;
      END IF;

      -- FONSKE-READY-1: de winkel moet dit zien, anders betaalt een klant voor niets.
      BEGIN
        PERFORM public.send_notification(
          v_order.tenant_id,
          'orders',
          'ticket_overbooking',
          'Betaald zonder ticket: ' || COALESCE(v_order.order_number, ''),
          'Bestelling ' || COALESCE(v_order.order_number, '') || ' is betaald, maar het event was intussen volzet. Er zijn '
            || v_needed || ' ticket(s) niet uitgegeven. Neem contact op met de klant en betaal terug of maak plaats vrij.',
          'urgent',
          '/admin/orders/' || v_order.id,
          jsonb_build_object(
            'order_id', v_order.id,
            'order_number', v_order.order_number,
            'event_detail_id', v_item.event_detail_id,
            'quantity', v_needed,
            'reason', v_cap->>'reason',
            'customer_email', v_order.customer_email
          )
        );
      EXCEPTION WHEN others THEN
        RAISE WARNING 'overbooking notification failed for order %: %', v_order.id, SQLERRM;
      END;

      CONTINUE;
    END IF;

    FOR i IN (v_already + 1)..v_item.quantity LOOP
      INSERT INTO public.ticket_instances (
        tenant_id, event_detail_id, product_id, order_id, order_item_id, seq,
        qr_token, status, attendee_name, attendee_email
      ) VALUES (
        v_order.tenant_id, v_item.event_detail_id, v_item.product_id, v_order.id, v_item.id, i,
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
        'valid',
        v_order.customer_name, v_order.customer_email
      )
      ON CONFLICT (order_item_id, seq) WHERE seq IS NOT NULL DO NOTHING;
    END LOOP;
  END LOOP;
END;
$function$;
