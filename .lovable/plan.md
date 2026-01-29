

# Implementatieplan: Enterprise Trial + Automatisch Toegangsherstel

## Overzicht

Dit plan lost twee kritieke problemen op:
1. **"Geen winkel gevonden"** - Door ontbrekende `user_roles` entry
2. **Enterprise features niet zichtbaar** - Door verkeerde `plan_id` in subscription

### Root Cause Analyse

| Probleem | Oorzaak |
|----------|---------|
| Geen tenant zichtbaar | De `assign_tenant_admin_role_on_tenant_insert` trigger faalt omdat `auth.uid()` NULL is wanneer tenant via Edge Function (met service_role key) wordt aangemaakt |
| Plan niet Enterprise | De subscription trigger (`create_tenant_trial_subscription`) maakt altijd `plan_id: 'free'` aan - ongeacht geselecteerd plan in onboarding |
| Features verborgen | `AdminSidebar.tsx` checkt `subscription?.pricing_plan?.features` - bij `free` plan zijn alle premium features `false` |

---

## Deel 1: Edge Function Update - Rol + Plan Toewijzing

### Bestand: `supabase/functions/create-tenant/index.ts`

De Edge Function moet na tenant creatie expliciet:
1. De `tenant_admin` rol toewijzen aan de gebruiker
2. De subscription updaten met het geselecteerde plan

**Wijzigingen:**

1. **Voeg `selected_plan_id` toe aan payload type** (lijn 46-57):
```typescript
type TenantPayload = {
  name?: string;
  slug?: string;
  owner_name?: string | null;
  // ... existing fields ...
  selected_plan_id?: string | null;  // NEW: Plan geselecteerd in onboarding
};
```

2. **Na tenant insert, voeg rol en plan update toe** (na lijn 217):
```typescript
logStep("Tenant created", { tenantId: tenant.id });

// === CRITICAL: Assign tenant_admin role (trigger fails in service_role context) ===
const { error: roleError } = await supabase
  .from("user_roles")
  .upsert({
    user_id: user.id,
    tenant_id: tenant.id,
    role: 'tenant_admin',
  }, { 
    onConflict: 'user_id,role,tenant_id',
    ignoreDuplicates: true 
  });

if (roleError) {
  logStep("WARNING: Failed to assign role", { error: roleError.message });
  // Don't fail the request - tenant is created
} else {
  logStep("Role assigned successfully");
}

// === Update subscription with selected plan (if not free) ===
const selectedPlanId = body.selected_plan_id;
if (selectedPlanId && selectedPlanId !== 'free') {
  const { error: subError } = await supabase
    .from("tenant_subscriptions")
    .update({ plan_id: selectedPlanId })
    .eq("tenant_id", tenant.id);
  
  if (subError) {
    logStep("WARNING: Failed to update subscription plan", { error: subError.message });
  } else {
    logStep("Subscription plan updated", { plan: selectedPlanId });
  }
}

return new Response(JSON.stringify(tenant), {
  // ...
});
```

---

## Deel 2: Onboarding - Plan ID Doorsturen

### Bestand: `src/hooks/useOnboarding.ts`

De `createTenant` functie moet het geselecteerde plan meesturen naar de Edge Function.

**Wijziging in payload** (rond lijn 452-466):
```typescript
const payload = {
  name: shopName,
  slug: shopSlug,
  owner_email: loginEmail,
  owner_name: businessName || shopName,
  address: address || null,
  postal_code: postalCode || null,
  city: city || null,
  country: country || null,
  btw_number: vatNumber || null,
  kvk_number: chamberOfCommerce || null,
  billing_email: email || loginEmail,
  billing_company_name: businessName || null,
  selected_plan_id: state.data.selectedPlanId || 'free',  // NEW: Pass selected plan
};
```

**Verwijder dubbele subscription update** (lijn 522-532):
```typescript
// REMOVE THIS - now handled in Edge Function
// if (state.data.selectedPlanId && state.data.selectedPlanId !== 'free') {
//   try {
//     await supabase
//       .from('tenant_subscriptions')
//       .update({ plan_id: state.data.selectedPlanId })
//       .eq('tenant_id', tenant.id);
//   } catch (subError) {
//     console.warn('[Onboarding] Subscription update failed:', subError);
//   }
// }
```

---

## Deel 3: Automatisch Toegangsherstel

### Bestand: `src/hooks/useTenant.tsx`

Als de gebruiker geen tenants ziet maar er bestaat een tenant met hun e-mail als `owner_email`, automatisch repareren.

**Wijziging in `fetchTenants`** (na lijn 143):
```typescript
if (tenantsError) {
  console.error('Error fetching tenants:', tenantsError);
  setTenants([]);
  setLoading(false);
  return;
}

// === AUTO-REPAIR: If no tenants but user has a tenant by owner_email, repair access ===
if ((!tenantsData || tenantsData.length === 0) && user.email) {
  console.log('[useTenant] No tenants found, checking for orphaned tenant...');
  
  try {
    const { data: repaired, error: repairError } = await supabase.functions.invoke('repair-tenant-access', {
      body: { user_email: user.email },
    });
    
    if (!repairError && repaired?.repaired) {
      console.log('[useTenant] Access repaired, refetching tenants...');
      // Refetch after repair
      const { data: retriedData } = await supabase
        .from('tenants')
        .select('*')
        .order('name');
      
      if (retriedData && retriedData.length > 0) {
        // Continue with the repaired data
        tenantsData = retriedData;
      }
    }
  } catch (repairErr) {
    console.warn('[useTenant] Repair attempt failed:', repairErr);
  }
}

// ... rest of existing code
```

---

## Deel 4: Nieuwe Edge Function voor Toegangsherstel

### Bestand: `supabase/functions/repair-tenant-access/index.ts` (NIEUW)

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = (user.email || "").trim().toLowerCase();
    console.log(`[REPAIR] Checking for orphaned tenant for: ${userEmail}`);

    // Find tenant by owner_email
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("owner_email", userEmail)
      .limit(1)
      .maybeSingle();

    if (!tenant) {
      console.log("[REPAIR] No tenant found for this email");
      return new Response(JSON.stringify({ repaired: false, reason: "no_tenant" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if role already exists
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant.id)
      .limit(1)
      .maybeSingle();

    if (existingRole) {
      console.log("[REPAIR] Role already exists");
      return new Response(JSON.stringify({ repaired: false, reason: "role_exists" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert missing role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: user.id,
        tenant_id: tenant.id,
        role: 'tenant_admin',
      });

    if (roleError) {
      console.error("[REPAIR] Failed to insert role:", roleError.message);
      return new Response(JSON.stringify({ repaired: false, error: roleError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[REPAIR] Successfully repaired access for ${userEmail} to tenant ${tenant.id}`);
    return new Response(JSON.stringify({ 
      repaired: true, 
      tenant_id: tenant.id,
      tenant_name: tenant.name,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[REPAIR] ERROR:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## Deel 5: Trial → Free Downgrade na 14 Dagen

De bestaande trigger `create_tenant_trial_subscription` zet al `trial_end` op NOW + 14 dagen en status op `trialing`. 

Om automatisch naar Free te downgraden na afloop van de trial, is een database cron job nodig:

### Database Migratie - Trial Expiry Functie

```sql
-- Function to downgrade expired trials to free plan
CREATE OR REPLACE FUNCTION public.downgrade_expired_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  downgraded_count integer;
BEGIN
  UPDATE tenant_subscriptions
  SET 
    plan_id = 'free',
    status = 'active',
    trial_end = NULL,
    updated_at = NOW()
  WHERE status = 'trialing'
    AND trial_end IS NOT NULL
    AND trial_end <= NOW()
    AND plan_id != 'free';  -- Don't touch free trials
  
  GET DIAGNOSTICS downgraded_count = ROW_COUNT;
  
  -- Log the action
  IF downgraded_count > 0 THEN
    RAISE NOTICE 'Downgraded % expired trial subscriptions to free plan', downgraded_count;
  END IF;
  
  RETURN downgraded_count;
END;
$$;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule daily check at 00:05 UTC
SELECT cron.schedule(
  'downgrade-expired-trials',
  '5 0 * * *',  -- Every day at 00:05 UTC
  $$SELECT public.downgrade_expired_trials()$$
);
```

---

## Samenvatting Wijzigingen

| Bestand | Type | Beschrijving |
|---------|------|--------------|
| `supabase/functions/create-tenant/index.ts` | Wijziging | Voeg rol toewijzing + plan update toe |
| `src/hooks/useOnboarding.ts` | Wijziging | Stuur `selected_plan_id` mee in payload |
| `src/hooks/useTenant.tsx` | Wijziging | Auto-repair logica toevoegen |
| `supabase/functions/repair-tenant-access/index.ts` | Nieuw | Edge function voor toegangsherstel |
| Database migratie | Nieuw | Trial expiry cron job |

---

## Verwacht Resultaat

### Na implementatie:
1. **Nieuwe onboarding** → Plan (bijv. Enterprise) wordt correct opgeslagen, rol wordt toegewezen
2. **14 dagen trial** → Enterprise features beschikbaar
3. **Na trial expiry** → Automatisch downgrade naar Free, premium features geblokkeerd
4. **Bestaande VanXcel account** → Bij eerste dashboard bezoek wordt rol automatisch hersteld

### Feature gating werkt dan correct:
- Enterprise trial: alle features zichtbaar
- Na 14 dagen: alleen Free features (sidebar items verborgen)
- Upgrade via Stripe: Premium features weer beschikbaar

