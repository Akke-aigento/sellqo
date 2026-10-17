-- TRACKS-1 — drie sporen (webshop, horeca, events).
-- Het spoor van een winkel = pricing_plans.track van zijn plan + zijn add-ons
-- (tenants.business_modules) + door een platformadmin ontgrendelde modules.
-- Add-ons zijn betalend: alleen SellQo (platformadmin of backend) mag ze wijzigen.
-- Live gedraaid via query_database op 17-10-2026; snapshots in snapshots.platform_20261017_*.
-- Idempotent.

-- 1. Spoor per plan
alter table public.pricing_plans add column if not exists track text not null default 'webshop';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pricing_plans_track_valid') then
    alter table public.pricing_plans add constraint pricing_plans_track_valid check (track in ('webshop', 'horeca', 'events'));
  end if;
end $$;
update public.pricing_plans set track = 'horeca' where slug = 'horeca' and track is distinct from 'horeca';
update public.pricing_plans set track = 'events' where slug = 'events_flex' and track is distinct from 'events';

-- 2. Add-ons: ook 'webshop' toegelaten (webshop naast horeca of events)
alter table public.tenants drop constraint if exists tenants_business_modules_valid;
alter table public.tenants add constraint tenants_business_modules_valid
  check (business_modules <@ array['webshop', 'horeca', 'events']::text[]);

-- 3. Add-ons alleen door SellQo: bestaande beschermtrigger uitgebreid met business_modules
create or replace function public.tenants_protect_platform_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or public.is_platform_admin(auth.uid()) then return new; end if;
  if tg_op = 'INSERT' then
    new.billing_exempt := false; new.billing_on_hold := false; new.is_internal_tenant := false;
    new.is_demo := false; new.subscription_status := 'trial'; new.stripe_account_id := null;
    new.stripe_onboarding_complete := false; new.stripe_charges_enabled := false;
    new.stripe_payouts_enabled := false; new.domain_verified := false;
    new.business_modules := '{}'; -- TRACKS-1: add-ons zijn betalend
    return new;
  end if;
  if pg_trigger_depth() > 1 then return new; end if;
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
     or new.business_modules is distinct from old.business_modules -- TRACKS-1
  then raise exception 'Deze instelling kan alleen SellQo wijzigen' using errcode = '42501'; end if;
  return new;
end; $function$;
