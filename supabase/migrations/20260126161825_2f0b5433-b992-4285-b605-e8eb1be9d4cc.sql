-- Add marketplace_order_item_id to order_items for Bol.com item tracking
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS marketplace_order_item_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_items_marketplace_item_id 
ON public.order_items(marketplace_order_item_id) 
WHERE marketplace_order_item_id IS NOT NULL;

-- Create shipping_labels table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'sendcloud', 'myparcel', 'bol_vvb'
  external_id TEXT,
  carrier TEXT,
  tracking_number TEXT,
  label_url TEXT,
  status TEXT DEFAULT 'created',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on shipping_labels
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

-- RLS policies for shipping_labels
CREATE POLICY "Tenant users can view their shipping labels"
  ON public.shipping_labels FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can insert shipping labels"
  ON public.shipping_labels FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can update their shipping labels"
  ON public.shipping_labels FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Create shipping-labels storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shipping-labels', 'shipping-labels', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for shipping labels - public read
CREATE POLICY "Public can view shipping labels"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shipping-labels');

-- Storage policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload shipping labels"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shipping-labels' AND auth.role() = 'authenticated');

-- Storage policy for service role to upload (for edge functions)
CREATE POLICY "Service role can manage shipping labels"
  ON storage.objects FOR ALL
  USING (bucket_id = 'shipping-labels')
  WITH CHECK (bucket_id = 'shipping-labels');