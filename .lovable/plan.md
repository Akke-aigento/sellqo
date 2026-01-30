
# Plan: Fix Dubbele send_notification Functie

## Probleem Geïdentificeerd

Er bestaan **twee versies** van de `send_notification` functie in de database met verschillende parameter types:

| OID | Parameter `p_category` type | Kolom gebruikt |
|-----|----------------------------|----------------|
| 43795 | `notification_category` (enum) | `metadata` ❌ |
| 41433 | `text` | `data` ✓ |

De trigger roept de verkeerde (oude) functie aan omdat PostgreSQL bij function overloading de meest specifieke match kiest - en `notification_category` enum is specifieker dan `text`.

## Oplossing

### Database Migratie

```sql
-- 1. Drop de oude functie met enum parameter type
DROP FUNCTION IF EXISTS public.send_notification(
  uuid, notification_category, text, text, text, text, text, jsonb
);

-- 2. Recreate de correcte functie (zekerheidshalve)
CREATE OR REPLACE FUNCTION public.send_notification(
  p_tenant_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_message text,
  p_priority text DEFAULT 'medium',
  p_action_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    tenant_id,
    category,
    type,
    title,
    message,
    priority,
    action_url,
    data  -- Correcte kolom naam
  ) VALUES (
    p_tenant_id,
    p_category::notification_category,  -- Cast text naar enum
    p_type,
    p_title,
    p_message,
    p_priority::notification_priority,
    p_action_url,
    p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;
```

## Resultaat

Na deze migratie:
- Slechts één `send_notification` functie overblijft
- Deze gebruikt correct de `data` kolom
- Shopify koppelverzoeken werken weer

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | Drop oude functie, recreate correcte versie |

