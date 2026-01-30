
# Plan: Platform Admin Notificatie Routing & Alternatief Email Adres

## Huidige Situatie

### Probleem 1: Platform Admin Notificaties Komen Niet Aan
De trigger zoekt platform admins met:
```sql
WHERE ur.role = 'platform_admin' AND ur.tenant_id IS NOT NULL
```
Maar platform admins hebben `tenant_id = NULL` (globale toegang), dus de loop vindt geen resultaten.

### Probleem 2: Geen Alternatief Notificatie Email
Tenants kunnen momenteel alleen emails ontvangen op `owner_email`. Er is geen optie om notificaties naar een ander adres te sturen.

---

## Oplossing

### Stap 1: Voeg `notification_email` kolom toe aan tenants

Nieuwe kolom die optioneel is en gebruikt wordt voor notificatie emails indien ingesteld:

```text
tenants tabel
├── owner_email        (verplicht, login/account)
├── billing_email      (optioneel, factuur emails)
└── notification_email (nieuw, optioneel, systeem notificaties)
```

Prioriteit voor notificatie emails:
1. `notification_email` (indien ingevuld)
2. `owner_email` (fallback)

### Stap 2: Fix Platform Admin Trigger Routing

Wijzig de trigger om notificaties naar de **interne tenant (SellQo)** te sturen in plaats van te zoeken naar platform admin rollen:

```sql
-- Oude (gebroken) logica:
FOR v_platform_admin IN 
  SELECT ur.tenant_id FROM user_roles ur 
  WHERE ur.role = 'platform_admin' AND ur.tenant_id IS NOT NULL
LOOP ...

-- Nieuwe logica:
SELECT id INTO v_internal_tenant_id 
FROM tenants 
WHERE is_internal_tenant = true 
LIMIT 1;

IF v_internal_tenant_id IS NOT NULL THEN
  PERFORM public.send_notification(
    v_internal_tenant_id,  -- SellQo tenant
    'system',
    'shopify_request_new',
    ...
  );
END IF;
```

Dit werkt omdat:
- De interne tenant (SellQo: `d03c63fe-48c6-4ff7-a30b-7506ea3e71ab`) heeft `owner_email: info@sellqo.app`
- De `create-notification` edge function haalt email uit de tenant en respecteert de notificatie instellingen
- Platform admins kunnen hun email voorkeuren configureren via de SellQo tenant instellingen

### Stap 3: Update Edge Function voor Alternatief Email

Wijzig de `create-notification` edge function om de `notification_email` te gebruiken indien beschikbaar:

```typescript
// Huidige logica:
const tenantEmail = tenant?.owner_email;

// Nieuwe logica:
const tenantEmail = tenant?.notification_email || tenant?.owner_email;
```

### Stap 4: UI Toggle in Notificatie Instellingen

Voeg een sectie toe aan `NotificationSettings.tsx` voor het alternatieve email adres:

```text
┌─────────────────────────────────────────────────────────────┐
│ 📧 Email Instellingen                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ○ Gebruik eigenaar email (info@sellqo.app)                  │
│ ● Gebruik alternatief email adres                           │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ notifications@sellqo.app                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Alle systeem notificaties worden naar dit adres gestuurd.   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technische Implementatie

### Database Migratie

```sql
-- 1. Voeg notification_email kolom toe
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);

-- 2. Fix de platform admin notificatie trigger
CREATE OR REPLACE FUNCTION public.handle_shopify_request_notification()
...
AS $$
DECLARE
  v_tenant_name TEXT;
  v_internal_tenant_id UUID;
BEGIN
  SELECT name INTO v_tenant_name FROM tenants WHERE id = NEW.tenant_id;
  v_tenant_name := COALESCE(v_tenant_name, 'Onbekende tenant');

  IF TG_OP = 'INSERT' THEN
    -- Notify merchant
    PERFORM public.send_notification(...);
    
    -- Notify internal tenant (SellQo platform team)
    SELECT id INTO v_internal_tenant_id 
    FROM tenants WHERE is_internal_tenant = true LIMIT 1;
    
    IF v_internal_tenant_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_internal_tenant_id,
        'system',
        'shopify_request_new',
        'Nieuw Shopify koppelverzoek',
        'Tenant "' || v_tenant_name || '" vraagt koppeling aan voor ' || NEW.store_name,
        'high',
        '/admin/platform/shopify-requests',
        jsonb_build_object(...)
      );
    END IF;
  
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Bestaande status change notificaties...
  END IF;
  
  RETURN NEW;
END;
$$;
```

### Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | Voeg `notification_email` kolom toe, fix trigger routing |
| `supabase/functions/create-notification/index.ts` | Gebruik `notification_email \|\| owner_email` |
| `src/hooks/useTenant.tsx` | Voeg `notification_email` toe aan Tenant interface |
| `src/components/admin/settings/NotificationSettings.tsx` | Voeg email configuratie sectie toe |

---

## Resultaat

Na implementatie:
1. **Platform admins ontvangen notificaties** - Shopify verzoeken en andere platform events komen in de SellQo tenant en worden per email verzonden
2. **Alternatief email adres** - Elke tenant kan kiezen om notificaties naar een ander adres te sturen
3. **Bestaande functionaliteit blijft werken** - Fallback naar `owner_email` indien geen alternatief is ingesteld
