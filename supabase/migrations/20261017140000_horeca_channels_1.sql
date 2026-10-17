-- HORECA-CHANNELS-1 — per product kiezen waar het kan, en "op voor vandaag".
-- channels: online = bestellen via de webshop (afhalen/leveren), table = bestellen aan tafel
-- via de QR-code, menu = tonen op de QR-kaart (ook zonder bestelknop), pos = de kassa.
-- Standaard alles aan, dus geen enkel bestaand product verandert van gedrag.
-- sold_out_until: tot wanneer het product overal uitverkocht is (online, tafel, kassa).
-- Live gedraaid via query_database op 17-10-2026. Idempotent.

alter table public.products add column if not exists channels text[] not null default array['online', 'table', 'menu', 'pos']::text[];
alter table public.products add column if not exists sold_out_until timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_channels_valid') then
    alter table public.products add constraint products_channels_valid
      check (channels <@ array['online', 'table', 'menu', 'pos']::text[]);
  end if;
end $$;

-- Volgende reset om 05:00 Brussel: vóór 05:00 is dat vandaag, anders morgen.
create or replace function public.sold_out_reset_at(p_now timestamptz default now())
returns timestamptz
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select (
    (date_trunc('day', p_now at time zone 'Europe/Brussels')
      + case when (p_now at time zone 'Europe/Brussels')::time < time '05:00' then interval '5 hours' else interval '1 day 5 hours' end)
    at time zone 'Europe/Brussels'
  )
$$;

-- "Op voor vandaag" aan of uit. Security invoker: de gewone RLS op products bepaalt wie het mag.
create or replace function public.set_product_sold_out_today(p_product_id uuid, p_sold_out boolean)
returns timestamptz
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare v timestamptz;
begin
  update public.products
     set sold_out_until = case when p_sold_out then public.sold_out_reset_at() else null end
   where id = p_product_id
  returning sold_out_until into v;
  if not found then raise exception 'Product niet gevonden' using errcode = '42501'; end if;
  return v;
end $$;
revoke all on function public.set_product_sold_out_today(uuid, boolean) from public, anon;
grant execute on function public.set_product_sold_out_today(uuid, boolean) to authenticated, service_role;
