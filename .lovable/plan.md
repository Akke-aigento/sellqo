

## Fix: Infinite recursion in user_roles RLS policy

### Probleem
De `user_roles` SELECT policy verwijst naar zichzelf:
```sql
tenant_id IN (SELECT ur.tenant_id FROM user_roles ur WHERE ur.user_id = auth.uid())
```
Dit veroorzaakt oneindige recursie → 500 errors → roles worden niet geladen → platform admin en team verdwijnen.

### Oplossing
Vervang de self-referencing subquery door de bestaande `get_user_tenant_ids(auth.uid())` functie, die al `SECURITY DEFINER` is en dus RLS bypast.

Dezelfde fix voor de `profiles` SELECT policy die ook `user_roles` subqueries bevat.

### Database migratie

```sql
-- Fix user_roles SELECT: use SECURITY DEFINER function instead of self-reference
DROP POLICY IF EXISTS "Tenant members can view roles in their tenant" ON public.user_roles;
CREATE POLICY "Tenant members can view roles in their tenant"
ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid()
  OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  OR is_platform_admin(auth.uid())
);

-- Fix profiles SELECT: same approach
DROP POLICY IF EXISTS "Team members can view profiles of same tenant" ON public.profiles;
CREATE POLICY "Team members can view profiles of same tenant"
ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR id IN (
    SELECT ur.user_id FROM public.user_roles ur
    WHERE ur.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
  OR is_platform_admin(auth.uid())
);

-- Fix UPDATE policy: same self-reference issue
DROP POLICY IF EXISTS "Tenant admins can update roles in their tenant" ON public.user_roles;
CREATE POLICY "Tenant admins can update roles in their tenant"
ON public.user_roles FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_role(auth.uid(), 'tenant_admin'))
);

-- Fix DELETE policy: same issue
DROP POLICY IF EXISTS "Tenant admins can delete roles in their tenant" ON public.user_roles;
CREATE POLICY "Tenant admins can delete roles in their tenant"
ON public.user_roles FOR DELETE
USING (
  is_platform_admin(auth.uid())
  OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_role(auth.uid(), 'tenant_admin'))
);
```

### Waarom dit werkt
- `get_user_tenant_ids()` en `has_role()` zijn beiden `SECURITY DEFINER` → ze lezen `user_roles` met owner-privileges, dus RLS wordt niet opnieuw geëvalueerd
- Geen code-wijzigingen nodig — alleen de database policies

