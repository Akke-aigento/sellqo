-- HORECA-1 (13-10-2026): QR-menu in de zaak — alleen bekijken of bestellen aan tafel,
-- afrekenen aan de toog en/of online. Additief; live toegepast en nagekeken.
alter table public.fulfillment_settings add column if not exists qr_mode text not null default 'view';
do $$ begin
  alter table public.fulfillment_settings add constraint fulfillment_settings_qr_mode_check check (qr_mode in ('off','view','order'));
exception when duplicate_object then null; end $$;
alter table public.fulfillment_settings add column if not exists qr_pay_counter boolean not null default true;
alter table public.fulfillment_settings add column if not exists qr_pay_online boolean not null default false;
-- Tafelnummer (of -naam) van een bestelling aan tafel.
alter table public.storefront_carts add column if not exists table_label text;
alter table public.orders add column if not exists table_label text;
