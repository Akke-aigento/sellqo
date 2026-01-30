

# Plan: Fix Ticket Updates & Add Tenant Notifications

## Gevonden Problemen

### Probleem 1: Ticket status update werkt niet
De `sync_ticket_to_shopify_request` trigger bestaat in de database, maar de shopify request status wordt niet correct gesynchroniseerd. Dit komt omdat:

1. De trigger refereert naar `support_ticket_messages` in de INSERT (migratie regel 86-105), maar de tabel heet `support_messages`
2. De mapping in de sync trigger is incompleet - `waiting` status wordt niet gemapped

### Probleem 2: Tenant krijgt geen notificatie bij ticket updates
Wanneer de platform admin de ticket status wijzigt (bijv. naar "In behandeling"), krijgt de tenant geen notificatie. De trigger `sync_ticket_to_shopify_request` update alleen de shopify_connection_requests status, maar stuurt geen notificatie naar de tenant.

### Probleem 3: Status-veld inconsistentie
In de screenshot zie ik:
- Ticket status in dropdown = "Open" (groen outline)
- Shopify request status = "Voltooid"
- Ticket lijst toont "Gesloten"

Dit wijst op een synchronisatie probleem.

---

## Oplossing

### Stap 1: Fix de sync trigger + voeg tenant notificaties toe

Maak een nieuwe database migratie die:

1. **Fix de sync trigger** - Voeg `waiting` mapping toe
2. **Voeg tenant notificatie toe** bij elke status wijziging

```sql
CREATE OR REPLACE FUNCTION public.sync_ticket_to_shopify_request()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_store_name TEXT;
  v_status_label TEXT;
BEGIN
  -- Alleen bij shopify requests
  IF NEW.related_resource_type = 'shopify_connection_request' 
     AND NEW.related_resource_id IS NOT NULL
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
     
    -- Haal tenant info op
    SELECT tenant_id, store_name INTO v_tenant_id, v_store_name
    FROM shopify_connection_requests
    WHERE id = NEW.related_resource_id;
    
    -- Bepaal status label voor notificatie
    v_status_label := CASE NEW.status
      WHEN 'open' THEN 'Open'
      WHEN 'in_progress' THEN 'In behandeling'
      WHEN 'waiting' THEN 'Wachtend op antwoord'
      WHEN 'resolved' THEN 'Opgelost'
      WHEN 'closed' THEN 'Gesloten'
      ELSE NEW.status
    END;
    
    -- Update shopify request status
    UPDATE shopify_connection_requests
    SET status = CASE NEW.status
      WHEN 'open' THEN 'pending'::text
      WHEN 'in_progress' THEN 'in_review'::text
      WHEN 'waiting' THEN 'in_review'::text  -- waiting ook naar in_review
      WHEN 'resolved' THEN 'approved'::text
      WHEN 'closed' THEN 'completed'::text
      ELSE status
    END,
    updated_at = now()
    WHERE id = NEW.related_resource_id;
    
    -- Stuur notificatie naar tenant
    IF v_tenant_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_tenant_id,
        'integrations',
        'shopify_request_updated',
        'Shopify verzoek bijgewerkt',
        'De status van je verzoek voor ' || COALESCE(v_store_name, 'je store') || 
          '.myshopify.com is gewijzigd naar: ' || v_status_label,
        'medium',
        '/admin/marketplace',
        jsonb_build_object(
          'request_id', NEW.related_resource_id,
          'ticket_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'store_name', v_store_name
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### Stap 2: Fix de messages tabel referentie in eerste trigger

Update `handle_shopify_request_notification` om de juiste tabel `support_messages` te gebruiken (in plaats van `support_ticket_messages`):

```sql
-- In de INSERT statement, wijzig:
INSERT INTO support_messages (...)  -- was: support_ticket_messages
```

### Stap 3: Update selectedTicket na status change

In `PlatformSupport.tsx`, moet de geselecteerde ticket ook lokaal worden bijgewerkt na een status wijziging zodat de UI direct de nieuwe status toont:

```typescript
const handleStatusChange = async (status: TicketStatus) => {
  await onUpdate({ id: ticket.id, status });
  // De query invalidation in useSupportTickets zorgt voor refresh
};
```

Dit zou al moeten werken via `queryClient.invalidateQueries`, maar de `selectedTicket` state wordt niet automatisch bijgewerkt omdat het een lokale kopie is.

**Fix**: Gebruik een effect om selectedTicket te synchroniseren met de query data:

```typescript
// In PlatformSupport component
useEffect(() => {
  if (selectedTicket && tickets.length > 0) {
    const updated = tickets.find(t => t.id === selectedTicket.id);
    if (updated && updated.status !== selectedTicket.status) {
      setSelectedTicket(updated);
    }
  }
}, [tickets, selectedTicket]);
```

---

## Technische Details

| Bestand/Resource | Wijziging |
|-----------------|-----------|
| **Database migratie** | Fix `sync_ticket_to_shopify_request` functie met tenant notificaties + waiting mapping |
| **Database migratie** | Fix `handle_shopify_request_notification` om juiste messages tabel te gebruiken |
| `src/pages/platform/PlatformSupport.tsx` | Sync `selectedTicket` state met query data na updates |

---

## Resultaat na implementatie

1. ✅ **Ticket status updates werken correct** - Status sync naar shopify_connection_requests
2. ✅ **Tenant ontvangt notificatie** - Bij elke status wijziging door platform admin
3. ✅ **UI reflecteert direct de nieuwe status** - Geen refresh nodig
4. ✅ **Alle statussen gemapped** - Inclusief `waiting` status

