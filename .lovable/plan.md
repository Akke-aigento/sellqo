

## Fix: Team data niet zichtbaar door te strikte beveiligingsregels

### Diagnose
De database-beveiligingsregels (RLS) zijn te restrictief voor teamfunctionaliteit:

1. **Profiles tabel**: Gebruikers kunnen alleen hun **eigen** profiel zien. Als je teamleden ophaalt, worden alle andere namen/e-mails als `null` / "Onbekend" getoond.
2. **User_roles tabel**: Alleen platform_admins kunnen alle rollen zien. Een tenant_admin ziet alleen zijn **eigen** rol — niet die van teamgenoten.

### Oplossing

#### 1. Nieuwe RLS policy op `profiles`: teamgenoten kunnen elkaars profiel zien
```sql
CREATE POLICY "Team members can view profiles of same tenant"
ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR id IN (
    SELECT ur.user_id FROM public.user_roles ur
    WHERE ur.tenant_id IN (
      SELECT ur2.tenant_id FROM public.user_roles ur2
      WHERE ur2.user_id = auth.uid()
    )
  )
  OR is_platform_admin(auth.uid())
);
```
Dit vervangt de bestaande `Users can view their own profile` policy. Nu kan een gebruiker ook de profielen zien van mensen in dezelfde tenant(s).

#### 2. Nieuwe RLS policy op `user_roles`: tenant-leden kunnen elkaars rollen zien
```sql
CREATE POLICY "Tenant members can view roles in their tenant"
ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid()
  OR tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
  OR is_platform_admin(auth.uid())
);
```
Dit vervangt de twee bestaande SELECT policies (`Users can view their own roles` + `Platform admins can view all roles`) met één gecombineerde policy.

#### 3. Tenant_admin rechten voor DELETE/UPDATE op user_roles
Momenteel kunnen alleen platform_admins rollen wijzigen/verwijderen. Tenant_admins moeten dit ook kunnen voor hun eigen tenant:

```sql
-- Update policy
CREATE POLICY "Tenant admins can update roles in their tenant"
ON public.user_roles FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'tenant_admin'
    )
  )
);

-- Delete policy  
CREATE POLICY "Tenant admins can delete roles in their tenant"
ON public.user_roles FOR DELETE
USING (
  is_platform_admin(auth.uid())
  OR (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'tenant_admin'
    )
  )
);
```

### Samenvatting wijzigingen
- **Database migratie**: 
  - Drop + recreate SELECT policy op `profiles` (teamgenoten zichtbaar)
  - Drop + recreate SELECT policies op `user_roles` (gecombineerd)
  - Drop + recreate UPDATE/DELETE policies op `user_roles` (tenant_admin toegang)
- **Geen code-wijzigingen nodig** — de hooks (`useTeamMembers`, `TenantTeamTab`) werken al correct, ze krijgen alleen nu de data daadwerkelijk terug

### Technische details
```text
Huidige situatie:
profiles SELECT  → alleen eigen profiel (auth.uid())
user_roles SELECT → eigen rol OF platform_admin
user_roles UPDATE/DELETE → alleen platform_admin

Na fix:
profiles SELECT  → eigen profiel + teamgenoten + platform_admin  
user_roles SELECT → eigen rol + zelfde tenant + platform_admin
user_roles UPDATE/DELETE → platform_admin + tenant_admin (eigen tenant)
```

