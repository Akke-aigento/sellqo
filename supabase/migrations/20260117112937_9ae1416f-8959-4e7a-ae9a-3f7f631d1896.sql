-- Marketplace Connections Table
CREATE TABLE public.marketplace_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace_type TEXT NOT NULL CHECK (marketplace_type IN ('bol_com', 'amazon', 'shopify', 'woocommerce')),
  marketplace_name TEXT,
  credentials JSONB NOT NULL DEFAULT '{}',
  settings JSONB DEFAULT '{"syncInterval": 15, "autoImport": true, "autoSyncInventory": true, "safetyStock": 0, "lowStockThreshold": 5}',
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  stats JSONB DEFAULT '{"totalOrders": 0, "totalRevenue": 0, "lastOrderDate": null, "productsLinked": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.marketplace_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's marketplace connections"
  ON public.marketplace_connections FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert marketplace connections for their tenant"
  ON public.marketplace_connections FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Users can update their tenant's marketplace connections"
  ON public.marketplace_connections FOR UPDATE
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Tenant admins can delete their tenant's marketplace connections"
  ON public.marketplace_connections FOR DELETE
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND has_role(auth.uid(), 'tenant_admin')
  );

-- Indexes
CREATE INDEX idx_marketplace_connections_tenant ON public.marketplace_connections(tenant_id);
CREATE INDEX idx_marketplace_connections_active ON public.marketplace_connections(is_active) WHERE is_active = true;

-- Inventory Sync Log Table
CREATE TABLE public.inventory_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  marketplace_connection_id UUID REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  marketplace_type TEXT NOT NULL,
  old_quantity INTEGER,
  new_quantity INTEGER,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.inventory_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's inventory sync logs"
  ON public.inventory_sync_log FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert inventory sync logs for their tenant"
  ON public.inventory_sync_log FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Index
CREATE INDEX idx_inventory_sync_log_product ON public.inventory_sync_log(product_id);
CREATE INDEX idx_inventory_sync_log_connection ON public.inventory_sync_log(marketplace_connection_id);

-- Sync Queue Table
CREATE TABLE public.sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace_connection_id UUID REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('order_import', 'inventory_export', 'order_status_update', 'full_sync')),
  payload JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's sync queue"
  ON public.sync_queue FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage their tenant's sync queue"
  ON public.sync_queue FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Index
CREATE INDEX idx_sync_queue_status ON public.sync_queue(status, scheduled_for);

-- Add marketplace columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketplace_source TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketplace_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketplace_connection_id UUID REFERENCES public.marketplace_connections(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'unfulfilled';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS raw_marketplace_data JSONB;

-- Index for marketplace orders
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON public.orders(marketplace_source, marketplace_order_id);

-- Add marketplace columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS bol_ean TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS amazon_asin TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS marketplace_mappings JSONB DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sync_inventory BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_inventory_sync TIMESTAMP WITH TIME ZONE;

-- Trigger for updated_at
CREATE TRIGGER update_marketplace_connections_updated_at
  BEFORE UPDATE ON public.marketplace_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();