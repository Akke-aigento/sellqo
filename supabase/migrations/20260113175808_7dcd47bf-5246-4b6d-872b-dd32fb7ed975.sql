-- ============================================
-- APP ROLES ENUM
-- ============================================
CREATE TYPE public.app_role AS ENUM ('platform_admin', 'tenant_admin', 'staff');

-- ============================================
-- TENANTS (Klanten/Winkels)
-- ============================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  
  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1e40af',
  
  -- Business info
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'NL',
  kvk_number TEXT,
  btw_number TEXT,
  
  -- Platform
  subscription_status TEXT DEFAULT 'trial',
  subscription_plan TEXT DEFAULT 'starter',
  stripe_account_id TEXT,
  custom_domain TEXT,
  
  -- Settings
  currency TEXT DEFAULT 'EUR',
  shipping_enabled BOOLEAN DEFAULT true,
  tax_percentage DECIMAL(5,2) DEFAULT 21.00,
  
  -- Meta
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- USER ROLES (Security Definer Pattern)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role, tenant_id)
);

-- ============================================
-- PROFILES (voor extra user info)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SECURITY DEFINER FUNCTIONS (voorkomt RLS recursie)
-- ============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'platform_admin'
  )
$$;

-- Get user's tenant IDs
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND tenant_id IS NOT NULL
$$;

-- Get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'platform_admin' THEN 1 
      WHEN 'tenant_admin' THEN 2 
      WHEN 'staff' THEN 3 
    END
  LIMIT 1
$$;

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR TENANTS
-- ============================================

-- Platform admins can see all tenants
CREATE POLICY "Platform admins can view all tenants"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Tenant admins/staff can see their own tenant
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Platform admins can insert tenants
CREATE POLICY "Platform admins can insert tenants"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Platform admins can update any tenant
CREATE POLICY "Platform admins can update any tenant"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Tenant admins can update their own tenant
CREATE POLICY "Tenant admins can update their own tenant"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND public.has_role(auth.uid(), 'tenant_admin')
  );

-- Platform admins can delete tenants
CREATE POLICY "Platform admins can delete tenants"
  ON public.tenants FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- ============================================
-- RLS POLICIES FOR USER_ROLES
-- ============================================

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Platform admins can view all roles
CREATE POLICY "Platform admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Platform admins can manage roles
CREATE POLICY "Platform admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- ============================================
-- RLS POLICIES FOR PROFILES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INDEXES (voor snelheid)
-- ============================================
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);
CREATE INDEX idx_tenants_slug ON public.tenants(slug);