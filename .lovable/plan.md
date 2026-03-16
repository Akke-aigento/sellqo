

## Probleem: Alle tenants zichtbaar voor gewone gebruikers

### Root cause

Er is een RLS policy op de `tenants` tabel die **iedereen** toegang geeft tot **alle** rijen:

```sql
CREATE POLICY "Public can view tenant basic info by slug"
  ON public.tenants FOR SELECT
  USING (true);  -- ← Geen enkele beperking!
```

Deze policy is ooit toegevoegd zodat de publieke storefront tenant-info kan opzoeken via slug. Maar omdat PostgreSQL permissive policies OR't, overschrijft dit alle andere SELECT-policies. Resultaat: `info@vanxcel.com` ziet alle tenants in de sidebar-dropdown.

### Bewijs

- `info@vanxcel.com` heeft slechts **1 rol**: `tenant_admin` voor **VanXcel**
- Maar de `useTenant` hook doet `supabase.from('tenants').select('*')` zonder filter
- Door de `USING (true)` policy komen alle tenants terug

### Oplossing

**1. Database migratie — RLS policy beperken**

Vervang de brede policy door een die alleen **anonieme** (niet-ingelogde) gebruikers toestaat tenant-info op te halen. Dit is wat de storefront nodig heeft.

```sql
DROP POLICY "Public can view tenant basic info by slug" ON public.tenants;

CREATE POLICY "Anon can view tenant basic info"
  ON public.tenants FOR SELECT
  TO anon
  USING (true);
```

Hierdoor:
- Storefront (anon): kan nog steeds tenants opzoeken ✅
- Ingelogde users: zien alleen hun eigen tenant(s) via `get_user_tenant_ids` ✅
- Platform admins: zien alles via `is_platform_admin` ✅

**2. Geen frontend wijziging nodig**

De sidebar toont de dropdown alleen als `tenants.length > 1`. Na de RLS fix retourneert de query voor `info@vanxcel.com` alleen VanXcel, dus de dropdown verdwijnt automatisch.

| Wijziging | Doel |
|-----------|------|
| SQL migratie: policy beperken tot `anon` role | Voorkom dat ingelogde users alle tenants zien |

