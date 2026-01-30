
# Plan: Fix Shopify Koppelverzoek Error - Ontbrekende Kolommen

## Probleem

Bij het indienen van een Shopify koppelverzoek verschijnt de fout:
> "Kon verzoek niet indienen: record "new" has no field "contact_email""

## Oorzaak

De database trigger `handle_shopify_request_notification` refereert naar velden die niet bestaan in de `shopify_connection_requests` tabel:

| Veld in Trigger | Bestaat in Tabel? |
|-----------------|-------------------|
| `NEW.contact_email` | ❌ Nee |
| `NEW.request_type` | ❌ Nee |

De trigger werd gemaakt met de aanname dat deze velden zouden bestaan, maar de tabel heeft alleen:
`id, tenant_id, store_name, store_url, status, notes, admin_notes, install_link, requested_at, reviewed_at, completed_at, created_at, updated_at`

## Oplossing

Update de trigger functie om de ontbrekende velden te vervangen door bestaande gegevens:

```sql
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket_id UUID;
  v_tenant_name TEXT;
  v_tenant_email TEXT;
  v_platform_tenant_id UUID;
BEGIN
  -- Get platform tenant (SellQo)
  SELECT id INTO v_platform_tenant_id FROM tenants WHERE slug = 'sellqo' LIMIT 1;
  
  IF v_platform_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get tenant name and contact email from tenants table
  SELECT name, contact_email INTO v_tenant_name, v_tenant_email 
  FROM tenants WHERE id = NEW.tenant_id;
  
  -- Create support ticket for the request
  INSERT INTO support_tickets (
    tenant_id,
    requester_email,
    requester_name,
    subject,
    status,
    priority,
    category,
    related_resource_type,
    related_resource_id,
    metadata
  ) VALUES (
    v_platform_tenant_id,
    COALESCE(v_tenant_email, 'no-email@sellqo.nl'),  -- Gebruik tenant email in plaats van NEW.contact_email
    COALESCE(v_tenant_name, 'Onbekende tenant'),
    'Shopify koppeling aanvraag: ' || NEW.store_name || '.myshopify.com',
    'open',
    'medium',
    'integration',
    'shopify_connection_request',
    NEW.id,
    jsonb_build_object(
      'store_name', NEW.store_name,
      'tenant_id', NEW.tenant_id,
      'tenant_name', v_tenant_name,
      'notes', NEW.notes  -- Gebruik notes in plaats van request_type
    )
  ) RETURNING id INTO v_ticket_id;
  
  -- Create initial system message
  INSERT INTO support_messages (
    ticket_id,
    sender_type,
    message,
    is_internal_note
  ) VALUES (
    v_ticket_id,
    'system',
    'Nieuwe Shopify koppelingsaanvraag ontvangen van ' || COALESCE(v_tenant_name, 'onbekende tenant') || 
    ' voor store: ' || NEW.store_name || '.myshopify.com' ||
    CASE WHEN NEW.notes IS NOT NULL THEN E'\n\nOpmerkingen: ' || NEW.notes ELSE '' END,
    false
  );
  
  -- Send notification to platform admins
  PERFORM public.send_notification(
    v_platform_tenant_id,
    'integrations',
    'shopify_request_new',
    'Nieuwe Shopify aanvraag',
    'Nieuwe koppelingsaanvraag van ' || COALESCE(v_tenant_name, 'onbekende tenant') || ' voor ' || NEW.store_name || '.myshopify.com',
    'high',
    '/platform/support?ticket=' || v_ticket_id,
    jsonb_build_object(
      'request_id', NEW.id,
      'ticket_id', v_ticket_id,
      'store_name', NEW.store_name,
      'tenant_name', v_tenant_name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

## Wijzigingen

1. **`NEW.contact_email`** → Vervang door `v_tenant_email` (opgehaald uit de `tenants` tabel)
2. **`NEW.request_type`** → Vervang door `NEW.notes` (de opmerkingen van de gebruiker)

## Technische Details

| Resource | Wijziging |
|----------|-----------|
| Database migratie | Update `handle_shopify_request_notification` functie |

## Resultaat

- ✅ Koppelverzoeken kunnen weer worden ingediend
- ✅ Support ticket wordt aangemaakt met tenant email uit de tenants tabel
- ✅ Opmerkingen van de gebruiker worden opgenomen in het ticket
