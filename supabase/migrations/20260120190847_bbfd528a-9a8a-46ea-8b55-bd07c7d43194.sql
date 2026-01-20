-- =============================================
-- FASE 5: MARKETING & TEAM NOTIFICATIES
-- =============================================

-- =============================================
-- DEEL A: MARKETING/CAMPAGNE NOTIFICATIES
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_campaign_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
BEGIN
  v_action_url := '/admin/marketing/campaigns/' || NEW.id;
  
  -- CAMPAGNE VERZONDEN (status wordt 'sending' of 'sent')
  IF TG_OP = 'UPDATE' 
     AND NEW.status = 'sending' 
     AND OLD.status != 'sending' THEN
    v_type := 'campaign_sent';
    v_title := 'Campagne gestart: ' || NEW.name;
    v_message := 'E-mailcampagne "' || NEW.name || '" wordt nu verzonden naar ' || COALESCE(NEW.total_recipients, 0) || ' ontvangers';
    v_priority := 'medium';
    
  -- CAMPAGNE VOLTOOID
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.status = 'sent' 
        AND OLD.status = 'sending' THEN
    v_type := 'campaign_completed';
    v_title := 'Campagne voltooid: ' || NEW.name;
    v_message := 'E-mailcampagne "' || NEW.name || '" is succesvol verzonden naar ' 
                 || COALESCE(NEW.total_delivered, 0) || ' ontvangers';
    v_priority := 'low';
    
  -- CAMPAGNE GEFAALD (veel bounces)
  ELSIF TG_OP = 'UPDATE' 
        AND NEW.total_bounced > 0
        AND COALESCE(OLD.total_bounced, 0) = 0
        AND NEW.total_recipients > 0
        AND (NEW.total_bounced::float / NEW.total_recipients::float) > 0.1 THEN
    v_type := 'campaign_high_bounce';
    v_title := 'Hoge bounce rate: ' || NEW.name;
    v_message := 'Campagne "' || NEW.name || '" heeft ' || NEW.total_bounced 
                 || ' bounces (' || ROUND((NEW.total_bounced::float / NEW.total_recipients::float * 100)::numeric, 1) || '%)';
    v_priority := 'high';
    
  ELSE
    RETURN NEW;
  END IF;
  
  PERFORM public.send_notification(
    NEW.tenant_id,
    'marketing',
    v_type,
    v_title,
    v_message,
    v_priority,
    v_action_url,
    jsonb_build_object(
      'campaign_id', NEW.id,
      'campaign_name', NEW.name,
      'total_recipients', NEW.total_recipients,
      'total_delivered', NEW.total_delivered,
      'total_opened', NEW.total_opened,
      'total_clicked', NEW.total_clicked,
      'total_bounced', NEW.total_bounced,
      'status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger voor campagnes
CREATE TRIGGER trigger_campaign_notification
  AFTER UPDATE OF status, total_bounced
  ON public.email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_campaign_notification();

-- =============================================
-- DEEL B: TEAM NOTIFICATIES
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_team_invitation_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
  v_role_display TEXT;
BEGIN
  v_action_url := '/admin/settings?tab=team';
  
  -- Rol weergavenaam
  v_role_display := CASE NEW.role
    WHEN 'tenant_admin' THEN 'Administrator'
    WHEN 'accountant' THEN 'Boekhouder'
    WHEN 'warehouse' THEN 'Magazijn'
    WHEN 'staff' THEN 'Medewerker'
    WHEN 'viewer' THEN 'Alleen-lezen'
    ELSE NEW.role
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
      'role', NEW.role,
      'role_display', v_role_display
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger voor team uitnodigingen
CREATE TRIGGER trigger_team_invitation_notification
  AFTER INSERT OR UPDATE OF accepted_at
  ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_team_invitation_notification();