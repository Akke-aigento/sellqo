# WEBSHOP-1 — Recon & definitieve IA

**Status:** opgeleverd — 2026-08-12
**Scope:** alleen docs. Geen code, geen schema, geen data gewijzigd.
**Kader:** §0 van `webshop-masterplan.md` (de eerste wet) is leidend en is bij deze recon niet geraakt.

---

## 1. Wat de recon corrigeert aan het masterplan

Vier vondsten die het beeld uit §1 van het masterplan bijstellen. Alle vier geverifieerd in de code.

### 1.1 De template-kiezer bestaat al — maar is onbereikbaar

`src/components/admin/storefront/ThemeGallery.tsx` (217 regels) is een volwaardige theme-picker: hij zet `theme_id` én alle `default_settings` van het gekozen theme naar `tenant_theme_settings`, en heeft al een `AlertDialog` als bevestiging vóór overschrijven (regel 198-213).

**Het component wordt nergens geïmporteerd.** Dode code. `Storefront.tsx:49` hangt in de `theme`-tab de `ThemeWizard` op, niet de gallery.

Het masterplan (§1.2) stelt "er bestaat geen gallery". Correcter: *de gallery bestaat, werkt, en is nooit aangesloten*. Dat verkleint het werk in WEBSHOP-3 aanzienlijk.

### 1.2 De publish-bug ontstaat in `create-tenant`, niet in de ThemeWizard

Het masterplan (§1.1) wijst de ThemeWizard aan als oorzaak. De echte bron zit een laag dieper:

`supabase/functions/create-tenant/index.ts:267` maakt bij elke nieuwe tenant een `tenant_theme_settings`-rij aan met alle kleuren, fonts en layout-defaults — **maar zonder `theme_id`**. De kolom blijft `NULL`.

Gevolgketen:
- `Storefront.tsx:87` — Publiceren-knop is `disabled` zolang `themeSettings?.theme_id` leeg is → knop dood voor elke tenant die nooit handmatig een theme kreeg.
- `useStorefront.ts:392` — `getMergedSettings()` doet `if (!themeSettings?.themes) return null`. Geen `theme_id` betekent dus ook geen samengevoegde theme-instellingen.

Het aansluiten van de gallery (1.1) fixt beide symptomen in één keer, omdat de gallery `theme_id` wél zet. De structurele fix is daarnaast: `create-tenant` een default `theme_id` laten meegeven.

### 1.3 Additief uitbreiden is veilig — met één zichtbaarheidsnotitie

`supabase/functions/storefront-api/index.ts:172` doet `select('*')` op `tenant_theme_settings`. Nieuwe kolommen breken dus niets: de edge-functie hoeft niet aangepast te worden en §0 blijft intact.

Keerzijde: nieuwe kolommen **stromen automatisch mee** naar alle custom frontends die deze endpoint bevragen. Geen blocker, wel een bewuste keuze — extra velden zijn per definitie publiek zichtbaar voor de vijf custom-frontend tenants. Geen geheimen in additieve kolommen.

`storefront-api/index.ts:117` selecteert daarnaast expliciet alleen `use_custom_frontend, custom_frontend_url` — dat pad is smal en ongevoelig voor uitbreiding.

### 1.4 Er is geen navigatie-datamodel

Geen `menus`-, `menu_items`- of vergelijkbare tabel in `supabase/migrations/`. Navigatie komt volledig uit `storefront_pages.show_in_nav` (bool) + `nav_order` (int), aangelegd in migratie `20260121115200`.

---

## 2. Aanvullende bevindingen (kwaliteit bestaande schermen)

### 2.1 Bevestigde bug: de visual editor breekt content-pagina's

- `StorefrontPagesManager.tsx:129` slaat bij "Visueel bewerken" op als `content: JSON.stringify(blocks)`.
- `RichTextEditor` schrijft in datzelfde `content`-veld gewoon HTML.
- `ShopPage.tsx:74` rendert `page.content` onvoorwaardelijk via `dangerouslySetInnerHTML`.

Er is nergens een formaatdetectie. Een pagina die via de visual editor is opgeslagen, toont op de live winkel dus **letterlijke JSON**. Twee schrijvers, één kolom, één lezer die maar één van beide formaten kent.

Consequentie voor de planning: dit is geen polish-item voor WEBSHOP-5, maar een correctheidsprobleem dat vóór of tijdens het inhangen van de Pagina's-sectie opgelost moet worden. Voorstel: een expliciet `content_format`-veld (additief) of een gestandaardiseerde detectie aan de renderkant.

### 2.2 Dode sleep-affordance in Pagina's

`StorefrontPagesManager.tsx:310` toont per rij een `GripVertical`-icoon met `cursor-grab`, maar er is geen `DndContext` en geen drag-handler in het bestand. `nav_order` is via de UI dus niet te wijzigen — het icoon suggereert functionaliteit die er niet is. (De HomepageBuilder heeft wél werkende dnd-kit-sortering, `HomepageBuilder.tsx:343-364`.)

### 2.3 Statusbeheer bestaat op dataniveau, niet in de UI

`tenant_theme_settings` heeft `storefront_status` en `storefront_password`. Buiten de gegenereerde `src/integrations/supabase/types.ts` komen deze kolommen **nergens** voor — niet in componenten, niet in hooks, niet in edge-functies.

§2.1 punt 7 van het masterplan ("Status — online / wachtwoord / offline") is dus volledige nieuwbouw, niet het verplaatsen van bestaande UI.

### 2.4 Inconsistente bevestigingen

`StorefrontPagesManager.tsx:106` en `HomepageBuilder.tsx:197` gebruiken de native `confirm()` voor verwijderen, terwijl de rest van de storefront-UI shadcn `AlertDialog` gebruikt (zoals `ThemeGallery.tsx:198`). Meenemen bij het herwerken van die schermen.

### 2.5 Wat er wél goed staat

- **9 werkende sectierenderers** in `src/components/storefront/sections/`: hero, collection, featured products, text+image, video, testimonials, external reviews, newsletter, announcement. Ruim voldoende bouwmateriaal voor template-seeds — er hoeft voor de templates geen enkele nieuwe sectiesoort gebouwd te worden.
- **Visual editor is substantieel**: `visual-editor/` bevat canvas, context, inline tekst-editor, quick-edit paneel, media picker, SEO-score, AI-copy. Kwalitatief bruikbaar; het probleem is opslagformaat (2.1), niet de editor zelf.
- **HomepageBuilder** heeft werkende drag-and-drop, zichtbaarheidstoggles en een preview-paneel.
- **`themes`** heeft al een `preview_image_url`-kolom (migratie `20260121115200`, regel 11) — leeg, maar bruikbaar zonder nieuwe kolom voor de desktop-preview.

### 2.6 Feature-gating `webshop_builder`

Migratie `20260127101317`:

| Plan | `webshop_builder` |
|---|---|
| free | `false` |
| starter | `false` |
| pro | `true` |
| enterprise | `true` |

Toegangspoort staat in `sidebarConfig.ts:126`: `featureKey: 'webshop_builder'`, `excludeRoles: ['marketing']`, `requireRead: 'themes'`. Deze poort blijft ongewijzigd; de Shop Studio erft hem.

---

## 3. Genomen beslissingen (12-08-2026)

| ID | Beslissing | Gevolg |
|---|---|---|
| **OB-WS-1** | **3 templates bij launch**, op een structuur die uitbreiden triviaal maakt | Kleinere WEBSHOP-3; templates 4-6 als losse contentbatch later |
| **OB-WS-2** | **Volwaardige menu-editor in scope** | Nieuwe tabellen; krijgt een eigen batch (zie §4) |
| **OB-WS-5** | **Screenshots in de gallery + live preview na keuze** | `preview_image_url` (bestaand) + `preview_mobile_url` (nieuw); live iframe naast het Design-paneel |
| **Nieuw: instapmodel** | **Gallery eerst, wizard als optionele hulp** | ThemeWizard wordt gedegradeerd van verplicht startpad naar "Help me kiezen"-knop; de palette-generator blijft behouden |

OB-WS-3, OB-WS-4 en OB-WS-6 blijven staan op het voorstel uit het masterplan.

### 3.1 Het instapmodel, concreet

```
Tenant zonder ingerichte shop
  → Gallery: 3 templates, echte screenshots (desktop + mobiel)
  → optioneel: "✨ Help me kiezen" → ThemeWizard → eindigt in dezelfde seed
  → klik template → bevestiging → seed (theme_id + defaults + secties + pagina's)
  → Design-paneel met live preview van de eigen shop
  → Publiceren

Tenant met ingerichte shop
  → Studio-dashboard (kopkaart + launch-checklist + linkernavigatie)
  → "Ander template kiezen" opent dezelfde gallery, met waarschuwing
```

De gallery is dus geen eenmalige onboarding-stap maar een permanent bereikbare sectie binnen Design. Dat sluit aan op de wens: *thema aanklikken, daarna alles aanpassen*.

### 3.2 Menu-editor en §0

De menu-editor introduceert **nieuwe** tabellen; er wordt geen kolom toegevoegd aan of gewijzigd in `storefront_pages`, `tenant_theme_settings`, `themes` of `homepage_sections`. §0 blijft daarmee intact.

Harde eis voor deze batch: **de winkel valt terug op de huidige `show_in_nav`/`nav_order`-navigatie zolang er voor een tenant geen menu bestaat.** Geen menu = exact het huidige gedrag. Daarmee merken bestaande tenants én custom frontends er niets van.

---

## 4. Definitieve batch-indeling

Aangepast op de beslissingen hierboven.

| Batch | Scope | Schrijft aan |
|---|---|---|
| ~~WEBSHOP-1~~ | Recon + definitieve IA | ✅ dit document |
| **WEBSHOP-2** | Pagina-shell: Studio-dashboard, linkernavigatie, status-kopkaart, launch-checklist, rustige custom-frontend-staat. Publish-flow gefixt (incl. `create-tenant` default `theme_id`). Bestaande tab-componenten ingehangen. | frontend + `create-tenant` |
| **WEBSHOP-3** | Template-systeem: additieve uitbreiding `themes`, 3 templates + seeds, gallery aangesloten, seed-logica, screenshots. Wizard gedegradeerd tot "Help me kiezen". | schema (additief) + frontend + seeds |
| **WEBSHOP-4** | Settings-migratie: Functies & Gedrag → Webshop-pagina; Instellingen → Webshop uitkleden. **4b:** StoreSettings ontmantelen. | frontend |
| **WEBSHOP-5** | Builder-polish: **fix content-formaat (§2.1) als eerste taak**, visual editor primair, Design-sectie herwerkt, dode sleep-affordance (§2.2) opgelost, `confirm()` → AlertDialog (§2.4). | frontend (+ evt. additieve `content_format`) |
| **WEBSHOP-5b** | Menu-editor: nieuwe tabellen, meerdere menu's, submenu's, externe links, footer-kolommen. Fallback op bestaande navigatie verplicht. | nieuw schema + frontend |
| **WEBSHOP-6** | Slottaken: i18n (NL/EN/FR/DE), `doc_articles`, changelog, newsletter-wachtrij, role-audit afronding. | content/docs |

**Statusbeheer** (§2.3) is nieuwbouw en hangt in WEBSHOP-2 (kopkaart) plus de Status-sectie.

---

## 5. Openstaande punten voor WEBSHOP-2

1. Welke drie branches voor de launch-templates? Voorstel: **Mode/lifestyle · Food/ambacht · Minimal one-pager** — dekt Demo Bakkerij (food) en Speeltuin (generiek) als testbed.
2. Krijgt `create-tenant` een default `theme_id`, of blijft nieuw = leeg met verplichte gallery-keuze? Voorstel: **leeg laten en de gallery afdwingen** — een default-theme maakt de keuze onzichtbaar en dat is precies wat we willen vermijden. De publish-conditie wordt dan losgekoppeld van `theme_id`.
3. Deep-link-redirects (`?section=webshop-features`): welke zijn in gebruik? Te bepalen bij WEBSHOP-4.

---

## 6. Verantwoording

Geen code, schema of data gewijzigd in deze batch. Geen role-audit-entry nodig (`docs/role-audit.md` ongewijzigd) — er zijn geen rechten, RLS-policies of gedeelde paden geraakt.

Alle bovenstaande vindingen zijn gelezen uit de werkkopie op `main` (commit `95473045`). Regelnummers verwijzen naar die staat.
