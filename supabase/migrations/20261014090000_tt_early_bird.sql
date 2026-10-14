-- EB-TYPES-1 — early bird per tickettype.
-- Tot nu toe paste storefront-api de early-bird-prijs van de datum (event_details.early_bird_price)
-- toe op élk tickettype: een VIP van €40 zakte mee naar de €19 van het standaardticket.
-- Nieuw: een extra tickettype krijgt een eigen (optionele) early-bird-prijs. Het standaardtype
-- (product van de datum) blijft event_details.early_bird_price gebruiken, zodat bestaande
-- frontends en de bestaande datums niets merken. Periode en maximum blijven per datum
-- (event_details.early_bird_deadline / early_bird_quantity): één early-bird-periode, per type
-- een eigen prijs. NULL = geen early bird voor dat type. Strikt additief.
ALTER TABLE public.event_ticket_types
  ADD COLUMN IF NOT EXISTS early_bird_price numeric(10,2) NULL;

ALTER TABLE public.event_ticket_types
  DROP CONSTRAINT IF EXISTS event_ticket_types_early_bird_price_check;
ALTER TABLE public.event_ticket_types
  ADD CONSTRAINT event_ticket_types_early_bird_price_check CHECK (early_bird_price IS NULL OR early_bird_price >= 0);
