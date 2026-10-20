-- MAIL-LIMIT-UI — verbruik van marketingmails leesbaar maken voor de admin.
--
-- marketing_email_limit en marketing_emails_used (20261019210000) zijn bewust enkel voor
-- service_role: ze nemen een willekeurige tenant-id aan. De admin (Marketing → E-mail en
-- Instellingen → Abonnement) moet het verbruik van de EIGEN winkel kunnen tonen, dus komt er
-- een smalle lees-RPC met rolcontrole bovenop. Geen nieuwe telling: dezelfde twee functies
-- als de wachtrij gebruikt, zodat wat de admin toont en wat de wachtrij afdwingt nooit
-- uiteenlopen.
--
-- monthly = null betekent onbeperkt (platform_tenant_unlimited: eigen merken, demo's).
-- Rollen: dezelfde set als marketing_contact_counts (iedereen die Marketing mag lezen).
-- Idempotent: CREATE OR REPLACE. Terugdraaien (handmatig):
--   drop function if exists public.marketing_email_usage(uuid);

create or replace function public.marketing_email_usage(p_tenant uuid)
returns table (monthly integer, used integer)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_tenant is null
     or not public.has_tenant_role(p_tenant, array['tenant_admin','staff','marketing','viewer','accountant']::public.app_role[]) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;

  return query
  select public.marketing_email_limit(p_tenant), public.marketing_emails_used(p_tenant);
end;
$$;

revoke all on function public.marketing_email_usage(uuid) from public, anon;
grant execute on function public.marketing_email_usage(uuid) to authenticated, service_role;