
# Plan: Fix Shopify Koppelverzoek & Platform Admin Notificaties

## Samenvatting van de Problemen

### Probleem 1: Database Kolom Mismatch
De `send_notification` database functie probeert een kolom `metadata` te gebruiken, maar de `notifications` tabel heeft een kolom genaamd `data`. Dit veroorzaakt de foutmelding die je ziet.

### Probleem 2: Ontbrekende Categorie
De trigger gebruikt `'integrations'` als categorie, maar deze bestaat niet in de `notification_category` enum. De huidige categorieën zijn: orders, invoices, payments, customers, products, quotes, subscriptions, marketing, team, system, ai_coach, messages.

### Probleem 3: Geen Platform Admin Notificatie
Bij een nieuw Shopify koppelverzoek krijgt alleen de tenant een bevestiging. De platform admin die het verzoek moet afhandelen krijgt geen melding (in-app noch email).

---

## Oplossing

### Stap 1: Database - Voeg 'integrations' categorie toe

```sql
ALTER TYPE notification_category ADD VALUE 'integrations';
```

### Stap 2: Database - Fix send_notification functie

Wijzig de kolom `metadata` naar `data` in de INSERT statement:

```sql
CREATE OR REPLACE FUNCTION public.send_notification(...)
AS $$
BEGIN
  INSERT INTO public.notifications (
    ...
    data  -- Was: metadata
  ) VALUES (
    ...
    p_metadata
  )
  ...
END;
$$;
```

### Stap 3: Update Shopify Request Trigger

Pas de trigger aan om naast de tenant ook alle platform admins te notificeren. Nieuwe flow:

```text
┌──────────────────────────────────────────────────────────────┐
│ Merchant dient Shopify koppelverzoek in                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Notificatie naar MERCHANT (tenant)                       │
│     "Je verzoek is ontvangen, we nemen contact op"           │
│     Categorie: integrations                                  │
│     Prioriteit: medium                                       │
│                                                              │
│  2. Notificatie naar PLATFORM ADMINS                         │
│     "Nieuw Shopify koppelverzoek van [Tenant]"               │
│     Categorie: system (platform admin scope)                 │
│     Prioriteit: high (zodat er email uitkomt)                │
│     + Direct email via edge function                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Stap 4: Frontend Types

Voeg de `integrations` categorie toe aan `src/types/notification.ts` met relevante types:

```typescript
{
  category: 'integrations',
  label: 'Integraties',
  icon: 'Plug',
  types: [
    { type: 'shopify_request_submitted', label: 'Shopify verzoek ingediend', ... },
    { type: 'shopify_request_approved', label: 'Shopify verzoek goedgekeurd', ... },
    { type: 'shopify_request_completed', label: 'Shopify koppeling actief', ... },
    { type: 'integration_connected', label: 'Integratie gekoppeld', ... },
    { type: 'integration_disconnected', label: 'Integratie ontkoppeld', ... },
    { type: 'integration_error', label: 'Integratie fout', ... },
  ]
}
```

---

## Technische Details

### Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | (1) Voeg `integrations` toe aan enum, (2) Fix `send_notification` functie kolom, (3) Herschrijf `handle_shopify_request_notification` trigger |
| `src/types/notification.ts` | Voeg `'integrations'` categorie + types toe |

### Nieuwe Trigger Logica (pseudo-code)

```sql
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
RETURNS TRIGGER
...
AS $$
DECLARE
  v_tenant_name TEXT;
  v_platform_admin RECORD;
BEGIN
  -- Get tenant name for context
  SELECT name INTO v_tenant_name FROM tenants WHERE id = NEW.tenant_id;

  IF TG_OP = 'INSERT' THEN
    -- 1. Notify the merchant (tenant)
    PERFORM public.send_notification(
      NEW.tenant_id,
      'integrations',
      'shopify_request_submitted',
      'Shopify koppelverzoek ingediend',
      'Je verzoek voor ' || NEW.store_name || '.myshopify.com is ontvangen...',
      'medium',
      '/admin/connect',
      jsonb_build_object('request_id', NEW.id, 'store_name', NEW.store_name)
    );
    
    -- 2. Notify all platform admins (in-app + email trigger)
    FOR v_platform_admin IN 
      SELECT ur.user_id, ur.tenant_id 
      FROM user_roles ur 
      WHERE ur.role = 'platform_admin'
    LOOP
      PERFORM public.send_notification(
        v_platform_admin.tenant_id,
        'system',
        'shopify_request_new',
        'Nieuw Shopify koppelverzoek',
        'Tenant "' || v_tenant_name || '" heeft een verzoek ingediend voor ' || NEW.store_name || '.myshopify.com',
        'high',  -- High priority triggers email
        '/admin/platform/shopify-requests',
        jsonb_build_object(
          'request_id', NEW.id, 
          'store_name', NEW.store_name,
          'tenant_id', NEW.tenant_id,
          'tenant_name', v_tenant_name
        )
      );
    END LOOP;
  
  -- Handle status changes (approved, completed)
  ELSIF TG_OP = 'UPDATE' THEN
    -- ... existing logic for approved/completed notifications
  END IF;
  
  RETURN NEW;
END;
$$;
```

### Email Flow

De bestaande `create-notification` edge function stuurt al automatisch email voor `high` en `urgent` priority notificaties naar de `owner_email` van de tenant. Platform admins krijgen dus email via dit bestaande systeem.

---

## Resultaat na Implementatie

1. **Koppelverzoek werkt weer** - Geen "column metadata does not exist" fout meer
2. **Merchant krijgt bevestiging** - In-app notificatie dat verzoek is ontvangen
3. **Platform admin wordt genotificeerd** - In-app notificatie + email voor elk nieuw verzoek
4. **Integraties categorie beschikbaar** - Voor toekomstige integratie-gerelateerde meldingen

---

## Implementatie Volgorde

1. Database migratie uitvoeren:
   - Voeg `integrations` toe aan enum
   - Fix `send_notification` functie (metadata → data)
   - Herschrijf trigger functie met platform admin notificatie
2. Update `src/types/notification.ts` met integrations categorie
3. Test door nieuw koppelverzoek in te dienen
