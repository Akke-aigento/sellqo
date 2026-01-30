-- Add facebook_psid and instagram_id columns to customers table for cross-channel matching
ALTER TABLE customers ADD COLUMN IF NOT EXISTS facebook_psid TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS instagram_id TEXT;

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_customers_facebook_psid ON customers(tenant_id, facebook_psid) WHERE facebook_psid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_instagram_id ON customers(tenant_id, instagram_id) WHERE instagram_id IS NOT NULL;