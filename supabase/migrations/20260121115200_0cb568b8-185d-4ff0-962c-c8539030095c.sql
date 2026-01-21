-- =============================================
-- STOREFRONT & THEME SYSTEM TABLES
-- =============================================

-- Table 1: themes - Available theme templates
CREATE TABLE public.themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  preview_image_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  default_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

-- Themes are readable by everyone (public catalog)
CREATE POLICY "Themes are publicly readable"
  ON public.themes FOR SELECT
  USING (is_active = true);

-- Table 2: tenant_theme_settings - Per-tenant customization
CREATE TABLE public.tenant_theme_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  theme_id UUID REFERENCES public.themes(id),
  
  -- Custom Frontend option
  use_custom_frontend BOOLEAN DEFAULT false,
  custom_frontend_url TEXT,
  
  -- Branding
  logo_url TEXT,
  favicon_url TEXT,
  
  -- Colors (override theme defaults)
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  background_color TEXT,
  text_color TEXT,
  
  -- Typography
  heading_font TEXT DEFAULT 'Inter',
  body_font TEXT DEFAULT 'Inter',
  
  -- Layout options
  header_style TEXT DEFAULT 'standard',
  show_announcement_bar BOOLEAN DEFAULT false,
  announcement_text TEXT,
  announcement_link TEXT,
  show_breadcrumbs BOOLEAN DEFAULT true,
  show_wishlist BOOLEAN DEFAULT true,
  product_card_style TEXT DEFAULT 'standard',
  products_per_row INTEGER DEFAULT 4,
  
  -- Footer
  footer_text TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  
  -- Advanced
  custom_css TEXT,
  custom_head_scripts TEXT,
  
  -- Publishing
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_theme_settings ENABLE ROW LEVEL SECURITY;

-- Tenant members can manage their theme settings (using existing get_user_tenant_ids function)
CREATE POLICY "Tenant members can view theme settings"
  ON public.tenant_theme_settings FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert theme settings"
  ON public.tenant_theme_settings FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can update theme settings"
  ON public.tenant_theme_settings FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Public read for storefront rendering
CREATE POLICY "Published theme settings are publicly readable"
  ON public.tenant_theme_settings FOR SELECT
  USING (is_published = true);

-- Table 3: storefront_pages - Static pages (Contact, About, FAQ, etc.)
CREATE TABLE public.storefront_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  meta_title TEXT,
  meta_description TEXT,
  is_published BOOLEAN DEFAULT true,
  show_in_nav BOOLEAN DEFAULT true,
  nav_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.storefront_pages ENABLE ROW LEVEL SECURITY;

-- Tenant members can manage pages
CREATE POLICY "Tenant members can view pages"
  ON public.storefront_pages FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert pages"
  ON public.storefront_pages FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can update pages"
  ON public.storefront_pages FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can delete pages"
  ON public.storefront_pages FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Public read for published pages
CREATE POLICY "Published pages are publicly readable"
  ON public.storefront_pages FOR SELECT
  USING (is_published = true);

-- Table 4: homepage_sections - Drag & drop homepage blocks
CREATE TABLE public.homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  section_type TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  content JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

-- Tenant members can manage sections
CREATE POLICY "Tenant members can view sections"
  ON public.homepage_sections FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert sections"
  ON public.homepage_sections FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can update sections"
  ON public.homepage_sections FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can delete sections"
  ON public.homepage_sections FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Public read for visible sections
CREATE POLICY "Visible sections are publicly readable"
  ON public.homepage_sections FOR SELECT
  USING (is_visible = true);

-- Add domain verification fields to tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS domain_verification_token TEXT;

-- Create updated_at triggers
CREATE TRIGGER update_tenant_theme_settings_updated_at
  BEFORE UPDATE ON public.tenant_theme_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_storefront_pages_updated_at
  BEFORE UPDATE ON public.storefront_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_homepage_sections_updated_at
  BEFORE UPDATE ON public.homepage_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 3 starter themes
INSERT INTO public.themes (slug, name, description, preview_image_url, default_settings) VALUES
(
  'modern',
  'Modern',
  'Minimalistisch design met veel witruimte. Perfect voor fashion, design en lifestyle merken.',
  NULL,
  '{
    "header_style": "centered",
    "product_card_style": "minimal",
    "products_per_row": 4,
    "show_breadcrumbs": true,
    "show_wishlist": true,
    "primary_color": "#000000",
    "secondary_color": "#666666",
    "accent_color": "#0ea5e9",
    "background_color": "#ffffff",
    "text_color": "#1a1a1a",
    "heading_font": "Inter",
    "body_font": "Inter"
  }'::jsonb
),
(
  'classic',
  'Classic',
  'Traditionele webshop met sidebar navigatie. Ideaal voor winkels met veel producten en categorieën.',
  NULL,
  '{
    "header_style": "standard",
    "product_card_style": "standard",
    "products_per_row": 3,
    "show_breadcrumbs": true,
    "show_wishlist": true,
    "primary_color": "#1e40af",
    "secondary_color": "#3b82f6",
    "accent_color": "#f59e0b",
    "background_color": "#f8fafc",
    "text_color": "#1e293b",
    "heading_font": "Playfair Display",
    "body_font": "Open Sans"
  }'::jsonb
),
(
  'bold',
  'Bold',
  'Statement design voor premium producten. Grote visuals en opvallende typografie.',
  NULL,
  '{
    "header_style": "minimal",
    "product_card_style": "detailed",
    "products_per_row": 2,
    "show_breadcrumbs": false,
    "show_wishlist": true,
    "primary_color": "#dc2626",
    "secondary_color": "#1f2937",
    "accent_color": "#fbbf24",
    "background_color": "#0f0f0f",
    "text_color": "#ffffff",
    "heading_font": "Montserrat",
    "body_font": "Roboto"
  }'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_tenant_theme_settings_tenant ON public.tenant_theme_settings(tenant_id);
CREATE INDEX idx_storefront_pages_tenant_slug ON public.storefront_pages(tenant_id, slug);
CREATE INDEX idx_homepage_sections_tenant_order ON public.homepage_sections(tenant_id, sort_order);