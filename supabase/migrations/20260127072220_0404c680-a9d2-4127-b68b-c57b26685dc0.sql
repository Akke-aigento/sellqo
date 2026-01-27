-- Add inbound email fields to tenants table
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS inbound_email_prefix TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS inbound_email_enabled BOOLEAN DEFAULT false;

-- Set default prefix from slug for existing tenants
UPDATE tenants 
SET inbound_email_prefix = slug 
WHERE inbound_email_prefix IS NULL AND slug IS NOT NULL;

-- Create function to auto-set inbound prefix for new tenants
CREATE OR REPLACE FUNCTION public.set_default_inbound_prefix()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.inbound_email_prefix IS NULL AND NEW.slug IS NOT NULL THEN
    NEW.inbound_email_prefix := NEW.slug;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for new tenants
DROP TRIGGER IF EXISTS set_inbound_prefix_trigger ON tenants;
CREATE TRIGGER set_inbound_prefix_trigger
  BEFORE INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_inbound_prefix();