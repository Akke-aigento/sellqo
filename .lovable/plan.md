

## Fix: Ads Overzicht toont "Geen kanalen verbonden" voor platform admin

### Oorzaak
De RLS-policy op `ad_platform_connections` controleert alleen `tenant_id IN (SELECT user_roles.tenant_id FROM user_roles WHERE user_id = auth.uid())`. Jouw platform_admin rol heeft `tenant_id = NULL`, dus VanXcel's ad_platform_connections record wordt niet gevonden — ondanks dat de data wél bestaat.

Andere tabellen gebruiken `is_platform_admin(auth.uid())` als bypass of `get_user_tenant_ids()` (die voor platform_admins alle tenants retourneert). Deze tabel mist dat.

### Wijzigingen

| Wat | Actie |
|-----|-------|
| Database migratie | RLS policies op `ad_platform_connections` updaten om `is_platform_admin()` bypass toe te voegen |

### Detail

**Huidige policies:**
- SELECT: `tenant_id IN (SELECT user_roles.tenant_id FROM user_roles WHERE user_id = auth.uid())`
- ALL (admin): `tenant_id IN (... WHERE role IN ('tenant_admin', 'platform_admin'))`

**Nieuwe policies:**
```sql
-- Drop existing
DROP POLICY "Tenant users can view their ad connections" ON ad_platform_connections;
DROP POLICY "Tenant admins can manage ad connections" ON ad_platform_connections;

-- Recreate with platform_admin bypass
CREATE POLICY "Tenant users can view their ad connections"
  ON ad_platform_connections FOR SELECT
  USING (
    is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY "Tenant admins can manage ad connections"
  ON ad_platform_connections FOR ALL
  USING (
    is_platform_admin(auth.uid())
    OR tenant_id IN (
      SELECT user_roles.tenant_id FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'tenant_admin'
    )
  );
```

Geen code-wijzigingen nodig — alleen de RLS policy moet gefixt worden.

