
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sales_channel TEXT DEFAULT 'webshop';

-- Backfill existing orders based on marketplace_source
UPDATE public.orders SET sales_channel = 'bol_com' WHERE marketplace_source = 'bol_com' AND (sales_channel IS NULL OR sales_channel = 'webshop');
UPDATE public.orders SET sales_channel = 'amazon' WHERE marketplace_source = 'amazon' AND (sales_channel IS NULL OR sales_channel = 'webshop');
UPDATE public.orders SET sales_channel = 'sellqo_webshop' WHERE marketplace_source = 'sellqo_webshop' AND (sales_channel IS NULL OR sales_channel = 'webshop');
