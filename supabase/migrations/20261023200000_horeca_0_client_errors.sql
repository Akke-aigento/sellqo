-- HORECA-0 (23-10-2026): client_errors — fouten uit de admin en de app, zodat een wit
-- scherm bij ons binnenkomt vóór de klant belt.
-- Additief: nieuwe tabel, niets bestaands geraakt. Idempotent.
-- Terugdraaien (handmatig): drop table if exists public.client_errors;
--
-- Security:
-- - insert enkel door een ingelogde gebruiker, enkel als zichzelf (user_id = auth.uid())
--   en enkel voor een tenant waar hij bij hoort (of zonder tenant);
-- - lezen enkel door platform-admins (Watchtower/support);
-- - geen update/delete voor wie dan ook (geen grant).

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  source text not null check (source in ('boundary', 'chunk', 'unhandled')),
  route text,
  build text,
  platform text,
  message text not null,
  stack text,
  component_stack text,
  crumbs jsonb not null default '[]'::jsonb,
  constraint client_errors_message_len check (char_length(message) <= 1000),
  constraint client_errors_stack_len check (stack is null or char_length(stack) <= 8000),
  constraint client_errors_cstack_len check (component_stack is null or char_length(component_stack) <= 8000)
);

create index if not exists idx_client_errors_created on public.client_errors (created_at desc);
create index if not exists idx_client_errors_tenant on public.client_errors (tenant_id, created_at desc) where tenant_id is not null;

alter table public.client_errors enable row level security;

revoke all on public.client_errors from anon, authenticated;
grant insert on public.client_errors to authenticated;
grant select on public.client_errors to authenticated;
grant all on public.client_errors to service_role;

drop policy if exists client_errors_insert_own on public.client_errors;
create policy client_errors_insert_own on public.client_errors for insert to authenticated
  with check (
    user_id = auth.uid()
    and (tenant_id is null or tenant_id in (select public.get_user_tenant_ids(auth.uid())))
  );

drop policy if exists client_errors_select_platform on public.client_errors;
create policy client_errors_select_platform on public.client_errors for select to authenticated
  using (public.is_platform_admin(auth.uid()));
