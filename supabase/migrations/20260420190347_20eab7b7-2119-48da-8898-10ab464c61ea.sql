ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS vat_rate_id UUID REFERENCES public.vat_rates(id);

COMMENT ON COLUMN public.order_items.vat_rate IS 'VAT rate applied to this line at order creation (frozen snapshot, e.g. 21.00 for 21%)';
COMMENT ON COLUMN public.order_items.vat_amount IS 'VAT amount included in total_price (inclusive pricing model)';
COMMENT ON COLUMN public.order_items.vat_rate_id IS 'Reference to vat_rates row, frozen at order creation';