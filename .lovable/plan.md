
# Plan: Uniforme Platform Communicatie Flow via Support Tickets

## Huidige Situatie

### Problemen
1. **404 op notificatie link** - `/admin/platform/shopify-requests` bestaat niet
2. **Geen uniforme communicatie flow** - Shopify requests, feedback, en andere platform-level zaken hebben allemaal aparte flows
3. **Geen mogelijkheid tot dialoog** - Bij een Shopify verzoek kan de platform admin niet direct communiceren met de merchant

### Wat We Hebben
- Een volwassen **Support Ticket systeem** met:
  - Status workflow (open → in_progress → waiting → resolved → closed)
  - Messaging systeem met sender types (merchant, support, system, ai)
  - Categorieën: billing, technical, feature, bug, other
  - Platform admin UI op `/admin/platform/support`
  - Tenant koppeling via `tenant_id`

## Oplossing: Support Tickets als Centrale Hub

De kern van het idee: **Elk platform-level verzoek dat communicatie vereist wordt automatisch een support ticket.**

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Platform Communicatie Flow                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Shopify Koppelverzoek    Feedback Melding    Andere Verzoeken     │
│          │                       │                    │             │
│          ▼                       ▼                    ▼             │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │              Support Ticket Systeem                      │     │
│   │  ┌─────────────────────────────────────────────────────┐ │     │
│   │  │ Categorieën:                                        │ │     │
│   │  │ • billing    • technical   • feature               │ │     │
│   │  │ • bug        • other                                │ │     │
│   │  │ • integration (NIEUW) ← Shopify, Bol, Amazon, etc  │ │     │
│   │  │ • feedback (NIEUW)                                  │ │     │
│   │  └─────────────────────────────────────────────────────┘ │     │
│   └──────────────────────────────────────────────────────────┘     │
│                              │                                      │
│                              ▼                                      │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │              Platform Support Inbox                      │     │
│   │  /admin/platform/support                                 │     │
│   │                                                          │     │
│   │  • Unified view van alle merchant communicatie          │     │
│   │  • Filter op categorie (integration, feedback, etc)     │     │
│   │  • Direct reageren en status bijwerken                  │     │
│   │  • Koppeling naar gerelateerde resources in metadata    │     │
│   └──────────────────────────────────────────────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Voordelen

| Aspect | Huidige Situatie | Na Implementatie |
|--------|------------------|------------------|
| **Shopify verzoek** | Notificatie → 404 | Notificatie → Support ticket met metadata |
| **Communicatie** | Aparte kanalen per type | Alles in één inbox |
| **Tracking** | Geen status historie | Volledige ticket lifecycle |
| **Merchant view** | Alleen status badges | Ticket gesprek + status updates |
| **Context** | Verspreid over systemen | Alles in één plek met metadata links |

## Technische Implementatie

### 1. Database Wijzigingen

**Nieuwe ticket categorieën:**
```sql
ALTER TYPE support_ticket_category ADD VALUE 'integration';
ALTER TYPE support_ticket_category ADD VALUE 'feedback';
```

**Koppeling tabel (optioneel, voor referentie):**
```sql
-- Voegt een kolom toe om het gerelateerde resource type/id op te slaan
ALTER TABLE support_tickets ADD COLUMN related_resource_type TEXT;
ALTER TABLE support_tickets ADD COLUMN related_resource_id UUID;
```

### 2. Trigger Aanpassing

Wijzig `handle_shopify_request_notification` om automatisch een support ticket aan te maken:

```sql
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
...
AS $$
DECLARE
  v_ticket_id UUID;
  v_internal_tenant_id UUID;
  v_tenant_name TEXT;
  v_tenant_email TEXT;
BEGIN
  -- Get tenant info
  SELECT name, owner_email INTO v_tenant_name, v_tenant_email 
  FROM tenants WHERE id = NEW.tenant_id;
  
  -- Get internal tenant
  SELECT id INTO v_internal_tenant_id 
  FROM tenants WHERE is_internal_tenant = true LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    -- Maak automatisch een support ticket aan
    INSERT INTO support_tickets (
      tenant_id,
      requester_email,
      requester_name,
      subject,
      category,
      priority,
      status,
      metadata,
      related_resource_type,
      related_resource_id
    ) VALUES (
      NEW.tenant_id,
      COALESCE(v_tenant_email, 'unknown@tenant.com'),
      v_tenant_name,
      'Shopify koppelverzoek: ' || COALESCE(NEW.store_name, 'Onbekende store'),
      'integration',
      'high',
      'open',
      jsonb_build_object(
        'type', 'shopify_connection_request',
        'request_id', NEW.id,
        'store_name', NEW.store_name,
        'store_url', NEW.store_url
      ),
      'shopify_connection_request',
      NEW.id
    ) RETURNING id INTO v_ticket_id;
    
    -- Voeg automatisch een systeem bericht toe
    INSERT INTO support_messages (ticket_id, sender_type, message)
    VALUES (
      v_ticket_id,
      'system',
      'Nieuw Shopify koppelverzoek ingediend.

Store naam: ' || COALESCE(NEW.store_name, '-') || '
Store URL: ' || COALESCE(NEW.store_url, '-') || '
Opmerkingen merchant: ' || COALESCE(NEW.notes, 'Geen')
    );
    
    -- Notify internal tenant met link naar ticket
    IF v_internal_tenant_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_internal_tenant_id,
        'system',
        'shopify_request_new',
        'Nieuw Shopify koppelverzoek',
        v_tenant_name || ' vraagt koppeling aan voor ' || NEW.store_name,
        'high',
        '/admin/platform/support?ticket=' || v_ticket_id,  -- ← Directe link naar ticket
        jsonb_build_object(
          'ticket_id', v_ticket_id,
          'request_id', NEW.id,
          'tenant_name', v_tenant_name
        )
      );
    END IF;
    
    -- Notify merchant
    PERFORM public.send_notification(
      NEW.tenant_id,
      'system',
      'shopify_request_pending',
      'Shopify koppelverzoek ingediend',
      'Je verzoek is ingediend. We nemen contact op via je support inbox.',
      'medium',
      '/admin/support?ticket=' || v_ticket_id,
      jsonb_build_object('ticket_id', v_ticket_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;
```

### 3. URL Ondersteuning in Support Pagina

Voeg query parameter ondersteuning toe aan `PlatformSupport.tsx`:

```typescript
// Lees ticket ID uit URL en open automatisch
const [searchParams] = useSearchParams();
const ticketIdFromUrl = searchParams.get('ticket');

useEffect(() => {
  if (ticketIdFromUrl && tickets.length > 0) {
    const ticket = tickets.find(t => t.id === ticketIdFromUrl);
    if (ticket) setSelectedTicket(ticket);
  }
}, [ticketIdFromUrl, tickets]);
```

### 4. Merchant Support Inbox (optioneel, fase 2)

De merchant kan hun tickets zien op `/admin/support`:
- Alleen hun eigen tickets (gefilterd op tenant_id)
- Kunnen reageren op berichten
- Zien status updates

## Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | Nieuwe categorieën, related_resource kolommen |
| Database trigger | `handle_shopify_request_notification` maakt nu ticket aan |
| `src/pages/platform/PlatformSupport.tsx` | URL parameter ondersteuning |
| `src/hooks/useSupportTickets.ts` | Voeg `integration` en `feedback` toe aan types |

## Resultaat

1. **Geen 404 meer** - Notificatie linkt naar bestaande support ticket
2. **Uniforme communicatie** - Alle platform-level zaken in één inbox
3. **Volledige dialoog** - Platform admin kan direct reageren, merchant ziet updates
4. **Uitbreidbaar** - Zelfde pattern voor feedback, bol.com requests, etc.
5. **Context behouden** - Metadata en related_resource voor snelle toegang tot originele data
