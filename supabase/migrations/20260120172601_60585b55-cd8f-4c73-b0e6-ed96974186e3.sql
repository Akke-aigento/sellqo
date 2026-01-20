-- Create notification category enum
CREATE TYPE notification_category AS ENUM (
  'orders',
  'invoices', 
  'payments',
  'customers',
  'products',
  'quotes',
  'subscriptions',
  'marketing',
  'team',
  'system'
);

-- Create notification priority enum
CREATE TYPE notification_priority AS ENUM (
  'low',
  'medium', 
  'high',
  'urgent'
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category notification_category NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  priority notification_priority DEFAULT 'medium',
  read_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tenant notification settings table
CREATE TABLE public.tenant_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category notification_category NOT NULL,
  notification_type TEXT NOT NULL,
  in_app_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  email_recipients TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, category, notification_type)
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their tenant notifications"
  ON public.notifications FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant notifications"
  ON public.notifications FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant notifications"
  ON public.notifications FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- RLS policies for notification settings
CREATE POLICY "Users can view their tenant notification settings"
  ON public.tenant_notification_settings FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage notification settings"
  ON public.tenant_notification_settings FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Indexes for performance
CREATE INDEX idx_notifications_tenant_id ON public.notifications(tenant_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX idx_notifications_category ON public.notifications(category);
CREATE INDEX idx_tenant_notification_settings_tenant ON public.tenant_notification_settings(tenant_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger for updated_at on settings
CREATE TRIGGER update_tenant_notification_settings_updated_at
  BEFORE UPDATE ON public.tenant_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();