-- Stub: Supabase Vault + bestaande pos_cashiers zoals live (23-10-2026).
create schema if not exists vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret, description from vault.secrets;
create or replace function vault.create_secret(new_secret text, new_name text, new_description text default '') returns uuid language sql as $$
  insert into vault.secrets (secret, name, description) values (new_secret, new_name, new_description) returning id $$;
create table public.pos_cashiers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, display_name text not null, pin_hash text not null,
  avatar_color text default '#3b82f6', is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.pos_cashiers enable row level security;
grant all on public.pos_cashiers to anon, authenticated, service_role;
create policy pos_cashiers_select on public.pos_cashiers for select to authenticated using (public.is_platform_admin(auth.uid()) or public.has_tenant_role(tenant_id, array['tenant_admin','staff']::app_role[]));
create policy pos_cashiers_update on public.pos_cashiers for update to authenticated using (public.has_tenant_role(tenant_id, array['tenant_admin']::app_role[]));
