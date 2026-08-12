# WEBSHOP-3 — Template-systeem: implementatie & verificatie

**Status:** afgerond — migratie uitgevoerd en smoke-test groen, 2026-08-12
**Scope:** additieve schemawijziging op `public.themes` + frontend.

---

## 1. Pre-flight (§0)

| Controle | Uitkomst |
|---|---|
| Gedeelde tabellen gewijzigd? | Alleen `themes`, uitsluitend `ADD COLUMN IF NOT EXISTS` |
| Kolom hernoemd/verwijderd/default gewijzigd? | Nee |
| Bestaande `themes`-rijen aangepast? | Nee — `ON CONFLICT (slug)` raakt alleen `tpl-mode`, `tpl-food`, `tpl-minimal` |
| `tenant_theme_settings` / `homepage_sections` / `storefront_pages` gewijzigd? | Nee |
| View `tenant_theme_public` gewijzigd? | Nee |
| Edge-functies gewijzigd? | Nee |
| `use_custom_frontend`-pad geraakt? | Nee |

Tenants die via `theme_id` naar Modern, Classic of Bold verwijzen houden exact hun huidige instellingen. Die rijen krijgen geen `seed_definition` en verschijnen daarmee niet meer als keuze in de gallery — ze blijven wél geldig als actief theme.

---

## 2. Wat er gebouwd is

### 2.1 Migratie `20260812143000_webshop3_theme_templates.sql`

Vier additieve kolommen op `public.themes`:

| Kolom | Type | Doel |
|---|---|---|
| `category` | `text` | Branche (fashion / food / minimal) |
| `preview_mobile_url` | `text` | Mobiele screenshot |
| `seed_definition` | `jsonb` | Bouwplan: secties + pagina's |
| `sort_order` | `integer` | Volgorde in de gallery |

`preview_image_url` bestond al en dient als desktop-screenshot — daar was geen nieuwe kolom voor nodig.

Plus drie template-rijen: **Mode & lifestyle**, **Food & ambacht** en **Minimal one-pager**, elk met eigen kleurenpalet, sectie-opbouw en Nederlandse voorbeeldcontent.

### 2.2 Het `{{shop}}`-probleem

`HeroSection.tsx:61` en `TextImageSection.tsx:43` geven `button_link` rauw aan react-router mee, zonder het winkelpad ervoor te zetten. Een seed met `/products` zou een bezoeker dus naar de **admin-app** sturen in plaats van naar de winkel.

Opgelost met een placeholder: de seeds bevatten `{{shop}}/products`, en `useTemplateSeed` vervangt die bij het toepassen door `/shop/<tenant-slug>`. De renderers blijven ongewijzigd.

Dat de renderers relatieve links niet zelf oplossen blijft een latente valkuil voor iedereen die handmatig een knop toevoegt in de builder. Genoteerd voor WEBSHOP-5.

### 2.3 Seed-logica (`hooks/useTemplateSeed.ts`)

Nooit destructief:

- **Secties**: bestaande zichtbare secties gaan op `is_visible = false`. Niets wordt verwijderd; de tenant vindt ze terug bij Homepage.
- **Pagina's**: een slug die al bestaat wordt overgeslagen, want daar zit content van de tenant in (en `UNIQUE(tenant_id, slug)` zou botsen). De namen van overgeslagen pagina's worden in een toast teruggekoppeld.
- **Instellingen**: `theme_id` plus alle defaults. Dit is het moment waarop `theme_id` eindelijk gezet wordt — de kolom waarvan §1.2 van de recon vaststelde dat hij bij vijf van de zeven tenants leeg bleef.

De hook doet eerst een lookup en kiest dan tussen `update` en `insert`, omdat niet elke tenant gegarandeerd een `tenant_theme_settings`-rij heeft.

### 2.4 Gallery en previews

De gallery toont uitsluitend rijen mét `seed_definition`. Rijen zonder bouwplan zijn geen template.

**Over de previews:** het plan was screenshots op Speeltuin-data. Dat vereist een draaiende winkel met inhoud, een screenshot-pijplijn en storage-uploads — geen van drieën kon ik hier afronden. In plaats van een lege plek of een verzonnen mockup tekent `TemplatePreview` de werkelijke opbouw uit `seed_definition`: welke secties, in welke volgorde, in de kleuren van dat template. Dat kan per definitie niet verouderen ten opzichte van de seed.

`preview_image_url` heeft voorrang zodra die gevuld is. De screenshot-route blijft dus volledig open; het is een overschrijving, geen vervanging van de bestaande aanpak.

### 2.5 Design als één scherm

`ThemeWizard.tsx` (937 regels) is **verwijderd**, samen met het nooit-gebruikte `ThemeGallery.tsx` (217 regels).

Daarvoor in de plaats: `DesignPanel.tsx`, één scherm met de actieve template-kaart bovenaan, dan merkkleur en stijl, dan de fijnregeling achter een uitklapper, met de live preview ernaast. Geen stappen.

Behouden uit de wizard: de palette-generator, merkkleur-kiezer, stijlpresets, geavanceerde overrides, `LiveThemePreview` en `BrandingUploader`. De lokale helper `paletteToColors` is verhuisd naar `src/lib/theme-palette.ts` als `paletteToHexColors`, zodat hij het opheffen van de wizard overleeft.

### 2.6 Het gekozen thema is nu zichtbaar

Dit was de tweede klacht uit de smoke-test. Het actieve template staat nu op twee plekken:

- **Overzicht** — miniatuur en naam in de kopkaart, klikbaar naar Design.
- **Design** — kaart bovenaan met preview, naam en "Ander template".

Heeft de tenant nog geen template, dan staat er "Nog niet gekozen" en opent Design direct de gallery in plaats van een leeg paneel.

Het checklist-item heet nu **Template** en kijkt naar `theme_id` in plaats van `brand_color` — met een echt template-systeem is dat het eerlijke signaal.

---

## 3. Verificatie

| Controle | Resultaat |
|---|---|
| JSON in de migratie parseert | ✅ 6 van 6 literals geldig |
| Sectietypes bestaan in `SECTION_TYPES` | ✅ hero, featured_products, collection, text_image, testimonials, newsletter, announcement |
| `eslint` op alle nieuwe/gewijzigde bestanden | ✅ exit 0, geen output |
| `tsc --noEmit` | ✅ exit 0, geen output |
| `npm run build` | ✅ exit 0, gebouwd in 3m02 (alleen de bestaande chunk-size-waarschuwing) |
| Geen verweesde verwijzingen na verwijderen wizard | ✅ `paletteToColors` en `ThemeWizard`/`ThemeGallery` nergens meer geïmporteerd |
| Structuur `VALUES`: exact 3 rijen, juiste koppeling | ✅ zie §3.2 |
| Migratie uitgevoerd | ✅ op core; 3 templates aanwezig, Bold/Classic/Modern ongewijzigd zonder seed |
| Smoke-test Speeltuin | ✅ template kiezen, wisselen en `{{shop}}`-invulling alle drie bevestigd |

### 3.2 Structuurcontrole van de migratie

Geparseerd uit het bestand, ter bevestiging dat de `VALUES`-lijst precies drie schone rijen bevat en dat elk template zijn eigen content houdt:

| Rij | Regels | slug | categorie | secties | pagina's | testimonials |
|---|---|---|---|---|---|---|
| 1 | 42–125 | `tpl-mode` | fashion | 5 | 3 | Sanne, Joris, Fatima |
| 2 | 126–218 | `tpl-food` | food | 6 | 3 | Marieke, Ahmed, Ellen |
| 3 | 219–287 | `tpl-minimal` | minimal | 4 | 1 | (geen) |

Elke slug komt exact één keer voor; de rijgrenzen (`VALUES` op 41, `)` op 287, `ON CONFLICT` op 288) zijn compleet.

### 3.1 Twee valse verificaties onderweg

Twee keer meldde een controle iets anders dan hij leek te doen; beide zijn gecorrigeerd voordat er conclusies aan hingen.

1. **`timeout` bestaat niet op macOS.** Een run die met `timeout 900` was ingepakt gaf exit 127 (`command not found`) — de typecheck had helemaal niet gedraaid. Opnieuw uitgevoerd zonder wrapper.
2. **Een "vastlopende" typecheck die dat niet was.** `pgrep` bleef een `tsc`-proces vinden, waaruit ten onrechte werd geconcludeerd dat WEBSHOP-3-code de typechecker liet ontploffen. Het ging om een verweesd proces van een eerder afgebroken run; de echte run was al klaar met exit 0. `resolveShopPaths` is naar aanleiding van die verkeerde diagnose herschreven van een recursieve generic naar `unknown` in/uit — geen noodzakelijke wijziging, maar wel een leesbaardere.

Losstaand daarvan is de migratie tijdens review aangezien voor een bestand met drie kopieën van `tpl-mode`. Dat bleek een afgekapte weergave; het bestand op schijf was en is correct (§3.2). Er is niets gewijzigd.

---

## 4. Uitgevoerd en bevestigd

1. **Migratie** — gedraaid en geverifieerd op core. `tpl-mode` (fashion, 5 secties / 3 pagina's), `tpl-food` (food, 6/3), `tpl-minimal` (minimal, 4/1). Bold, Classic en Modern ongewijzigd en zonder `seed_definition`, dus buiten de gallery. Additief bevestigd.
2. **Smoke-test Speeltuin** — alle drie de kernpaden groen:
   - Template kiezen: secties en pagina's aangemaakt, `theme_id` gezet, naam zichtbaar op Overzicht én Design.
   - Tweede template kiezen: oude secties **verborgen** in plaats van verwijderd, bestaande pagina's ongemoeid.
   - `{{shop}}`-placeholder correct ingevuld naar `/shop/<slug>/products`.

### 4.1 Nog openstaand

1. **Supabase-types opnieuw genereren.** Vereist een access token of DB-connectiestring; `.env` bevat alleen `SUPABASE_URL` en de publishable key, dus dit kan niet vanuit de werkkopie. Niet blokkerend: `mapDbTheme` (`useStorefront.ts:18`) neemt een `any`-parameter, waardoor de nieuwe kolommen via `select('*')` binnenkomen en alles compileert. Wel hygiëne.

   ```
   npx supabase login
   npx supabase gen types typescript --project-id gczmfcabnoofnmfpzeop \
     > /tmp/types.new.ts && mv /tmp/types.new.ts src/integrations/supabase/types.ts
   ```

   De omweg via `/tmp` voorkomt dat `types.ts` (20.021 regels) wordt leeggegooid als het commando faalt.

2. **Screenshots** maken zodra er een gevulde Speeltuin-winkel staat, en `preview_image_url` / `preview_mobile_url` vullen. De gallery pakt ze dan automatisch op — `TemplatePreview` geeft een aanwezige `preview_image_url` voorrang boven de getekende opbouw.

---

## 5. Openstaand voor latere batches

- **Relatieve links in de builder** (§2.2): `HeroSection` en `TextImageSection` lossen `button_link` niet op tegen het winkelpad. Wie handmatig een knop toevoegt met `/products` krijgt een kapotte link. WEBSHOP-5.
- **Verweesde vertaalsleutels.** Het blok `theme.wizard` (23 sleutels) staat nog in `nl.json`, `en.json`, `fr.json` en `de.json`, terwijl geen enkele regel code er nog naar verwijst — gevolg van het verwijderen van de ThemeWizard. Opruimen hoort bij WEBSHOP-6 (i18n). Kanttekening: sleutels worden als string opgezocht, dus dynamisch samengestelde aanroepen zijn niet met zekerheid uit te sluiten; bij het verwijderen even nalopen.
- **`useThemePresets` is dode code.** De hook (82 regels) en de tabel `tenant_theme_presets` worden nergens gebruikt — ook al vóór deze batch niet. De hook weghalen zonder besluit over de tabel is een halve opruiming; vandaar hier genoteerd in plaats van meteen verwijderd.
- De punten uit `webshop-batch-2-verificatie.md` §6 blijven staan: wachtwoord-verificatie en een inhaalmigratie voor `storefront_status`.
