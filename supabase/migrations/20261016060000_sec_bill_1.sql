-- SEC-BILL-1 (herzien na de RLS-audit) — 16 oktober 2026 — GEDRAAID op 16-10-2026 09:40 na Akke's go
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
  and policyname in ('Tenant members can insert billing cycles', 'Tenant members can update billing cycles', 'Tenant members can delete billing cycles')
on conflict do nothing;

-- HERZIEN: de eerste versie brak het aanmaken van winkels (create_tenant_trial_subscription
-- zet subscription_plan binnen dezelfde gebruikerscontext → 42501). Deze versie:
--  * ook BEFORE INSERT: platformvlaggen worden op hun standaard gezet voor niet-platform-admins;
--  * geneste trigger-updates (pg_trigger_depth() > 1) worden doorgelaten;
--  * ook de DELETE-policy op billing_cycles weg.
-- Getest in een rollback-transactie door de RLS-audit (zie docs/prepared/2026-10-16-rls-escalatie-audit.md).

-- SEC-BILL-1 herzien: ook INSERT, en geneste trigger-updates doorlaten
create or replace function public.tenants_protect_platform_columns()
 returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or public.is_platform_admin(auth.uid()) then return new; end if;
  if tg_op = 'INSERT' then
    new.billing_exempt := false; new.billing_on_hold := false; new.is_internal_tenant := false;
    new.is_demo := false; new.subscription_status := 'trial'; new.stripe_account_id := null;
    new.stripe_onboarding_complete := false; new.stripe_charges_enabled := false;
    new.stripe_payouts_enabled := false; new.domain_verified := false;
    return new;
  end if;
  if pg_trigger_depth() > 1 then return new; end if;  -- bv. create_tenant_trial_subscription
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
  then raise exception 'Deze instelling kan alleen SellQo wijzigen' using errcode = '42501'; end if;
  return new;
end; $function$;
drop trigger if exists tenants_protect_platform_columns on public.tenants;
create trigger tenants_protect_platform_columns before insert or update on public.tenants
  for each row execute function public.tenants_protect_platform_columns();
drop policy if exists "Tenant members can delete billing cycles" on public.billing_cycles;  -- naast de twee uit SEC-BILL-1
drop policy if exists "Tenant members can insert billing cycles" on public.billing_cycles;
drop policy if exists "Tenant members can update billing cycles" on public.billing_cycles;
