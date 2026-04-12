ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS payment_section_order JSONB 
DEFAULT '["direct", "later", "transfer"]'::jsonb;