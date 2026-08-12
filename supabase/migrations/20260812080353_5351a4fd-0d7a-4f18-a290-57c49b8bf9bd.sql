CREATE OR REPLACE FUNCTION public.register_tenant_as_sellqo_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sellqo_tenant uuid := 'd03c63fe-48c6-4ff7-a30b-7506ea3e71ab';
  v_opt_in boolean;
BEGIN
  -- Anti-loop: the SellQo tenant never registers itself.
  IF NEW.id = v_sellqo_tenant THEN
    RETURN NEW;
  END IF;

  -- Nothing to register without an owner email.
  IF NEW.owner_email IS NULL OR btrim(NEW.owner_email) = '' THEN
    RETURN NEW;
  END IF;

  v_opt_in := COALESCE(NEW.platform_newsletter_opt_in, true);

  INSERT INTO public.customers (
    tenant_id,
    linked_tenant_id,
    email,
    company_name,
    first_name,
    customer_type,
    preferred_language,
    tags,
    email_subscribed,
    email_subscribed_at
  ) VALUES (
    v_sellqo_tenant,
    NEW.id,
    lower(btrim(NEW.owner_email)),
    NEW.name,
    NEW.owner_name,
    'b2b',
    COALESCE(NEW.language, 'nl'),
    ARRAY['tenant', 'sellqo-tenant'],
    v_opt_in,
    CASE WHEN v_opt_in THEN now() ELSE NULL END
  )
  ON CONFLICT ON CONSTRAINT customers_tenant_id_email_key
  DO UPDATE SET
    linked_tenant_id = COALESCE(public.customers.linked_tenant_id, EXCLUDED.linked_tenant_id),
    company_name = COALESCE(public.customers.company_name, EXCLUDED.company_name),
    first_name = COALESCE(public.customers.first_name, EXCLUDED.first_name),
    tags = (
      SELECT ARRAY(
        SELECT DISTINCT tag
        FROM unnest(COALESCE(public.customers.tags, ARRAY[]::text[]) || EXCLUDED.tags) AS tag
      )
    );

  RETURN NEW;
END;
$function$;