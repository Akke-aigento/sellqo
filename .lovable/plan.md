

## Tenant Selector voor Custom Frontend Configurator

### Wat
Een tenant-dropdown toevoegen bovenaan het formulier die alle tenants ophaalt en bij selectie automatisch de velden invult (slug, custom_domain, naam).

### Wijziging: `src/pages/platform/CustomFrontendConfigurator.tsx`

1. **Import** `useTenants` hook (of direct Supabase query) om alle tenants op te halen
2. **Voeg een Select/Combobox toe** boven de invoervelden: "Selecteer een tenant"
3. **Bij selectie**: auto-fill `tenantSlug` → `tenant.slug`, `customDomain` → `tenant.custom_domain` (indien ingevuld), `lovableProjectName` → `tenant.name`
4. Het `supabaseProjectId` veld moet handmatig ingevuld worden (dat staat niet in de tenant data — het is van het externe Lovable project)
5. Velden blijven bewerkbaar na auto-fill zodat de gebruiker kan aanpassen

### Bron data
De `tenants` tabel bevat `slug`, `name`, en `custom_domain` — precies de velden die we nodig hebben. We gebruiken de bestaande `useTenants()` hook uit `src/hooks/useTenants.ts`.

