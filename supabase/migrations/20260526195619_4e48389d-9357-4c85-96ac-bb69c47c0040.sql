
CREATE OR REPLACE FUNCTION public.sync_oss_tenant_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Prefer whichever value is non-null
    NEW.oss_enabled := COALESCE(NEW.oss_enabled, NEW.apply_oss_rules, false);
    NEW.apply_oss_rules := COALESCE(NEW.apply_oss_rules, NEW.oss_enabled, false);
    NEW.oss_activation_date := COALESCE(NEW.oss_activation_date, NEW.oss_registration_date);
    NEW.oss_registration_date := COALESCE(NEW.oss_registration_date, NEW.oss_activation_date);
    RETURN NEW;
  END IF;

  -- UPDATE: mirror whichever side changed
  IF NEW.apply_oss_rules IS DISTINCT FROM OLD.apply_oss_rules THEN
    NEW.oss_enabled := NEW.apply_oss_rules;
  ELSIF NEW.oss_enabled IS DISTINCT FROM OLD.oss_enabled THEN
    NEW.apply_oss_rules := NEW.oss_enabled;
  END IF;

  IF NEW.oss_registration_date IS DISTINCT FROM OLD.oss_registration_date THEN
    NEW.oss_activation_date := NEW.oss_registration_date;
  ELSIF NEW.oss_activation_date IS DISTINCT FROM OLD.oss_activation_date THEN
    NEW.oss_registration_date := NEW.oss_activation_date;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sync_oss_tenant_columns_trigger ON public.tenants;
CREATE TRIGGER sync_oss_tenant_columns_trigger
BEFORE INSERT OR UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.sync_oss_tenant_columns();

-- Backfill existing rows
UPDATE public.tenants SET
  oss_enabled = COALESCE(oss_enabled, apply_oss_rules, false),
  apply_oss_rules = COALESCE(apply_oss_rules, oss_enabled, false),
  oss_activation_date = COALESCE(oss_activation_date, oss_registration_date),
  oss_registration_date = COALESCE(oss_registration_date, oss_activation_date);
