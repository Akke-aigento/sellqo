-- Auto-sync EAN fields: when one is set, propagate to the other.
CREATE OR REPLACE FUNCTION public.sync_product_ean_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bol_ean IS NOT NULL AND NEW.bol_ean <> '' AND (NEW.barcode IS NULL OR NEW.barcode = '') THEN
    NEW.barcode := NEW.bol_ean;
  END IF;

  IF NEW.barcode IS NOT NULL AND NEW.barcode <> '' AND (NEW.bol_ean IS NULL OR NEW.bol_ean = '') THEN
    NEW.bol_ean := NEW.barcode;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_ean_fields ON public.products;
CREATE TRIGGER trg_sync_product_ean_fields
  BEFORE INSERT OR UPDATE OF bol_ean, barcode ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_ean_fields();

UPDATE products
SET barcode = bol_ean
WHERE bol_ean IS NOT NULL AND bol_ean <> ''
  AND (barcode IS NULL OR barcode = '');

UPDATE products
SET bol_ean = barcode
WHERE barcode IS NOT NULL AND barcode <> ''
  AND (bol_ean IS NULL OR bol_ean = '');

COMMENT ON TRIGGER trg_sync_product_ean_fields ON public.products IS
  'Keeps bol_ean and barcode in sync when admin fills only one field.';