ALTER TABLE discount_codes DROP CONSTRAINT IF EXISTS discount_codes_discount_type_check;
ALTER TABLE discount_codes ADD CONSTRAINT discount_codes_discount_type_check 
  CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping'));