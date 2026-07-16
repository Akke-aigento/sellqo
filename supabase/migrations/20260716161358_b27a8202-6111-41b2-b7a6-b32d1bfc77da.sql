ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS acquisition_source text;

COMMENT ON COLUMN public.customers.acquisition_source IS
  'Herkomst van de klantregistratie: manual (CRM), webshop (checkout), bol_com/shopify_import (order-import), csv_import, ... NULL = echte klant, onbekende herkomst.';

-- a) Bol.com klanten
UPDATE public.customers c
SET acquisition_source = 'bol_com'
WHERE acquisition_source IS NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = c.id
      AND o.marketplace_source = 'bol_com'
  );

-- b) Shopify-import klanten (na Bol)
UPDATE public.customers c
SET acquisition_source = 'shopify_import'
WHERE acquisition_source IS NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = c.id
      AND o.marketplace_source = 'shopify_draft_order'
  );