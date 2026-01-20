-- Add stripe_refund_id column to pos_transactions for audit trail
ALTER TABLE pos_transactions 
ADD COLUMN IF NOT EXISTS stripe_refund_id text;