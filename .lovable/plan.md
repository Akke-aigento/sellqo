

## Webshop Zichtbaarheid Toggle: Online / Wachtwoord / Offline

### Wat wordt er gebouwd?

Een drievoudige status-toggle voor je webshop:

1. **Online** -- Webshop is publiek toegankelijk voor iedereen
2. **Online met wachtwoord** -- Bezoekers moeten een wachtwoord invoeren om de shop te bezoeken (handig voor preview, soft-launch, of B2B)
3. **Offline** -- Webshop toont een "Onderhoud" of "Binnenkort beschikbaar" pagina

### Waar komt dit te staan?

Bovenaan de **Storefront > Instellingen** pagina, als een prominente kaart met de huidige status en een duidelijke selector.

### Hoe werkt het?

- Wanneer de status **"password"** is, moet de bezoeker een wachtwoord invoeren. Dit wachtwoord stel je in via de admin.
- Wanneer de status **"offline"** is, ziet de bezoeker een onderhoudspagina met je logo en een korte melding.
- De storefront checkt deze status bij het laden en blokkeert toegang indien nodig.

### Technisch

**1. Database migratie** -- twee nieuwe kolommen op `tenant_theme_settings`:

| Kolom | Type | Default | Beschrijving |
|---|---|---|---|
| `storefront_status` | `text` | `'online'` | Waarden: `online`, `password`, `offline` |
| `storefront_password` | `text` | `null` | Wachtwoord voor password-modus |

**2. Admin UI** -- `StorefrontSettings.tsx`:
- Nieuwe kaart bovenaan met drie opties (radio group of segmented control)
- Bij keuze "Wachtwoord" verschijnt een invoerveld voor het wachtwoord
- Status wordt opgeslagen samen met de andere instellingen

**3. Storefront guard** -- `ShopLayout.tsx`:
- Leest `storefront_status` uit de theme settings
- Bij **offline**: toont een onderhoudspagina (logo + "Binnenkort beschikbaar")
- Bij **password**: toont een wachtwoord-invoerscherm. Na correct invoeren wordt dit opgeslagen in `sessionStorage` zodat de bezoeker niet steeds opnieuw moet invoeren
- Bij **online**: normaal gedrag (zoals nu)

**4. Hook update** -- `usePublicStorefront.ts`:
- Haalt `storefront_status` en `storefront_password` op uit `tenant_theme_settings`

### Bestanden die worden aangepast

| Bestand | Wijziging |
|---|---|
| Database migratie | Nieuwe kolommen `storefront_status` en `storefront_password` |
| `src/components/admin/storefront/StorefrontSettings.tsx` | Nieuwe "Webshop Status" kaart met 3 opties + wachtwoordveld |
| `src/hooks/usePublicStorefront.ts` | Extra velden ophalen uit theme settings |
| `src/hooks/useStorefront.ts` | Extra velden meenemen bij opslaan |
| `src/components/storefront/ShopLayout.tsx` | Guard logica: offline-pagina of wachtwoord-scherm tonen |
| Nieuw: `src/components/storefront/StorefrontPasswordGate.tsx` | Wachtwoord invoer component |
| Nieuw: `src/components/storefront/StorefrontOfflinePage.tsx` | Offline / onderhoudspagina component |

