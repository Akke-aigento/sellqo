-- QR-IDEMP-1 — welke order ontstond uit een mandje.
--
-- storefront-api checkout_complete gaf bij een herhaling (netwerkfout, dubbel tikken) op een
-- al omgezet mandje de fout "Deze bestelling is al afgerond". Nu geeft het hetzelfde succes als
-- de eerste keer (met duplicate: true). Daarvoor moet het de order van dít mandje terugvinden:
-- Stripe-orders via orders.stripe_checkout_session_id (bestond al); overschrijving, betalen bij
-- afhalen en gratis orders via deze nieuwe kolom, gezet door createOrderFromCart.
--
-- Strikt additief. storefront_carts gaat nooit als ruwe rij naar een frontend (cart_get mapt de
-- velden expliciet), en een order-ID is geen gevoelig gegeven voor wie het mandje-ID al kent.
-- storefront-api zet de kolom in een aparte update zonder foutpropagatie: deployen vóór deze
-- migratie is veilig (de herhaling valt dan terug op de oude fout, behalve bij Stripe).
--
-- Handmatig terugdraaien:
--   alter table public.storefront_carts drop column if exists converted_order_id;

alter table public.storefront_carts add column if not exists converted_order_id uuid;
comment on column public.storefront_carts.converted_order_id is 'QR-IDEMP-1: de order die uit dit mandje ontstond (checkout_complete idempotent).';
