-- SHOP-OPEN-1 (13-10-2026): de winkel zelf online zetten op <slug>.sellqo.shop en
-- online bestellen aanzetten, per winkel, in plaats van de pilotlijst in wrangler.jsonc.
-- Standaard uit: niemand komt ongevraagd online (ook niet naast een eigen website).
-- Bewust nieuwe kolommen i.p.v. storefront_status: die staat bij de meeste tenants al
-- op 'online' (oude ingebouwde winkel). Live toegepast via query_database en nagekeken.
alter table public.tenant_theme_settings add column if not exists shop_live boolean not null default false;
alter table public.tenant_theme_settings add column if not exists shop_ordering boolean not null default false;
alter table public.tenant_theme_settings add column if not exists shop_live_at timestamptz;
