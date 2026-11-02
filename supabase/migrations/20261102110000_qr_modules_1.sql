-- QR-MODULES-1 — "Ober roepen" en "Rekening vragen" via de QR-code krijgen elk een schakelaar.
--
-- Tot nu konden gasten altijd de bediening roepen of de rekening vragen zodra het QR-menu aanstond
-- (OBER-ROEPEN-1, storefront-api table_call). De zaak kan dat nu per soort uitzetten in
-- Kaart › Instellen › QR-menu (QrModeSettings), naast de andere QR-schakelaars die al in
-- fulfillment_settings staan (qr_mode, qr_flow, qr_auto_accept, qr_pay_counter, qr_pay_online).
--
-- Strikt additief: twee nieuwe kolommen, standaard aan (= het gedrag van vandaag, voor elke zaak).
-- fulfillment_settings gaat nergens via select('*') naar de custom frontends: storefront-api leest
-- de kolommen expliciet (loadFulfillmentSettings, resolve_domain) en geeft enkel door wat het
-- uitdrukkelijk opbouwt. De RLS van fulfillment_settings (lezen: eigen tenant; schrijven:
-- tenant_admin) geldt ongewijzigd voor de nieuwe kolommen.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Volgorde bij uitrol: eerst deze migratie, dan storefront-api
-- (die leest de kolommen foutbestendig in een aparte query, dus ook omgekeerd breekt er niets).
--
-- Handmatig terugdraaien (enkel als niets ze nog leest; kolommen droppen is onomkeerbaar):
--   alter table public.fulfillment_settings drop column if exists qr_call_waiter, drop column if exists qr_call_bill;

alter table public.fulfillment_settings
  add column if not exists qr_call_waiter boolean not null default true,
  add column if not exists qr_call_bill boolean not null default true;

comment on column public.fulfillment_settings.qr_call_waiter is
  'QR-MODULES-1: gasten kunnen via de QR-code aan tafel de bediening roepen (storefront-api table_call kind=waiter).';
comment on column public.fulfillment_settings.qr_call_bill is
  'QR-MODULES-1: gasten kunnen via de QR-code aan tafel de rekening vragen (storefront-api table_call kind=bill).';
