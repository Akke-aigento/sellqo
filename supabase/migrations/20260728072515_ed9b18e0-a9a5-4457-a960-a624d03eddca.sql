CREATE TABLE IF NOT EXISTS public.nano_image_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id           text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  prompt            text NOT NULL,
  model             text NOT NULL,
  mode              text NOT NULL,
  source_image_url  text,
  aspect_ratio      text,
  resolution        text,
  credits_used      integer,
  result_url        text,
  storage_path      text,
  error_message     text,
  source_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nano_image_jobs TO authenticated;
GRANT ALL ON public.nano_image_jobs TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nano_jobs_task ON public.nano_image_jobs (task_id);
CREATE INDEX IF NOT EXISTS idx_nano_jobs_tenant_status
  ON public.nano_image_jobs (tenant_id, status, created_at DESC);

ALTER TABLE public.nano_image_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nano_jobs_platform_admin_all" ON public.nano_image_jobs;
CREATE POLICY "nano_jobs_platform_admin_all" ON public.nano_image_jobs
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));