
ALTER TABLE public.tenant_theme_settings 
ADD COLUMN storefront_status text NOT NULL DEFAULT 'online',
ADD COLUMN storefront_password text;

-- Add check constraint via trigger for flexibility
CREATE OR REPLACE FUNCTION public.validate_storefront_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.storefront_status NOT IN ('online', 'password', 'offline') THEN
    RAISE EXCEPTION 'Invalid storefront_status: %. Must be online, password, or offline.', NEW.storefront_status;
  END IF;
  IF NEW.storefront_status = 'password' AND (NEW.storefront_password IS NULL OR NEW.storefront_password = '') THEN
    RAISE EXCEPTION 'storefront_password is required when storefront_status is password';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_storefront_status_trigger
BEFORE INSERT OR UPDATE ON public.tenant_theme_settings
FOR EACH ROW
EXECUTE FUNCTION public.validate_storefront_status();
