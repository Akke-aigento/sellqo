ALTER TABLE public.nano_image_jobs
  ADD COLUMN IF NOT EXISTS output_format text NOT NULL DEFAULT 'jpeg';

UPDATE public.nano_image_jobs SET output_format = 'png' WHERE created_at < now();