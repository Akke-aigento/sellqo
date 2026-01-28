-- Fix 1: Update trigger function to use TEXT casting to prevent enum casting errors
CREATE OR REPLACE FUNCTION public.handle_team_invitation_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
  v_role_display TEXT;
BEGIN
  v_action_url := '/admin/settings?tab=team';
  
  -- Rol weergavenaam - explicitly cast to TEXT to avoid enum casting issues
  v_role_display := CASE NEW.role::text
    WHEN 'tenant_admin' THEN 'Administrator'
    WHEN 'accountant' THEN 'Boekhouder'
    WHEN 'warehouse' THEN 'Magazijn'
    WHEN 'staff' THEN 'Medewerker'
    WHEN 'viewer' THEN 'Alleen-lezen'
    ELSE NEW.role::text
  END;
  
  -- NIEUWE UITNODIGING
  IF TG_OP = 'INSERT' THEN
    v_type := 'team_member_invited';
    v_title := 'Teamlid uitgenodigd';
    v_message := NEW.email || ' is uitgenodigd als ' || v_role_display;
    v_priority := 'low';
    
  -- UITNODIGING GEACCEPTEERD
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.accepted_at IS NOT NULL 
        AND OLD.accepted_at IS NULL THEN
    v_type := 'team_member_joined';
    v_title := 'Teamlid toegetreden';
    v_message := NEW.email || ' heeft de uitnodiging geaccepteerd als ' || v_role_display;
    v_priority := 'medium';
    
  ELSE
    RETURN NEW;
  END IF;
  
  PERFORM public.send_notification(
    NEW.tenant_id,
    'team',
    v_type,
    v_title,
    v_message,
    v_priority,
    v_action_url,
    jsonb_build_object(
      'invitation_id', NEW.id,
      'email', NEW.email,
      'role', NEW.role::text,
      'role_display', v_role_display
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Fix 2: Drop existing restrictive policy and create new one that supports platform admins
DROP POLICY IF EXISTS "Tenant admins can manage invitations" ON public.team_invitations;

CREATE POLICY "Admins can manage invitations"
ON public.team_invitations
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = team_invitations.tenant_id 
    AND ur.role = 'tenant_admin'
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.tenant_id = team_invitations.tenant_id 
    AND ur.role = 'tenant_admin'
  )
);