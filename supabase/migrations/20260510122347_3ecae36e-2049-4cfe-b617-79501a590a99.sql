CREATE TABLE public.user_label_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  preferred_format TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

ALTER TABLE public.user_label_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own label preference"
  ON public.user_label_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert own label preference"
  ON public.user_label_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update own label preference"
  ON public.user_label_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (user_id = auth.uid() AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete own label preference"
  ON public.user_label_preferences FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Service role full access on user_label_preferences"
  ON public.user_label_preferences FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_updated_at_user_label_preferences
  BEFORE UPDATE ON public.user_label_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_label_pref_user_tenant ON public.user_label_preferences(user_id, tenant_id);