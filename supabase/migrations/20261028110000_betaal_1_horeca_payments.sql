-- BETAAL-1 — betaalinstellingen per zaak en overschrijving (EPC-QR) als betaalmiddel in SellQo Kassa.
--
-- 1. public.horeca_pay_settings: één rij per winkel, door de winkel zelf in te stellen
--    (Kassa › Betalen). Geen rij = de standaard hieronder (cash + overschrijving, geen terminal,
--    fooi aan). Leesbaar voor elk lid van de winkel (de kassa leest ze), schrijfbaar voor de beheerder.
-- 2. horeca_pay (tafel én toog) aanvaardt `transfer` als betaalmiddel en als fooiwijze.
--    Fiscaal (src/kassa/app/horeca/pay.ts): type OTHER, naam "OVERSCHRIJVING" — de FDM kent geen
--    apart overschrijvingstype; vraag opgenomen voor de Q&A met de FOD.
--    pos_transactions.payments: method 'manual' (zoals de klassieke kassa een overschrijving
--    boekt), record_transaction: 'bank_transfer'.
--    De functie wordt gepatcht op de live definitie met een md5-guard (e601413f…, = TAFEL-3),
--    zodat er geen 240 regels herschreven plpgsql in deze migratie staan. Is de functie intussen
--    anders, dan faalt de migratie luid in plaats van stil iets te overschrijven.
-- 3. check_payments.tip_method aanvaardt 'transfer'.
--
-- Idempotent: tabel/policies met if not exists / drop if exists; de functiepatch slaat over als
-- 'transfer' er al in staat; de constraint wordt enkel vervangen als hij 'transfer' nog niet kent.
--
-- Handmatig terugdraaien:
--   drop table if exists public.horeca_pay_settings;
--   alter table public.check_payments drop constraint check_payments_tip_method_check,
--     add constraint check_payments_tip_method_check check (tip_method is null or tip_method in ('cash','card'));
--     (faalt zolang er betalingen met fooi via overschrijving bestaan — dat is de bedoeling)
--   horeca_pay: de definitie uit 20261024160000_tafel_3_counter_cash_reports.sql opnieuw draaien.

-- 1. Instellingen --------------------------------------------------------------------------------
create table if not exists public.horeca_pay_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  -- Betaalwijzen die de kassa toont. 'card' telt enkel als er een terminal is (zie terminal).
  methods text[] not null default array['cash', 'transfer']::text[]
    check (methods <@ array['cash', 'transfer', 'card', 'cheque_meal', 'voucher']::text[] and cardinality(methods) >= 1),
  -- none = geen terminal (geen "kaart"), standalone = losse terminal, bedrag zelf intikken.
  terminal text not null default 'none' check (terminal in ('none', 'standalone')),
  -- Fooi aanbieden bij afrekenen aan de kassa.
  kassa_tip boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.horeca_pay_settings is 'BETAAL-1: betaalwijzen, terminal en fooi van SellQo Kassa per winkel (Kassa › Betalen).';

revoke all on public.horeca_pay_settings from anon;
grant select, insert, update on public.horeca_pay_settings to authenticated;
alter table public.horeca_pay_settings enable row level security;

drop policy if exists horeca_pay_settings_select on public.horeca_pay_settings;
create policy horeca_pay_settings_select on public.horeca_pay_settings for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));
drop policy if exists horeca_pay_settings_insert on public.horeca_pay_settings;
create policy horeca_pay_settings_insert on public.horeca_pay_settings for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));
drop policy if exists horeca_pay_settings_update on public.horeca_pay_settings;
create policy horeca_pay_settings_update on public.horeca_pay_settings for update to authenticated
  using (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]))
  with check (public.has_tenant_role(tenant_id, array['tenant_admin']::public.app_role[]));
-- Geen delete: uitzetten = een andere waarde, de standaard geldt enkel zonder rij.

-- 2. horeca_pay: overschrijving -------------------------------------------------------------------
do $mig$
declare
  d text := pg_get_functiondef('public.horeca_pay(uuid, text, jsonb)'::regprocedure);
  n text;
begin
  if position('transfer' in d) > 0 then
    raise notice 'BETAAL-1: horeca_pay kent transfer al, overgeslagen';
    return;
  end if;
  if md5(d) <> 'e601413fc5663acb46a937a924cd85c4' then
    raise exception 'BETAAL-1: horeca_pay wijkt af van TAFEL-3 (md5 %), patch niet toegepast', md5(d);
  end if;
  n := d;
  n := replace(n, $a$!~ '^(cash|card|cheque_meal|voucher|other)$'$a$, $a$!~ '^(cash|card|transfer|cheque_meal|voucher|other)$'$a$);
  n := replace(n, $a$v_tip_method not in ('cash', 'card')$a$, $a$v_tip_method not in ('cash', 'card', 'transfer')$a$);
  n := replace(n, $a$case when v_primary = 'card' then 'pos_card' else 'pos_cash' end$a$,
                  $a$case when v_primary = 'card' then 'pos_card' when v_primary = 'transfer' then 'bank_transfer' else 'pos_cash' end$a$);
  -- Elke vervanging moet precies één keer raken.
  if (length(n) - length(d)) <> (length('transfer|') + length(', ''transfer''') + length(' when v_primary = ''transfer'' then ''bank_transfer''')) then
    raise exception 'BETAAL-1: niet alle vervangingen in horeca_pay raakten (delta %)', length(n) - length(d);
  end if;
  execute n;
end
$mig$;

-- 3. Fooi via overschrijving -------------------------------------------------------------------------
do $mig$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.check_payments'::regclass and conname = 'check_payments_tip_method_check'
       and pg_get_constraintdef(oid) like '%transfer%'
  ) then
    alter table public.check_payments drop constraint if exists check_payments_tip_method_check;
    alter table public.check_payments add constraint check_payments_tip_method_check
      check (tip_method is null or tip_method in ('cash', 'card', 'transfer'));
  end if;
end
$mig$;
