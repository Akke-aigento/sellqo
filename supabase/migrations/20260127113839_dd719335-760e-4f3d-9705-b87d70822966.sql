-- Add new channel types to customer_messages for Meta messaging
-- Drop existing constraint if any
ALTER TABLE customer_messages 
DROP CONSTRAINT IF EXISTS customer_messages_channel_check;

-- Add Meta platform specific columns to customer_messages
ALTER TABLE customer_messages
ADD COLUMN IF NOT EXISTS meta_sender_id TEXT,
ADD COLUMN IF NOT EXISTS meta_page_id TEXT,
ADD COLUMN IF NOT EXISTS meta_message_id TEXT;

-- Add Facebook/Instagram identifiers to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS facebook_psid TEXT,
ADD COLUMN IF NOT EXISTS instagram_id TEXT;

-- Create meta_messaging_connections table for Facebook Messenger and Instagram DMs
CREATE TABLE public.meta_messaging_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  page_id TEXT NOT NULL,
  page_name TEXT,
  page_access_token TEXT NOT NULL,
  instagram_account_id TEXT,
  webhook_verify_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, platform, page_id)
);

-- Enable RLS
ALTER TABLE meta_messaging_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_messaging_connections
CREATE POLICY "Users can view their tenant's meta connections"
ON meta_messaging_connections FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert meta connections"
ON meta_messaging_connections FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'platform_admin')
  )
);

CREATE POLICY "Admins can update meta connections"
ON meta_messaging_connections FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'platform_admin')
  )
);

CREATE POLICY "Admins can delete meta connections"
ON meta_messaging_connections FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'platform_admin')
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_meta_messaging_connections_updated_at
BEFORE UPDATE ON meta_messaging_connections
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_meta_messaging_connections_tenant_platform 
ON meta_messaging_connections(tenant_id, platform);

CREATE INDEX idx_meta_messaging_connections_page_id 
ON meta_messaging_connections(page_id);

-- Add indexes for customer matching
CREATE INDEX idx_customers_facebook_psid ON customers(facebook_psid) WHERE facebook_psid IS NOT NULL;
CREATE INDEX idx_customers_instagram_id ON customers(instagram_id) WHERE instagram_id IS NOT NULL;

-- Add indexes for meta message lookups
CREATE INDEX idx_customer_messages_meta_sender_id ON customer_messages(meta_sender_id) WHERE meta_sender_id IS NOT NULL;
CREATE INDEX idx_customer_messages_meta_message_id ON customer_messages(meta_message_id) WHERE meta_message_id IS NOT NULL;