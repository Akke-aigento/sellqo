-- SEC-INVITE-1 (deel B) — 16 oktober 2026 — NOG NIET GEDRAAID (wacht op Akke's go)
--
-- Vondst 6 uit docs/prepared/2026-10-16-rls-escalatie-audit.md:
--   Policies td_insert_tenant_admin / td_update_tenant_admin (authenticated, tenant_admin
--   van de winkel) beperken geen kolommen. Een tenant_admin kon een vreemd, nog niet
--   gekoppeld domein invoegen met dns_verified=true en ssl_active=true, of een bestaande
--   rij zelf op "geverifieerd" zetten. De anon-policy "Public can read active domains"
--   en storefront-customer-api (url_base-allowlist) vertrouwen op dns_verified.
--
-- Schrijvers van tenant_domains (rg in src en supabase/functions, 16-10):
--   - src/hooks/useTenantDomains.ts addDomain (authenticated): tenant_id, domain, locale,
--     is_canonical. Nooit vlaggen.
--   - src/hooks/useTenantDomains.ts updateDomain (authenticated): alleen locale,
--     is_canonical, is_active (MultiDomainSettings r.54/58/62). Het domein van een
--     bestaande rij wordt nergens gewijzigd.
--   - removeDomain (authenticated): DELETE, niet geraakt door deze trigger.
--   - verify-domain (service_role): dns_verified=true na DNS-controle.
--   - check-domain-ssl (service_role): ssl_active=true na HTTPS-controle.
--   - ensure_single_canonical_domain() (SECURITY DEFINER-trigger): zet alleen
--     is_canonical=false op de andere rijen van dezelfde winkel. Geen andere
--     DB-functie raakt tenant_domains (pg_proc-zoektocht).
--   - hosting_mode: door geen enkele code geschreven (default 'sellqo'); niet beschermd.
--
-- Fix: BEFORE INSERT OR UPDATE-trigger, zelfde patroon als tenants_protect_platform_columns.
--   - service_role (auth.uid() null), migraties/SQL-console (auth.uid() null) en
--     platform-admins: ongemoeid.
--   - INSERT door een ingelogde niet-platform-admin: dns_verified en ssl_active worden
--     geforceerd op false (geen fout: de gewone "domein toevoegen" blijft werken).
--   - UPDATE door een ingelogde niet-platform-admin: dns_verified, ssl_active, tenant_id,
--     domain en verification_token WIJZIGEN geeft 42501. Dezelfde waarde meesturen mag.
--   - Bewust GEEN pg_trigger_depth()-uitzondering: de enige geneste schrijver
--     (ensure_single_canonical_domain) wijzigt alleen is_canonical en passeert de check
--     dus gewoon. Zonder uitzondering kan een toekomstige definer-trigger op een andere
--     tabel de vlaggen ook niet stil omzeilen.
--
-- Idempotent (create or replace + drop trigger if exists; snapshot met on conflict).
-- Terugdraaien (geen DOWN):
--   drop trigger if exists tenant_domains_protect_flags on public.tenant_domains;
--   drop function if exists public.tenant_domains_protect_flags();
-- De snapshot ops.sec_invite_1_prev_domains bewaart de vlaggen vóór de migratie (de
-- trigger wijzigt geen bestaande rijen, dus terugzetten is normaal niet nodig).

create schema if not exists ops;
create table if not exists ops.sec_invite_1_prev_domains (
  id uuid primary key,
  tenant_id uuid not null,
  domain text not null,
  dns_verified boolean not null,
  ssl_active boolean not null,
  is_active boolean not null,
  saved_at timestamptz not null default '2026-10-16 16:00:00+00'
);
insert into ops.sec_invite_1_prev_domains (id, tenant_id, domain, dns_verified, ssl_active, is_active)
select id, tenant_id, domain, dns_verified, ssl_active, is_active from public.tenant_domains
on conflict (id) do nothing;

create or replace function public.tenant_domains_protect_flags()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or public.is_platform_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.dns_verified := false;
    new.ssl_active := false;
    return new;
  end if;
  if new.dns_verified is distinct from old.dns_verified
     or new.ssl_active is distinct from old.ssl_active
     or new.tenant_id is distinct from old.tenant_id
     or new.domain is distinct from old.domain
     or new.verification_token is distinct from old.verification_token
  then
    raise exception 'Domeinverificatie kan alleen SellQo wijzigen' using errcode = '42501';
  end if;
  return new;
end
$function$;

revoke all on function public.tenant_domains_protect_flags() from public, anon, authenticated;

drop trigger if exists tenant_domains_protect_flags on public.tenant_domains;
create trigger tenant_domains_protect_flags
  before insert or update on public.tenant_domains
  for each row execute function public.tenant_domains_protect_flags();
