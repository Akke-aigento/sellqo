-- 1. Add INSERT policy for ai_assistant_config
CREATE POLICY "Tenant admins can insert config" 
ON public.ai_assistant_config
FOR INSERT 
TO public
WITH CHECK (
  tenant_id IN (
    SELECT user_roles.tenant_id
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['tenant_admin'::app_role, 'platform_admin'::app_role])
  )
);

-- 2. Create function to auto-initialize config for new tenants
CREATE OR REPLACE FUNCTION public.ensure_ai_assistant_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO ai_assistant_config (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Add trigger to create config when tenant is created
CREATE TRIGGER trigger_ensure_ai_assistant_config
AFTER INSERT ON tenants
FOR EACH ROW
EXECUTE FUNCTION ensure_ai_assistant_config();

-- 4. Initialize config for existing tenants that don't have one
INSERT INTO ai_assistant_config (tenant_id)
SELECT id FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM ai_assistant_config ac WHERE ac.tenant_id = t.id
)
ON CONFLICT (tenant_id) DO NOTHING;