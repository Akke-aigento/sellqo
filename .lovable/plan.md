
# Plan: Fix Duplicate Notifications & Add Confirmation Flow

## Gevonden Problemen

### 1. Dubbele Notificaties (Database Level)
**Oorzaak**: De trigger vuurt twee keer bij één INSERT. Dit komt doordat:
- Er meerdere versies van `handle_shopify_request_notification` in de migraties staan
- De `shopify_request_notification_trigger` mogelijk twee keer is aangemaakt (once for INSERT, once for INSERT OR UPDATE)
- OF er een race condition is in de trigger die twee tickets aanmaakt

**Bewijs uit database:**
- 2 support tickets voor dezelfde `related_resource_id`
- 4 notificaties voor één verzoek (2x platform, 2x tenant)
- Beide tickets hebben exact dezelfde `created_at` timestamp

### 2. Dubbele Toast Notifications (Frontend Level)
**Oorzaak**: Twee hooks luisteren naar dezelfde realtime events:
- `useGlobalNotificationListener` - toont toast + speelt geluid
- `useNotifications` - toont óók een toast bij nieuwe notificatie

Dit veroorzaakt 2x toasts per notificatie (4x totaal door database dubbeling).

### 3. Geen Bevestigingsscherm
**Oorzaak**: In `ShopifyRequestConnection.tsx`:
```typescript
onSuccess?.() // Sluit direct de dialog
```
De dialog wordt gesloten voordat de gebruiker feedback krijgt over het ingediende verzoek.

### 4. Geen Email Notificaties
**Oorzaak**: De database trigger `send_notification()` voegt alleen een record toe aan de `notifications` tabel. De email-verzending zit in de `create-notification` edge function, maar die wordt niet aangeroepen door de trigger.

---

## Oplossing

### Stap 1: Fix Dubbele Trigger (Database Migratie)
```sql
-- 1. Drop bestaande triggers om schone staat te krijgen
DROP TRIGGER IF EXISTS shopify_request_notification_trigger ON shopify_connection_requests;
DROP TRIGGER IF EXISTS on_shopify_request_change ON shopify_connection_requests;

-- 2. Herschrijf trigger met duplicate-check
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS trigger AS $$
DECLARE
  v_existing_ticket UUID;
  -- ... rest
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Check of er al een ticket bestaat voor dit request (voorkom duplicates)
    SELECT id INTO v_existing_ticket 
    FROM support_tickets 
    WHERE related_resource_id = NEW.id 
    AND related_resource_type = 'shopify_connection_request'
    LIMIT 1;
    
    IF v_existing_ticket IS NOT NULL THEN
      RETURN NEW; -- Skip, ticket bestaat al
    END IF;
    
    -- Create ticket...
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Creëer trigger slechts één keer
CREATE TRIGGER shopify_request_notification_trigger
  AFTER INSERT OR UPDATE ON shopify_connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_shopify_request_notification();
```

### Stap 2: Fix Dubbele Toasts (Frontend)
In `useNotifications.ts`, verwijder de toast-logica omdat `useGlobalNotificationListener` dit al doet:

```typescript
// useNotifications.ts - VERWIJDER deze lines (68-72):
// toast({
//   title: newNotification.title,
//   description: newNotification.message,
//   variant: newNotification.priority === 'urgent' ? 'destructive' : 'default',
// });
```

### Stap 3: Bevestigingsscherm voor Tenant
In `ShopifyRequestConnection.tsx`, sluit de dialog NIET direct:

```typescript
const handleSubmit = async () => {
  // ... existing validation
  try {
    await createRequest.mutateAsync({...});
    setSubmitted(true);
    // VERWIJDER: onSuccess?.(); - dit sluit de dialog
  } catch {
    // Error handled by mutation
  }
};
```

De dialog toont dan automatisch de "Verzoek in behandeling" state (regel 56-104) in plaats van te sluiten.

### Stap 4: Email Notificaties via Edge Function
Pas de database trigger aan om de edge function aan te roepen via `pg_net` extension:

```sql
-- In trigger functie, vervang:
PERFORM public.send_notification(...);

-- Met edge function call die ook email stuurt:
PERFORM net.http_post(
  url := current_setting('app.supabase_url') || '/functions/v1/create-notification',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || current_setting('app.supabase_service_key'),
    'Content-Type', 'application/json'
  ),
  body := jsonb_build_object(
    'tenant_id', p_tenant_id::text,
    'category', p_category,
    'type', p_type,
    'title', p_title,
    'message', p_message,
    'priority', p_priority,
    'action_url', p_action_url,
    'data', p_metadata
  )
);
```

**Alternatief (simpeler)**: Maak een aparte database trigger die na elke INSERT op `notifications` de edge function aanroept voor email verzending.

---

## Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| **Database migratie** | Fix trigger duplicatie, voeg duplicate-check toe |
| `src/hooks/useNotifications.ts` | Verwijder dubbele toast-logica |
| `src/components/admin/marketplace/shopify/ShopifyRequestConnection.tsx` | Verwijder `onSuccess?.()` call na submit |
| `supabase/functions/create-notification/index.ts` | (geen wijziging nodig, werkt al) |

---

## Cleanup: Verwijder Dubbele Data

Als onderdeel van de migratie, ruim de test data op:

```sql
-- Verwijder duplicate tickets (behoud alleen de nieuwste)
DELETE FROM support_tickets 
WHERE related_resource_type = 'shopify_connection_request'
AND id NOT IN (
  SELECT DISTINCT ON (related_resource_id) id 
  FROM support_tickets 
  WHERE related_resource_type = 'shopify_connection_request'
  ORDER BY related_resource_id, created_at DESC
);

-- Verwijder duplicate notificaties
DELETE FROM notifications 
WHERE type LIKE 'shopify_%'
AND id NOT IN (
  SELECT DISTINCT ON (tenant_id, type, data->>'request_id') id 
  FROM notifications 
  WHERE type LIKE 'shopify_%'
  ORDER BY tenant_id, type, data->>'request_id', created_at DESC
);
```

---

## Resultaat na implementatie

1. ✅ **Één notificatie per event** - Geen duplicates meer in database
2. ✅ **Één toast per notificatie** - Alleen `useGlobalNotificationListener` toont toasts
3. ✅ **Bevestigingsscherm** - Tenant ziet "Verzoek in behandeling" na indienen
4. ✅ **Email notificaties** - High/urgent notifications sturen email via Resend
