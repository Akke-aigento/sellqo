ALTER TABLE public.nano_image_jobs
  ADD COLUMN IF NOT EXISTS source_image_urls text[] DEFAULT NULL;