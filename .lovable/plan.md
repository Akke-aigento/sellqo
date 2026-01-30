
# Plan: Fix Alle Field Mapping Fouten in Shopify Trigger

## Probleem Gevonden 🔍

De database trigger `handle_shopify_request_notification` gebruikt velden die **niet bestaan** in de `shopify_connection_requests` tabel:

| Trigger probeert te lezen | Bestaat in tabel? | Correcte bron |
|---------------------------|-------------------|---------------|
| `NEW.contact_name` | ❌ **NEE** | Gebruik `v_tenant_name` (via tenants lookup) |
| `NEW.contact_email` | ❌ **NEE** | Gebruik `v_tenant_email` (via tenants lookup) |
| `NEW.store_url` | ✅ Ja | Maar kan NULL zijn bij insert → fallback naar `store_name || '.myshopify.com'` |
| `NEW.store_name` | ✅ Ja | OK |
| `NEW.notes` | ✅ Ja | OK |

## Oplossing

**1. Database Migratie** - Volledige herschrijving van de trigger functie:

```text
┌─────────────────────────────────────────────────────────────────┐
│ BEFORE (FOUT)                                                   │
├─────────────────────────────────────────────────────────────────┤
│ INSERT INTO support_tickets (...)                               │
│ VALUES (                                                        │
│   ...,                                                          │
│   'contact_name', NEW.contact_name,  ← BESTAAT NIET!            │
│   'contact_email', NEW.contact_email ← BESTAAT NIET!            │
│ )                                                               │
├─────────────────────────────────────────────────────────────────┤
│ AFTER (CORRECT)                                                 │
├─────────────────────────────────────────────────────────────────┤
│ -- Haal tenant info op (bestaat al)                             │
│ v_store_url := COALESCE(NEW.store_url,                          │
│                         NEW.store_name || '.myshopify.com');    │
│                                                                 │
│ INSERT INTO support_tickets (...)                               │
│ VALUES (                                                        │
│   ...,                                                          │
│   'contact_name', v_tenant_name,      ← UIT TENANTS             │
│   'contact_email', v_tenant_email     ← UIT TENANTS             │
│ )                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Wijzigingen

| Onderdeel | Wijziging |
|-----------|-----------|
| Trigger functie | Vervang alle `NEW.contact_*` referenties door tenant-derived variabelen |
| `store_url` handling | Fallback naar `store_name || '.myshopify.com'` als NULL |
| Support message | Gebruik `v_tenant_name` en `v_tenant_email` |

## Technische Details

De complete functie wordt:

```sql
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_name TEXT;
  v_tenant_email TEXT;
  v_store_url TEXT;
  v_ticket_id UUID;
  v_message_id UUID;
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Build store URL from store_name if not provided
  v_store_url := COALESCE(
    NULLIF(NEW.store_url, ''), 
    NEW.store_name || '.myshopify.com'
  );

  -- Get tenant info with fallback emails
  SELECT 
    COALESCE(name, 'Onbekende tenant'),
    COALESCE(notification_email, billing_email, owner_email, 'no-email@sellqo.nl')
  INTO v_tenant_name, v_tenant_email
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- Create support ticket (NO contact_name/contact_email from NEW)
  INSERT INTO public.support_tickets (
    tenant_id, subject, status, priority, category, metadata
  ) VALUES (
    NEW.tenant_id,
    'Shopify Koppelverzoek: ' || v_store_url,
    'open', 'medium', 'integration',
    jsonb_build_object(
      'type', 'shopify_connection_request',
      'request_id', NEW.id,
      'store_name', NEW.store_name,
      'store_url', v_store_url,
      'tenant_name', v_tenant_name,
      'tenant_email', v_tenant_email,
      'notes', NEW.notes
    )
  ) RETURNING id INTO v_ticket_id;

  -- Create message using tenant info (NOT NEW.contact_*)
  INSERT INTO public.support_messages (
    ticket_id, sender_type, sender_name, content
  ) VALUES (
    v_ticket_id,
    'customer',
    v_tenant_name,
    'Shopify koppelverzoek ingediend.' || E'\n\n' ||
    '**Winkel URL:** ' || v_store_url || E'\n' ||
    '**Contact:** ' || v_tenant_name || ' (' || v_tenant_email || ')' ||
    CASE WHEN NEW.notes IS NOT NULL AND NEW.notes != '' 
      THEN E'\n\n**Opmerkingen:**\n' || NEW.notes 
      ELSE '' 
    END
  );

  -- Send notification
  PERFORM public.send_notification(
    NEW.tenant_id, 'integrations', 'shopify_request_received',
    'Shopify koppelverzoek ontvangen',
    'We hebben je verzoek ontvangen om ' || v_store_url || 
    ' te koppelen. We nemen binnen 1-2 werkdagen contact op.',
    'low',
    '/admin/support/tickets/' || v_ticket_id,
    jsonb_build_object(
      'request_id', NEW.id,
      'ticket_id', v_ticket_id,
      'store_url', v_store_url
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Na Implementatie

1. **Publish** de app zodat de fix naar Live gaat
2. Test opnieuw op sellqo.app
3. Het koppelverzoek moet nu succesvol worden ingediend

## Risico's Afgevangen

- Tenant zonder email → fallback naar `no-email@sellqo.nl`
- `store_url` is NULL → automatisch gegenereerd uit `store_name`
- Geen `contact_name`/`contact_email` velden meer nodig
