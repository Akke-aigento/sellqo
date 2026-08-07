ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS linked_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_linked_tenant_unique
  ON public.customers (linked_tenant_id)
  WHERE linked_tenant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.register_tenant_as_sellqo_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sellqo_tenant uuid := 'd03c63fe-48c6-4ff7-a30b-7506ea3e71ab';
  v_opt_in boolean;
BEGIN
  -- GUARD 1: anti-lus, de SellQo-tenant registreert zichzelf nooit
  IF NEW.id = v_sellqo_tenant THEN
    RETURN NEW;
  END IF;

  -- GUARD 2: zonder e-mail is er niks te registreren
  IF NEW.owner_email IS NULL OR btrim(NEW.owner_email) = '' THEN
    RETURN NEW;
  END IF;

  v_opt_in := COALESCE(NEW.platform_newsletter_opt_in, true);

  INSERT INTO public.customers (
    tenant_id, linked_tenant_id, email, company_name, first_name,
    customer_type, preferred_language, tags, email_subscribed, email_subscribed_at
  ) VALUES (
    v_sellqo_tenant, NEW.id, NEW.owner_email, NEW.name, NEW.owner_name,
    'b2b', COALESCE(NEW.language, 'nl'), ARRAY['tenant','sellqo-tenant'],
    v_opt_in, CASE WHEN v_opt_in THEN now() ELSE NULL END
  )
  ON CONFLICT (linked_tenant_id) WHERE linked_tenant_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS register_tenant_as_sellqo_customer_trigger ON public.tenants;
CREATE TRIGGER register_tenant_as_sellqo_customer_trigger
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.register_tenant_as_sellqo_customer();