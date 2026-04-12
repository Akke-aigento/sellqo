ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_transfer_acknowledged_manual BOOLEAN DEFAULT false;
ALTER TABLE storefront_carts ADD COLUMN IF NOT EXISTS calculated_fee_cents INTEGER DEFAULT 0;