## Doel

Duidelijke scheiding tussen **Webshop = content voor de SellQo storefront** en **Instellingen = configuratie die geldt ongeacht welke frontend gebruikt wordt**. Rekening houden met tenants die `use_custom_frontend = true` hebben: die moeten alle relevante instellingen kunnen bereiken zonder in "Webshop" te zitten, én SellQo-frontend-only opties moeten dan visueel uitgegrijsd zijn.

## Nieuwe indeling

### Webshop (alleen nog SellQo-frontend content)
Enkel behouden wat *pure content/presentatie* voor de SellQo storefront is:
- Theme
- Homepage
- Pagina's
- Juridisch

Hele module krijgt bovenaan een banner "Deze module bewerkt de SellQo-frontend. Je hebt een custom frontend actief — wijzigingen hier hebben geen effect op je live site" wanneer `use_custom_frontend = true`. Module blijft bereikbaar (content blijft nuttig als preview/fallback), maar de "Publiceren" en "Preview" knoppen worden gedimd/gewaarschuwd.

### Verhuizen naar Instellingen
| Van (Webshop-tab) | Naar (Settings) |
|---|---|
| Social Media | **Verwijderen** — duplicaat van Settings › SellQo Connect › Social Media |
| Reviews | Settings › SellQo Connect › **Reviews** (nieuwe sectie) — reviews werken op beide frontends |
| Functies (`StorefrontFeaturesSettings`) | Nieuwe groep **Webshop** in Settings |
| Instellingen (`StorefrontSettings`) | Nieuwe groep **Webshop** in Settings |

### Nieuwe Settings-groep "Webshop"
Verplaats + voeg toe onder één groep, in deze volgorde:
1. **Frontend-modus** (nieuw kaartje): keuze SellQo-frontend / Custom frontend, met URL. Bron van de `use_custom_frontend` toggle — dit wordt de duidelijke plek om te schakelen.
2. **Winkelinstellingen** (verhuist uit "Bedrijfsinformatie" — component `StoreSettings`)
3. **Webshop-instellingen** (verhuisd `StorefrontSettings`)
4. **Webshop-functies** (verhuisd `StorefrontFeaturesSettings`)

### SellQo-frontend-only markering
Nieuwe util `useFrontendMode()` die `use_custom_frontend` leest. Voor secties/velden die alleen SellQo-frontend betreffen:
- Sectie krijgt een badge "Alleen SellQo-frontend"
- Inputs krijgen `disabled` styling + tooltip "Actief bij custom frontend zonder effect"
- Bereikbaar blijven (lezen/aanpassen mag), maar visueel duidelijk irrelevant

Toepassen op:
- Alles onder de nieuwe groep Webshop, behalve Frontend-modus zelf en velden die ook custom-frontend beïnvloeden (bv. currency, tax display die via Storefront API worden gelezen — daar geen badge)
- Header van de Webshop-module (Theme/Homepage/Pagina's/Juridisch): banner zoals hierboven

## Concrete wijzigingen

**Bestanden**
- `src/pages/admin/Storefront.tsx` — verwijder tabs `social`, `reviews`, `features`, `settings` uit `NAV_ITEMS` + switch. Voeg headless-banner toe.
- `src/pages/admin/Settings.tsx` — nieuwe groep `webshop` (volgorde na Bedrijfsinformatie). Verplaats `store` uit `business` naar `webshop`. Voeg secties `webshop-general`, `webshop-features`, `frontend-mode` toe. Voeg sectie `reviews` toe onder `channels` (SellQo Connect).
- `src/hooks/useFrontendMode.ts` (nieuw) — leest `use_custom_frontend` uit `theme_settings`. Exporteert `{ isCustomFrontend, isSellqoFrontend }`.
- `src/components/admin/settings/FrontendModeSettings.tsx` (nieuw) — kaartje met de toggle + URL-veld (herbruikt bestaande mutatie in `useStorefront`).
- `src/components/admin/storefront/StorefrontFeaturesSettings.tsx` en `StorefrontSettings.tsx` — geen logica-wijziging, alleen ingekapseld in Settings-shell + `<SellqoOnlyBadge />` wrapper waar relevant.
- `src/components/ui/SellqoOnlyBadge.tsx` (nieuw) — kleine badge + tooltip-component.
- Sidebar `sidebarConfig.ts` — geen wijziging (Webshop en Instellingen blijven bestaan).
- Diepe links (`?section=store`) blijven werken door zelfde `id`-waarden te behouden bij verplaatsing.

**Geen wijzigingen**
- Geen DB-migratie.
- Geen edge functions.
- Geen impact op RLS.

## Wat als een tenant `use_custom_frontend` aanzet?

- Sidebar-item "Webshop" blijft zichtbaar (content-onderhoud blijft nuttig), maar krijgt een subtiele "SellQo-frontend" hint in de tooltip.
- Alle winkelconfiguratie zit in Settings › Webshop en is 100% bereikbaar zonder Webshop-module te openen.
- SellQo-frontend-only velden zijn uitgegrijsd met tooltip.

## Out of scope (later)

- Automatisch verbergen (via `hidden_pages`) van de Webshop-module bij custom frontend — niet doen, gebruiker kan dit nu al zelf via tenant page overrides regelen.
- Reviews-module inhoudelijk verbouwen — enkel verplaatst.
