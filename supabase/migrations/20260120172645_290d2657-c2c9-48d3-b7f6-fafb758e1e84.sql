-- Fix overly permissive RLS policies

-- Drop the overly permissive INSERT policy on notifications
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Create a proper INSERT policy that checks tenant membership
CREATE POLICY "Users can insert notifications for their tenant"
  ON public.notifications FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Drop the ALL policy on notification settings and create specific ones
DROP POLICY IF EXISTS "Tenant admins can manage notification settings" ON public.tenant_notification_settings;

-- Create specific policies for each operation
CREATE POLICY "Users can insert notification settings for their tenant"
  ON public.tenant_notification_settings FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant notification settings"
  ON public.tenant_notification_settings FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant notification settings"
  ON public.tenant_notification_settings FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));