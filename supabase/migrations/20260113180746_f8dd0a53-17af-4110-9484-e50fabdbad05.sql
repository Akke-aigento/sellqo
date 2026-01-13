-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tenant_id, slug)
);

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  
  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  
  -- Inventory
  sku TEXT,
  barcode TEXT,
  stock INTEGER DEFAULT 0,
  track_inventory BOOLEAN DEFAULT true,
  allow_backorder BOOLEAN DEFAULT false,
  low_stock_threshold INTEGER DEFAULT 5,
  
  -- Media
  images TEXT[] DEFAULT '{}',
  featured_image TEXT,
  
  -- Organization
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Shipping
  weight DECIMAL(10,2),
  requires_shipping BOOLEAN DEFAULT true,
  
  -- Meta
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tenant_id, slug)
);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR CATEGORIES
-- ============================================
CREATE POLICY "Users can view their tenant's categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Platform admins can view all categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can insert categories for their tenant"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Platform admins can insert any category"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can update their tenant's categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Platform admins can update any category"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can delete their tenant's categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_role(auth.uid(), 'tenant_admin')
  );

CREATE POLICY "Platform admins can delete any category"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- ============================================
-- RLS POLICIES FOR PRODUCTS
-- ============================================
CREATE POLICY "Users can view their tenant's products"
  ON public.products FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Platform admins can view all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can insert products for their tenant"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Platform admins can insert any product"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can update their tenant's products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Platform admins can update any product"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can delete their tenant's products"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_role(auth.uid(), 'tenant_admin')
  );

CREATE POLICY "Platform admins can delete any product"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active ON public.products(tenant_id, is_active);
CREATE INDEX idx_products_slug ON public.products(tenant_id, slug);
CREATE INDEX idx_categories_tenant ON public.categories(tenant_id);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);
CREATE INDEX idx_categories_slug ON public.categories(tenant_id, slug);

-- ============================================
-- STORAGE BUCKET FOR PRODUCT IMAGES
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 
  'product-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Storage policies
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update their uploaded images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');