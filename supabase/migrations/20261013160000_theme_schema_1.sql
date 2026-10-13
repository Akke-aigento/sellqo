-- THEME-SCHEMA-1 (13-10-2026): instellingen van de SellQo-standaardshop volgens het
-- themaschema (settings, menu). Additief; alleen get_storefront_bundle leest dit
-- (select '*'); get_config en eigen frontends zien geen verschil.
-- Live toegepast via query_database op 13-10-2026.
alter table public.tenant_theme_settings add column if not exists theme_config jsonb not null default '{}'::jsonb;
comment on column public.tenant_theme_settings.theme_config is 'THEME-SCHEMA-1: instellingen van de SellQo-standaardshop volgens het themaschema (settings, menu). Alleen gelezen door get_storefront_bundle.';
