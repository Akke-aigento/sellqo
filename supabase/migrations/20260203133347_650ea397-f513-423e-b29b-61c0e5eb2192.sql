-- Add raw_import_data JSONB column to customers for storing metafields and extra import data
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS raw_import_data jsonb DEFAULT '{}';

-- Add sms_subscribed boolean to customers for Shopify SMS marketing status
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS sms_subscribed boolean DEFAULT false;

-- Add raw_import_data JSONB column to products for storing metafields and extra import data
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS raw_import_data jsonb DEFAULT '{}';