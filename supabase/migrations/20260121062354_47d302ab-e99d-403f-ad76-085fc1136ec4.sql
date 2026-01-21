-- Create marketplace listing queue for bulk processing
CREATE TABLE IF NOT EXISTS marketplace_listing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  marketplace_type TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error_message TEXT,
  ai_optimized_content JSONB,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketplace_listing_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketplace_listing_queue using user_roles pattern
CREATE POLICY "Users can view their tenant's listing queue"
  ON marketplace_listing_queue FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert into their tenant's listing queue"
  ON marketplace_listing_queue FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their tenant's listing queue"
  ON marketplace_listing_queue FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete from their tenant's listing queue"
  ON marketplace_listing_queue FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_listing_queue_tenant ON marketplace_listing_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_listing_queue_status ON marketplace_listing_queue(status);
CREATE INDEX IF NOT EXISTS idx_listing_queue_scheduled ON marketplace_listing_queue(scheduled_for) WHERE status = 'pending';