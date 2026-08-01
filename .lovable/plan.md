## Oorzaak (geverifieerd)

De vier RLS-policies op `media_assets` staan alle vier op hetzelfde patroon:

```
tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
```

Er is géén platform-admin uitzondering. Als platform admin heb je geen `user_roles`-rij voor de tenant die je bekijkt (Astra Sleep), dus de INSERT-check faalt met `42501 new row violates row-level security policy`. Dat verklaart ook de 403 op de SELECT (`GET .../media_assets?select=*`) in dezelfde console.

De rest van het project gebruikt hiervoor de canonieke helpers `public.is_platform_admin()` en de zero-argument wrapper `public.get_user_tenant_ids()`; `media_assets` is daar nooit op meegemigreerd.

## Aanpak

Eén migratie, additief-vóór-destructief: nieuwe policies erbij met een `_v2`-suffix, verifiëren via rol-impersonatie, daarna de oude vier droppen.

Per commando (SELECT / INSERT / UPDATE / DELETE) wordt de conditie:

```
public.is_platform_admin() OR tenant_id IN (SELECT public.get_user_tenant_ids())
```

Rol: `TO authenticated` (geen `anon` — mediabibliotheek is admin-only). Grants op de tabel controleren en waar nodig aanvullen voor `authenticated` en `service_role`.

## Verificatie

- Baseline + na-meting met rol-impersonatie: als tenant-user van Astra Sleep (moet blijven werken), als platform admin (moet nu werken), als `anon` (moet 0 rijen / geweigerd blijven).
- In de UI: foto uploaden in Producten → Foto's → Fotobibliotheek als platform admin, en de Assets-tab in Marketing.
- Supabase linter draaien na de migratie.

## Geen frontend-wijzigingen

`useMediaAssets.ts` filtert al expliciet op `currentTenant.id`, dus de tenant-isolatie in de UI blijft ongewijzigd; alleen de databaselaag wordt aangepast.
