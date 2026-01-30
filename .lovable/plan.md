
# Plan: Platform Owner Onbeperkte AI Credits Fix

## Probleem

De **402 (Payment Required)** error komt omdat:
1. De frontend credit check in `useAICredits.ts` nu correct wordt omzeild voor platform owners
2. Maar de **edge functions** roepen de database functie `use_ai_credits` aan
3. Deze database functie controleert NIET of de tenant een `is_internal_tenant` is

Dit treft **11+ AI edge functions** die allemaal dezelfde `use_ai_credits` RPC aanroepen.

## Oplossing

De meest efficiënte fix is het aanpassen van de **database functie** `use_ai_credits` om automatisch `TRUE` te retourneren voor internal tenants. Hierdoor:
- Alle edge functions werken direct correct
- Geen wijzigingen nodig in 11+ afzonderlijke edge function bestanden
- Toekomstige AI features profiteren ook automatisch

## Database Wijziging

Beide versies van de `use_ai_credits` functie aanpassen:

```text
VOOR:
┌─────────────────────────────────────────┐
│ 1. Check beschikbare credits            │
│ 2. Return FALSE als onvoldoende         │
│ 3. Anders: trek credits af + return TRUE│
└─────────────────────────────────────────┘

NA:
┌─────────────────────────────────────────────┐
│ 0. Check is_internal_tenant → JA = TRUE     │
│ 1. Check beschikbare credits                │
│ 2. Return FALSE als onvoldoende             │
│ 3. Anders: trek credits af + return TRUE    │
└─────────────────────────────────────────────┘
```

### SQL Migratie

```sql
-- Versie 1: use_ai_credits(p_tenant_id, p_credits_needed)
CREATE OR REPLACE FUNCTION public.use_ai_credits(
  p_tenant_id uuid, 
  p_credits_needed integer DEFAULT 1
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_is_internal BOOLEAN;
  available_credits integer;
BEGIN
  -- Platform owner (is_internal_tenant) heeft onbeperkte credits
  SELECT is_internal_tenant INTO v_is_internal
  FROM tenants WHERE id = p_tenant_id;
  
  IF v_is_internal = TRUE THEN
    -- Log usage maar geen credit aftrek
    INSERT INTO ai_usage_log (tenant_id, feature, credits_used, metadata)
    VALUES (p_tenant_id, 'internal_unlimited', 0, 
      '{"note": "Platform owner - unlimited credits"}'::jsonb);
    RETURN TRUE;
  END IF;
  
  -- Normale credit check voor andere tenants
  SELECT (credits_total + credits_purchased - credits_used)
  INTO available_credits FROM tenant_ai_credits
  WHERE tenant_id = p_tenant_id;
  
  IF available_credits IS NULL OR available_credits < p_credits_needed THEN
    RETURN FALSE;
  END IF;
  
  UPDATE tenant_ai_credits
  SET credits_used = credits_used + p_credits_needed, updated_at = NOW()
  WHERE tenant_id = p_tenant_id;
  
  RETURN TRUE;
END;
$$;

-- Versie 2: use_ai_credits(p_tenant_id, p_credits, p_feature, p_model, p_metadata)
CREATE OR REPLACE FUNCTION public.use_ai_credits(
  p_tenant_id uuid, 
  p_credits integer, 
  p_feature text, 
  p_model text DEFAULT NULL, 
  p_metadata jsonb DEFAULT '{}'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_is_internal BOOLEAN;
  v_available INTEGER;
BEGIN
  -- Platform owner check
  SELECT is_internal_tenant INTO v_is_internal
  FROM tenants WHERE id = p_tenant_id;
  
  IF v_is_internal = TRUE THEN
    -- Log voor analytics, geen credit aftrek
    INSERT INTO ai_usage_log (tenant_id, feature, credits_used, model_used, metadata)
    VALUES (p_tenant_id, p_feature, 0, p_model, 
      p_metadata || '{"internal_unlimited": true}'::jsonb);
    RETURN TRUE;
  END IF;
  
  -- Normale flow
  SELECT (credits_total + credits_purchased - credits_used)
  INTO v_available FROM tenant_ai_credits
  WHERE tenant_id = p_tenant_id;
  
  IF v_available IS NULL THEN
    INSERT INTO tenant_ai_credits (tenant_id, credits_total, credits_used)
    VALUES (p_tenant_id, 0, 0);
    v_available := 0;
  END IF;
  
  IF v_available < p_credits THEN
    RETURN FALSE;
  END IF;
  
  UPDATE tenant_ai_credits
  SET credits_used = credits_used + p_credits, updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  INSERT INTO ai_usage_log (tenant_id, feature, credits_used, model_used, metadata)
  VALUES (p_tenant_id, p_feature, p_credits, p_model, p_metadata);
  
  RETURN TRUE;
END;
$$;
```

## Impact

| Bestand/Component | Actie |
|-------------------|-------|
| Database: `use_ai_credits` functies (2x) | Aanpassen met `is_internal_tenant` check |
| Edge functions (11+ bestanden) | **Geen wijziging nodig** |
| Frontend hooks | **Geen wijziging nodig** (al correct) |

## Resultaat

Na deze wijziging:
- Platform owner kan onbeperkt AI features gebruiken
- Alle AI edge functions werken zonder 402 errors
- AI gebruik wordt nog steeds gelogd voor analytics (met `credits_used: 0`)
- Normale tenants behouden hun credit-systeem
