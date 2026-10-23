-- Minimale Supabase-nabootsing voor lokale migratietests (enkel wat de nieuwe migraties nodig hebben).
create extension if not exists pgcrypto;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table public.tenants (id uuid primary key default gen_random_uuid(), name text not null default 't', slug text, business_modules text[] not null default '{}', btw_number text, address text, city text, postal_code text);
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role text not null, tenant_id uuid, created_at timestamptz default now());
create table public.products (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), name text not null, price numeric not null, category_id uuid, vat_rate_id uuid, is_active boolean default true, channels text[] not null default '{online,table,menu,pos}', sold_out_until timestamptz, stock int, track_inventory bool default false);
create table public.categories (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, name text not null);
create or replace function public.is_platform_admin(_user_id uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'platform_admin') $$;
create or replace function public.get_user_tenant_ids(_user_id uuid default auth.uid()) returns setof uuid language plpgsql stable security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.user_roles where user_id = _user_id and role = 'platform_admin') then
    return query select id from public.tenants;
  else
    return query select tenant_id from public.user_roles where user_id = _user_id and tenant_id is not null;
  end if;
end $$;
grant select on public.tenants, public.user_roles, public.products, public.categories to authenticated;
grant all on all tables in schema public to service_role;
