-- Create team_invitations table (without CHECK constraint, enum handles validation)
CREATE TABLE public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'staff',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenant admins can manage invitations for their tenant
CREATE POLICY "Tenant admins can manage invitations"
ON public.team_invitations
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('tenant_admin', 'platform_admin')
  )
);

-- RLS policy: allow reading own pending invitation by email
CREATE POLICY "Users can view their own invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (
  LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Index for faster lookups
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_tenant ON public.team_invitations(tenant_id);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);