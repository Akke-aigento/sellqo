-- Create sync_activity_log table for tracking synchronization history
CREATE TABLE public.sync_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_sync_activity_log_tenant ON public.sync_activity_log(tenant_id);
CREATE INDEX idx_sync_activity_log_connection ON public.sync_activity_log(connection_id);
CREATE INDEX idx_sync_activity_log_completed ON public.sync_activity_log(completed_at DESC);

-- Enable RLS
ALTER TABLE public.sync_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their tenant's sync logs"
ON public.sync_activity_log
FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert sync logs for their tenant"
ON public.sync_activity_log
FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_activity_log;