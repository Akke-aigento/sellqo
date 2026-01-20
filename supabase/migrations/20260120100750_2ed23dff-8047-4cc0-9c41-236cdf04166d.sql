-- Database functions for incrementing campaign stats
CREATE OR REPLACE FUNCTION public.increment_campaign_delivered(p_campaign_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_campaigns
  SET total_delivered = COALESCE(total_delivered, 0) + 1,
      updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_opened(p_campaign_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_campaigns
  SET total_opened = COALESCE(total_opened, 0) + 1,
      updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_clicked(p_campaign_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_campaigns
  SET total_clicked = COALESCE(total_clicked, 0) + 1,
      updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_bounced(p_campaign_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_campaigns
  SET total_bounced = COALESCE(total_bounced, 0) + 1,
      updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;