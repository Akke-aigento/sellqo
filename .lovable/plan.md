## Probleem

API keys voor Astra Sleep worden correct aangemaakt (7 rijen aanwezig in DB), maar de UI toont "Nog geen API keys aangemaakt". De 4 RLS-policies op `storefront_api_keys` scopen via `user_roles.tenant_id`, en een platform_admin heeft geen `user_roles`-rij voor andere tenants. INSERT slaagt nog doordat de edge function service-role gebruikt, maar SELECT/UPDATE/DELETE in de UI falen stilletjes voor cross-tenant beheer.

## Fix

Eén migratie die de 4 policies op `public.storefront_api_keys` vervangt door versies met `public.is_platform_admin(auth.uid())` bypass — exact hetzelfde patroon dat eerder op `tenant_theme_settings` is toegepast.

```text
SELECT  → tenant member  OR is_platform_admin
INSERT  → tenant_admin    OR is_platform_admin
UPDATE  → tenant_admin    OR is_platform_admin
DELETE  → tenant_admin    OR is_platform_admin
```

Gedrag voor tenant-admins / leden van de tenant zelf blijft ongewijzigd.

## Verificatie

- Na migratie: in Astra Sleep moeten de 7 bestaande keys zichtbaar worden in de StorefrontApiKeysManager.
- Toggle/delete vanuit platform-admin-context moet werken.
- Niets aanraken aan de `generate-storefront-api-key` edge function — die werkt al correct.
- Geen wijzigingen aan UI-componenten.

## Scope-guardrails

- Géén wijziging aan andere tenant_id-gescopete tabellen in deze batch.
- Géén wijziging aan de keys/hash-flow.
