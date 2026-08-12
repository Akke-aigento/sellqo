# WEBSHOP — Masterplan Shop Studio (herbouw Webshop-pagina)

**Status:** concept ter review — 2026-08-12
**Eigenaar:** Akke · uitvoering via Claude + Lovable
**Doel:** de tenant-pagina `/admin/storefront` volledig herbouwen tot een Shopify-achtige "Shop Studio" waarmee een tenant van A tot Z een webshop opzet vanuit templates, met een strikte scheiding tussen webshop-instellingen (in de Webshop-pagina) en systeem/frontend-instellingen (in Instellingen → Webshop).

---

## 0. ONAANTASTBAAR — de eerste wet

Dit plan verandert NIETS aan de huidige werking van live tenants.

- **Custom-frontend tenants (Loveke, VanXcel, Astra Sleep, Mancini Milano, Zona Dorata) merken hier NIETS van.** Hun frontends praten via `storefront-resolve` / `storefront-api` / checkout-engine met de core; die contracten worden niet gewijzigd.
- **Strikt additief** op alle gedeelde tabellen: `tenant_theme_settings`, `themes`, `homepage_sections`, `storefront_pages`. Geen kolommen hernoemen, geen kolommen verwijderen, geen defaults van bestaande kolommen wijzigen, geen datatype-wijzigingen.
- **`use_custom_frontend`-pad blijft byte-voor-byte identiek.** Frontend-modus, `custom_frontend_url`, `custom_frontend_config`, storefront API-keys en head-scripts blijven functioneel én qua opslag ongewijzigd.
- Edge-functies `storefront-resolve`, `storefront-api`, `checkout-engine` worden in deze reeks **niet aangeraakt** tenzij een batch-recon expliciet aantoont dat een additieve uitbreiding nodig én veilig is — en dan alleen na apart akkoord.
- **Testbedden:** SellQo Speeltuin en Demo Bakkerij (de enige twee tenants op het SellQo-theme; beide test). Elke batch wordt daar gesmoke-test vóór er iets als "klaar" geldt.
- Workspace-skill `sellqo-gedeelde-paden` is op elke batch van toepassing. Per batch: pre-flight check, post-flight verificatie (diff + file-reads + SQL-natrek), paper trail in `docs/role-audit.md`.
- UI verplaatsen is toegestaan; data-paden verplaatsen niet.

---

## 1. Huidige staat (recon 2026-08-12)

### 1.1 Webshop-pagina (`src/pages/admin/Storefront.tsx`)
Vier losse tabs: Theme (ThemeWizard), Homepage (HomepageBuilder), Pagina's (StorefrontPagesManager), Juridisch (LegalPagesManager). Header met status-badge, preview-link en Publiceren-knop.

**Bug (bevestigd):** de Publiceren-knop in de header is disabled zolang `themeSettings.theme_id` leeg is — en de ThemeWizard zet `theme_id` nooit. 5 van 7 tenants hebben geen `theme_id`, dus de knop is voor hen dood. De wizard heeft een eigen publish-pad dat `is_published` direct zet; daardoor werkt het "half".

### 1.2 Geen echt template-systeem
Tabel `themes` bevat 3 rijen (Modern/Classic/Bold) zonder preview-afbeeldingen. De ThemeWizard is een kleur/mood/typografie-generator, geen template-kiezer. Er bestaat geen gallery, geen seeding van secties/pagina's, geen "kies deze look en je shop staat er".

### 1.3 Vermenging Settings ↔ Webshop
Instellingen → Webshop bevat drie secties:
- **Webshop-instellingen** (`StorefrontSettings.tsx`): domeinen-samenvatting, custom-frontend toggle/URL, storefront API-keys, custom head scripts. → Hoort (grotendeels) hier.
- **Webshop-functies** (`StorefrontFeaturesSettings.tsx`): nieuwsbrief-popup, checkout-formulier, productweergave, cookie banner, trust badges, navigatie, conversie-boosters, taalwisselaar. Wordt integraal disabled zodra custom frontend actief is — bewijs dat dit webshop-eigen instellingen zijn. → Hoort in de Webshop-pagina.
- **Winkelinstellingen** (`StoreSettings.tsx`): BTW%, valuta, verzending-toggle, admin-dark-mode. Allegaartje; niets hiervan is webshop-specifiek. → Ontmantelen.

Daarnaast hangen `NewsletterSettings` en `ReviewsHub` (uit de storefront-componentenmap) onder Instellingen → SellQo Connect.

### 1.4 Data
`tenant_theme_settings` is één tabel van ±75 kolommen: frontend-modus + theme + gedrag + reviews + talen + status/wachtwoord. De gewenste scheiding bestaat op dataniveau niet. Dit blijft in deze reeks zo (strikt additief); de scheiding wordt op UI-niveau gemaakt.

### 1.5 Gebruik
5/7 tenants op custom frontend. Platform-breed: 3 homepage-secties, 1 storefront-pagina. De ingebouwde webshop is de facto onbewezen — herbouw heeft dus vrij spel binnen de wet van §0.

---

## 2. Doelbeeld — de Shop Studio

### 2.1 Twee gezichten van `/admin/storefront`

**A. Onboarding-flow (tenant zonder ingerichte shop):**
1. **Template-gallery** — 6 volwaardige templates per branche (zie §3) met echte previews (desktop + mobiel).
2. **Kies template** → seedt homepage-secties, voorbeeldpagina's en theme-defaults voor deze tenant.
3. **Branding-stap** — logo/favicon upload + merkkleur (hergebruik van de bestaande palette-generator uit de ThemeWizard; die logica is goed).
4. **Preview → Publiceren.** Klaar. "Van idee naar live shop in één dag."

**B. Studio-dashboard (tenant met ingerichte shop):**
- Kopkaart: live-status, primaire URL, preview-knop, werkende publish-knop.
- **Launch-checklist:** logo ✓ · theme ✓ · homepage ✓ · juridische pagina's ✓ · betaalmethode ✓ · verzending ✓ · domein ✓ — met directe links naar elke stap.
- Secties (linkernavigatie):
  1. **Design** — template + kleuren/typografie/layout (huidige wizard-stap 4 + advanced, herwerkt)
  2. **Homepage** — builder, visual editor primair
  3. **Pagina's** — content-pagina's
  4. **Juridisch** — bestaande LegalPagesManager
  5. **Navigatie** — menu's/footer (recon in WEBSHOP-1 bepaalt scope)
  6. **Functies & Gedrag** — het volledige huidige StorefrontFeaturesSettings-blok (nieuwsbrief, checkout, productweergave, trust, navigatie-gedrag, conversie, talen-selector)
  7. **Status** — online / wachtwoord / offline + storefront-wachtwoord

**C. Custom-frontend-staat:** staat `use_custom_frontend` aan, dan toont de Webshop-pagina één duidelijke, rustige alternatieve staat: "Je draait een custom frontend — deze studio beheert alleen de SellQo-webshop" met link naar Instellingen → Webshop. Geen amber-banners verspreid over tien plekken.

### 2.2 Scheiding (de kern van de opdracht)

| Blijft in Instellingen → Webshop | Verhuist naar Webshop-pagina |
|---|---|
| Frontend-modus (SellQo vs custom) | Alles uit "Webshop-functies" (StorefrontFeaturesSettings) |
| `custom_frontend_url` + config | Theme/design, homepage, pagina's, juridisch |
| Storefront API-keys | Talen-selector-stijl |
| Custom head scripts / tracking | Storefront-status + wachtwoord |
| Domeinen-verwijzing (link) | |

**StoreSettings wordt ontmanteld (batch 4b):** BTW% → Financieel › BTW-instellingen · valuta → Bedrijfsgegevens · verzending-toggle → Verzending · systeemthema-toggle → Mijn profiel.

---

## 3. Template-systeem (spec)

- Tabel `themes` **additief** uitbreiden met: `category text`, `preview_desktop_url text`, `preview_mobile_url text`, `seed_definition jsonb`, `sort_order int`. Bestaande kolommen ongemoeid.
- `seed_definition` bevat: array homepage-secties (type, title, content, settings, sort_order), array voorbeeldpagina's (slug, title, content), theme-defaults (mode, style, fonts, header_style, card_style, e.d.).
- **Seed-flow:** template kiezen schrijft `theme_id` + defaults naar `tenant_theme_settings` en INSERT de secties/pagina's voor die tenant. Heeft de tenant al secties/pagina's → expliciete bevestiging vóór vervangen; vervangen = soft (bestaande op `is_visible=false` of gearchiveerd, nooit hard delete zonder bevestiging).
- **Zes launch-templates** (voorstel): Fashion/streetwear · Food/ambacht (bakker-slager) · Elektronica/gadgets · Diensten/afspraken · Interieur/lifestyle · Minimal one-pager. Elk met eigen secties-opbouw, tone-of-voice in voorbeeldcontent (NL) en passende theme-defaults.
- Previews: gerenderde screenshots van elk template op Speeltuin-data, geüpload naar storage; geen verzonnen mockups.
- Dit fixt en passant de publish-bug: `theme_id` wordt voortaan altijd gezet; publish-conditie wordt herzien.

---

## 4. Batches

| Batch | Scope | Schrijft aan |
|---|---|---|
| **WEBSHOP-1** | Rest-recon: kwaliteit StorefrontPagesManager / LegalPagesManager / visual-editor, bestaande status-UI, feature-gating `webshop_builder` per plan, navigatie/menu-datamodel. IA definitief. | alleen docs |
| **WEBSHOP-2** | Nieuwe pagina-shell: Studio-dashboard, linkernavigatie, status-kopkaart, launch-checklist, custom-frontend-staat, publish-flow gefixt. Bestaande tab-componenten worden ingehangen (nog niet herwerkt). | frontend |
| **WEBSHOP-3** | Template-systeem: additieve schema-uitbreiding `themes`, 6 templates + seeds, gallery, onboarding-flow, seed-edge-logica. | schema (additief) + frontend + seeds |
| **WEBSHOP-4** | Settings-migratie: Functies & Gedrag → Webshop-pagina; Instellingen → Webshop uitkleden tot frontend-modus/API/tracking; **4b:** StoreSettings ontmantelen naar juiste secties. | frontend |
| **WEBSHOP-5** | Builder-polish: visual editor primair, section-editor UX, pagina-manager verbeteren, Design-sectie herwerkt. | frontend |
| **WEBSHOP-6** | Slottaken: i18n (NL/EN/FR/DE), `doc_articles` (doc_level='tenant', context_path='/admin/storefront'), publieke changelog, newsletter-wachtrij-item, role-audit afronding. | content/docs |

Per batch geldt de standaard release-werkwijze: recon → review → go → implementatie → post-flight verificatie → paper trail. Changelog/blog pas wanneer 100% werkend en getest (Speeltuin + Demo Bakkerij).

---

## 5. Risico's

- **Gedeelde paden:** `tenant_theme_settings` wordt gelezen door storefront-resolve/api en dus door alle custom frontends. Mitigatie: §0, alleen additief, contract-tests via bestaande VanXcel-proxy smoke-check na elke schema-batch.
- **Seed-flow op bestaande data:** nooit destructief zonder expliciete bevestiging in de UI.
- **Settings-verhuis:** deep-links (`?section=webshop-features` e.d.) kunnen in gebruik zijn → redirects behouden.
- **Feature-gating:** `webshop_builder` featureKey blijft de toegangspoort; plan-afhankelijkheid checken in WEBSHOP-1.

---

## 6. Open beslispunten

| ID | Vraag | Voorstel |
|---|---|---|
| OB-WS-1 | Hoeveel templates bij launch? | 6 |
| OB-WS-2 | Navigatie/menu-editor in scope van deze reeks? | Recon WEBSHOP-1 beslist; anders backlog |
| OB-WS-3 | Oude Settings-secties: verwijderen of redirect? | Redirect één release, dan weg |
| OB-WS-4 | StoreSettings-ontmanteling in 4b of aparte reeks? | 4b, klein en afgebakend |
| OB-WS-5 | Template-previews: screenshots of SVG-illustraties? | Screenshots op Speeltuin-data |
| OB-WS-6 | Reviews-hub-instellingen mee verhuizen naar Studio? | Nee — blijft SellQo Connect (kanaal-koppeling), alleen weergave-opties zitten al in Functies & Gedrag |
