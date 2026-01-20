-- Add new columns to ai_generated_images for product enhancement feature
ALTER TABLE public.ai_generated_images 
ADD COLUMN IF NOT EXISTS source_image_url TEXT,
ADD COLUMN IF NOT EXISTS source_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS enhancement_type TEXT CHECK (enhancement_type IN ('generate', 'enhance', 'background_remove', 'overlay')),
ADD COLUMN IF NOT EXISTS marketing_text TEXT,
ADD COLUMN IF NOT EXISTS platform_preset TEXT CHECK (platform_preset IN ('instagram_post', 'instagram_story', 'facebook_banner', 'email_header', 'linkedin_post', 'custom')),
ADD COLUMN IF NOT EXISTS setting_preset TEXT;

-- Create index for faster product lookups
CREATE INDEX IF NOT EXISTS idx_ai_generated_images_product ON public.ai_generated_images(source_product_id) WHERE source_product_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.ai_generated_images.enhancement_type IS 'Type of image generation: generate (new), enhance (edit existing), background_remove, overlay (add text)';
COMMENT ON COLUMN public.ai_generated_images.platform_preset IS 'Target platform format for the generated image';