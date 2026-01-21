-- Add Newsletter Module columns
ALTER TABLE public.tenant_theme_settings
ADD COLUMN IF NOT EXISTS newsletter_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS newsletter_provider text DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS newsletter_popup_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS newsletter_popup_delay_seconds integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS newsletter_incentive_text text;

-- Add Checkout Preferences columns
ALTER TABLE public.tenant_theme_settings
ADD COLUMN IF NOT EXISTS checkout_guest_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS checkout_phone_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS checkout_company_field text DEFAULT 'optional',
ADD COLUMN IF NOT EXISTS checkout_address_autocomplete boolean DEFAULT true;

-- Add Product Display columns
ALTER TABLE public.tenant_theme_settings
ADD COLUMN IF NOT EXISTS product_image_zoom text DEFAULT 'hover',
ADD COLUMN IF NOT EXISTS product_variant_style text DEFAULT 'buttons',
ADD COLUMN IF NOT EXISTS product_reviews_display text DEFAULT 'full',
ADD COLUMN IF NOT EXISTS product_stock_indicator boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS product_related_mode text DEFAULT 'auto';

-- Add Trust & Compliance columns
ALTER TABLE public.tenant_theme_settings
ADD COLUMN IF NOT EXISTS cookie_banner_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS cookie_banner_style text DEFAULT 'minimal',
ADD COLUMN IF NOT EXISTS trust_badges jsonb DEFAULT '[]'::jsonb;

-- Add Navigation Preferences columns
ALTER TABLE public.tenant_theme_settings
ADD COLUMN IF NOT EXISTS nav_style text DEFAULT 'simple',
ADD COLUMN IF NOT EXISTS header_sticky boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS search_display text DEFAULT 'visible',
ADD COLUMN IF NOT EXISTS mobile_bottom_nav boolean DEFAULT false;

-- Add Conversion Features columns
ALTER TABLE public.tenant_theme_settings
ADD COLUMN IF NOT EXISTS show_stock_count boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_viewers_count boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_recent_purchases boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS exit_intent_popup boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.tenant_theme_settings.newsletter_provider IS 'Newsletter provider: internal, mailchimp, klaviyo';
COMMENT ON COLUMN public.tenant_theme_settings.checkout_company_field IS 'Company field visibility: hidden, optional, required';
COMMENT ON COLUMN public.tenant_theme_settings.product_image_zoom IS 'Image zoom type: hover, click, lightbox, none';
COMMENT ON COLUMN public.tenant_theme_settings.product_variant_style IS 'Variant display: dropdown, swatches, buttons';
COMMENT ON COLUMN public.tenant_theme_settings.product_reviews_display IS 'Reviews display: full, stars_only, hidden';
COMMENT ON COLUMN public.tenant_theme_settings.product_related_mode IS 'Related products: auto, manual, off';
COMMENT ON COLUMN public.tenant_theme_settings.cookie_banner_style IS 'Cookie banner: minimal, detailed, popup';
COMMENT ON COLUMN public.tenant_theme_settings.nav_style IS 'Navigation style: simple, mega_menu';
COMMENT ON COLUMN public.tenant_theme_settings.search_display IS 'Search bar: visible, icon, hidden';