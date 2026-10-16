-- SEC-BILL-1 — 16 oktober 2026 — VOORBEREID, NIET GEDRAAID (wacht op Akke's go: raakt facturatie)
--
-- Gevonden in de nachtrun (rol-impersonatie, rollback):
--  1. Policy "Tenant admins can update their own tenant" + volledige kolomrechten: een
--     tenant_admin (getest: Mancini Milano) kon tenants.billing_exempt op true zetten
--     → nooit meer gefactureerd. Zelfde voor is_internal_tenant, billing_on_hold,
--     subscription_plan/status, stripe_*-vlaggen, is_demo.
--  2. billing_cycles: policies "Tenant members can insert/update billing cycles" (rol
--     authenticated, elk lid van de winkel). De pay-first-motor schrijft alleen via
--     service_role; geen enkele app-code schrijft rechtstreeks (rg: 0 hits).
--
-- Fix:
--  1. BEFORE UPDATE-trigger op tenants: een ingelogde niet-platform-admin mag de
--     beschermde kolommen niet WIJZIGEN (zelfde waarde meesturen mag: volledige-rij-saves
--     blijven werken). Service-role (auth.uid() null) en platform-admin ongewijzigd.
--  2. De twee billing_cycles-policies voor tenants weg. SELECT-policies blijven.
--
-- Idempotent. Terugdraaien:
--   drop trigger if exists tenants_protect_platform_columns on public.tenants;
--   drop function if exists public.tenants_protect_platform_columns();
--   policies: zie ops.sec_bill_1_prev_policies (definities vóór de migratie).

create schema if not exists ops;
create table if not exists ops.sec_bill_1_prev_policies (
  tablename text, policyname text, cmd text, roles text, qual text, with_check text,
  saved_at timestamptz not null default now(),
  primary key (tablename, policyname)
);
insert into ops.sec_bill_1_prev_policies (tablename, policyname, cmd, roles, qual, with_check)
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'billing_cycles'
  and policyname in ('Tenant members can insert billing cycles', 'Tenant members can update billing cycles')
on conflict do nothing;

create or replace function public.tenants_protect_platform_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or public.is_platform_admin(auth.uid()) then
    return new;
  end if;
  if new.billing_exempt is distinct from old.billing_exempt
     or new.billing_on_hold is distinct from old.billing_on_hold
     or new.is_internal_tenant is distinct from old.is_internal_tenant
     or new.is_demo is distinct from old.is_demo
     or new.subscription_plan is distinct from old.subscription_plan
     or new.subscription_status is distinct from old.subscription_status
     or new.stripe_account_id is distinct from old.stripe_account_id
     or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete
     or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
     or new.domain_verified is distinct from old.domain_verified
  then
    raise exception 'Deze instelling kan alleen SellQo wijzigen' using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists tenants_protect_platform_columns on public.tenants;
create trigger tenants_protect_platform_columns
  before update on public.tenants
  for each row execute function public.tenants_protect_platform_columns();

drop policy if exists "Tenant members can insert billing cycles" on public.billing_cycles;
drop policy if exists "Tenant members can update billing cycles" on public.billing_cycles;
