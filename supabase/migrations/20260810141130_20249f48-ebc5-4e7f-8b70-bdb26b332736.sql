-- SHIP-GEO-1: geografische scope voor verzendmethodes
ALTER TABLE public.shipping_methods
  ADD COLUMN IF NOT EXISTS countries text[];

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS shipping_allowed_countries text[];

COMMENT ON COLUMN public.shipping_methods.countries IS
  'ISO-2 landcodes waarvoor deze methode geldt. NULL/leeg = alle landen binnen tenants.shipping_allowed_countries.';
COMMENT ON COLUMN public.tenants.shipping_allowed_countries IS
  'Globale allowlist ISO-2 landcodes waarnaar deze winkel verzendt. NULL/leeg = geen beperking.';

-- Bestaande methodes: beperken tot EU-27 (keuze bij invoering)
UPDATE public.shipping_methods
SET countries = ARRAY['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK']
WHERE countries IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_methods_countries
  ON public.shipping_methods USING gin (countries);