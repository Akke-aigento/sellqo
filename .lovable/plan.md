

# Plan: Reset Test Data & Shopify Request Integratie in Support Tickets

## Overzicht

We gaan drie dingen doen:
1. **Reset test data** - Zodat je de nieuwe flow opnieuw kunt testen
2. **Synchronisatie** - Ticket status updates synchroniseren met Shopify request status
3. **Context-acties** - Specifieke Shopify-acties tonen in integration tickets

## 1. Reset Test Data

De volgende data wordt verwijderd via een database migratie:
- Het bestaande Shopify connection request
- Bijbehorende notificaties

Dit zorgt ervoor dat je opnieuw een verzoek kunt indienen en de complete flow kunt testen.

## 2. Status Synchronisatie

Het probleem: twee aparte systemen met hun eigen statussen:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Status Mapping                               │
├───────────────────────┬─────────────────────────────────────────┤
│  Ticket Status        │  Shopify Request Status                 │
├───────────────────────┼─────────────────────────────────────────┤
│  open                 │  pending                                │
│  in_progress          │  in_review                              │
│  waiting              │  (geen directe mapping)                 │
│  resolved             │  approved / completed                   │
│  closed               │  rejected / completed                   │
└───────────────────────┴─────────────────────────────────────────┘
```

### Oplossing: Database Trigger

Wanneer een support ticket status verandert EN het gaat om een integration ticket met `related_resource_type = 'shopify_connection_request'`, dan updaten we automatisch de Shopify request status:

```sql
CREATE OR REPLACE FUNCTION sync_ticket_to_shopify_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.related_resource_type = 'shopify_connection_request' 
     AND NEW.related_resource_id IS NOT NULL
     AND OLD.status IS DISTINCT FROM NEW.status THEN
     
    -- Sync ticket status naar shopify request
    UPDATE shopify_connection_requests
    SET status = CASE NEW.status
      WHEN 'open' THEN 'pending'
      WHEN 'in_progress' THEN 'in_review'
      WHEN 'resolved' THEN 'approved'
      WHEN 'closed' THEN 'completed'
      ELSE status -- waiting heeft geen mapping
    END
    WHERE id = NEW.related_resource_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 3. Context-Acties in Ticket Detail

Voor integration tickets tonen we extra informatie en acties:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Shopify koppelverzoek: test-store                               │
│ Van: merchant@example.com (VanXcel)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔗 Integratie Details                                       │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Type: Shopify Connection Request                            │ │
│ │ Store: test-store.myshopify.com                             │ │
│ │ Status aanvraag: In behandeling                             │ │
│ │                                                             │ │
│ │ [Installatie Link Toevoegen]  [Goedkeuren]  [Afwijzen]      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📨 Berichten                                                │ │
│ │ ...                                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technische Implementatie

### Database Migratie

1. **Verwijder test data**
2. **Voeg synchronisatie trigger toe**

```sql
-- Reset test data
DELETE FROM notifications 
WHERE type IN ('shopify_request_pending', 'shopify_request_new');

DELETE FROM shopify_connection_requests 
WHERE id = '85ffb421-9ea7-4f6c-8255-e6e22278b8b0';

-- Sync trigger: ticket status → shopify request status
CREATE OR REPLACE FUNCTION public.sync_ticket_to_shopify_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.related_resource_type = 'shopify_connection_request' 
     AND NEW.related_resource_id IS NOT NULL
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
     
    UPDATE shopify_connection_requests
    SET status = CASE NEW.status
      WHEN 'open' THEN 'pending'::text
      WHEN 'in_progress' THEN 'in_review'::text
      WHEN 'resolved' THEN 'approved'::text
      WHEN 'closed' THEN 'completed'::text
      ELSE status
    END,
    updated_at = now()
    WHERE id = NEW.related_resource_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sync_ticket_shopify
  AFTER UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION sync_ticket_to_shopify_request();
```

### Frontend Wijzigingen

**`src/pages/platform/PlatformSupport.tsx`**
- Voeg `IntegrationContext` component toe aan TicketDetail
- Toon metadata over de Shopify request
- Voeg actieknoppen toe (Goedkeuren, Afwijzen, Install link)

**`src/hooks/useSupportTickets.ts`**
- Voeg `related_resource_type` en `related_resource_id` toe aan SupportTicket interface

### Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | Reset data + sync trigger |
| `src/pages/platform/PlatformSupport.tsx` | IntegrationContext component met acties |
| `src/hooks/useSupportTickets.ts` | Nieuwe velden in interface |
| `src/hooks/useShopifyRequests.ts` | Import in PlatformSupport voor actie handlers |

## Resultaat

Na implementatie:
1. **Test data is gereset** - Je kunt opnieuw een Shopify verzoek indienen
2. **Automatische sync** - Ticket status updates syncen naar Shopify request
3. **Platform admin heeft volledige controle** - Kan status wijzigen, berichten sturen, en specifieke acties uitvoeren
4. **Merchant ziet updates** - Via hun support inbox en notificaties

