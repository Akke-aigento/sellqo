## Root cause

Astra Sleep heeft nog **geen rij** in `tenant_theme_settings` (verified via DB: `updated_at = NULL`, `use_custom_frontend = NULL`). Andere tenants waar je het al getest hebt, hadden die rij wel.

De RLS-policies op `tenant_theme_settings` zijn momenteel:

| cmd | check |
|---|---|
| SELECT | `tenant_id IN get_user_tenant_ids(...) OR is_platform_admin(auth.uid())` |
| INSERT | `has_tenant_role(tenant_id, ['tenant_admin'])` — **geen platform-admin bypass** |
| UPDATE | `has_tenant_role(tenant_id, ['tenant_admin'])` — **geen platform-admin bypass** |
| DELETE | `has_tenant_role(tenant_id, ['tenant_admin'])` — **geen platform-admin bypass** |

Jij bent platform_admin en geen `tenant_admin` van Astra Sleep, dus:
- `StorefrontSettings` → `saveThemeSettings.mutate` → `useStorefront.ts:172-189`
- `SELECT id` slaagt (platform-admin bypass aanwezig), levert geen rij → tak gaat naar `INSERT`
- INSERT wordt geblokkeerd door RLS (`WITH CHECK` faalt) → mutation gooit error, toggle springt terug naar `false`.

Bij tenants waar de rij al bestaat, gaat de tak naar `UPDATE` — die faalt óók (zelfde gat), maar als je daar wel tenant_admin van bent slaagt het wel. Dat verklaart perfect waarom Astra Sleep faalt en jouw andere tenants niet.

Dit is consistent met het patroon "Platform admins bypass RLS" dat de codebase elders gebruikt (memory `auth/platform-admin-unrestricted-access-policy`), maar dat patroon ontbreekt op deze tabel.

## Fix

Eén migratie die de drie mutatie-policies op `public.tenant_theme_settings` herschrijft zodat `is_platform_admin(auth.uid())` ook write-toegang krijgt — analoog aan de bestaande SELECT-policy:

```sql
DROP POLICY tenant_theme_settings_insert_admin ON public.tenant_theme_settings;
DROP POLICY tenant_theme_settings_update_admin ON public.tenant_theme_settings;
DROP POLICY tenant_theme_settings_delete_admin ON public.tenant_theme_settings;

CREATE POLICY tenant_theme_settings_insert_admin
  ON public.tenant_theme_settings FOR INSERT TO authenticated
  WITH CHECK (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY tenant_theme_settings_update_admin
  ON public.tenant_theme_settings FOR UPDATE TO authenticated
  USING (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  )
  WITH CHECK (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY tenant_theme_settings_delete_admin
  ON public.tenant_theme_settings FOR DELETE TO authenticated
  USING (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  );
```

Geen frontend-wijzigingen nodig — de mutation-flow is correct, alleen de policy gate blokkeerde hem.

## Verificatie

1. Open Astra Sleep storefront-instellingen, zet "Gebruik Custom Frontend" aan, vul URL in, opslaan.
2. DB-check: `SELECT use_custom_frontend, custom_frontend_url FROM tenant_theme_settings WHERE tenant_id = '169cf7b9-b22a-4a94-87d1-fb4b9cc948f9';` moet de waarden tonen.
3. Toggle uit/aan en bevestig dat dirty-state en FloatingSaveBar correct doorgaan.

## Scope-guardrails

- Geen wijzigingen aan tenant_admin-rechten of cross-tenant isolatie — alleen platform-admin krijgt expliciet wat hij elders al heeft.
- Geen frontend-aanrakingen.
- Geen wijzigingen aan andere tenants' bestaande rijen.
