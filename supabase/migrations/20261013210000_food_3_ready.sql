-- FOOD-3 (13-10-2026): klant verwittigen als de bestelling klaar is (afhalen) of
-- onderweg (levering). Additief; live toegepast via query_database en nagekeken.
alter table public.kitchen_tickets add column if not exists notified_at timestamptz;
alter table public.fulfillment_settings add column if not exists notify_ready boolean not null default true;
