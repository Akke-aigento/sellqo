
# Fix: Platform Admins Kunnen Geen Teamleden Uitnodigen voor Andere Tenants

## Probleem

De `send-team-invitation` edge function controleert of je admin bent door te zoeken naar een rol MET dezelfde `tenant_id`:

```typescript
// HUIDIGE CODE (Lijn 55-60)
const { data: userRole } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .eq("tenant_id", tenantId)  // ❌ Platform admins hebben tenant_id = null!
  .single();
```

Maar jouw `platform_admin` rol heeft `tenant_id = null` (platform-wide), dus de query vindt niets → "Not authorized".

## De Oplossing

Update de autorisatie-check om:
1. Eerst te controleren of de gebruiker een `platform_admin` is (met tenant_id = null)
2. OF te controleren of ze `tenant_admin` zijn voor de specifieke tenant

### Code Wijziging

**Bestand:** `supabase/functions/send-team-invitation/index.ts`

**Lijn 54-64 vervangen met:**

```typescript
// Check if user is platform admin (can invite to any tenant)
const { data: platformAdminRole } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .eq("role", "platform_admin")
  .is("tenant_id", null)
  .maybeSingle();

// If not platform admin, check if tenant admin for this specific tenant
let isAuthorized = !!platformAdminRole;

if (!isAuthorized) {
  const { data: tenantRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("role", "tenant_admin")
    .maybeSingle();
    
  isAuthorized = !!tenantRole;
}

if (!isAuthorized) {
  throw new Error("Not authorized to invite users to this tenant");
}
```

## Samenvatting

| Wat | Wijziging |
|-----|-----------|
| Bestand | `supabase/functions/send-team-invitation/index.ts` |
| Locatie | Lijn 54-64 |
| Probleem | Query zoekt rol met specifieke tenant_id, maar platform_admin heeft tenant_id = null |
| Oplossing | Twee-staps check: eerst platform_admin, dan tenant_admin |

## Resultaat

Na deze fix kunnen:
- **Platform admins** teamleden uitnodigen voor **elke** tenant (inclusief Demo Bakkerij)
- **Tenant admins** teamleden uitnodigen voor **hun eigen** tenant(s)
