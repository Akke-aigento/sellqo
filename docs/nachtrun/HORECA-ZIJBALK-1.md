# HORECA-ZIJBALK-1 — kortere horeca-zijbalk, live Zaal, Bestellen opgesplitst — 1-2 november 2026

Nachtrun, bouwer ADMIN, branch `night-admin`.

## 0. Inventaris vooraf (CLAUDE.md §8.1)

Gemeten op de code van `origin/main` (e360712) en de live-DB (read-only, 1 nov 2026).

| Plek | Doet nu | Wat verandert | Voorstel / keuze |
|---|---|---|---|
| Zijbalk horeca-only (`sidebarConfig.ts`, `visibleNavIds(['horeca'])`) | Dashboard, Bestellingen, Kassa (POS), Zaalplan, Kaart, Betalingen, Rapporten, SellQo-plan, Instellingen, Help — verdeeld over 4 groepen in de volgorde van de webshop-groepen | Eigen horeca-volgorde | Vandaag · Kassa-app · Zaal · Keuken · Bestellingen │ Kaart · Betalingen · Rapporten · Inkoop │ Instellingen · Help. Zelfde NavItems (geen tweede definitie), enkel een andere ordening (`sidebarLayout`). |
| Zijbalk horeca + webshop/events | Horeca-items verspreid in Verkoop (Kassa, Zaalplan, Kaart); Keuken nergens | Horeca-items samen | Eigen groep **Horeca** (Kassa, Zaal, Keuken, Kaart) na Dagelijks; de rest van de webshop-zijbalk ongewijzigd. Geen dubbels (test). |
| Item `ordering` ("Zaalplan") | Wees naar `/admin/bestellen?tab=zaal` = de zaalplan-editor. Lichtte nooit op (activeUrl vergelijkt enkel pathname) | Label "Zaal", url `/admin/zaal` (live overzicht) | Id `ordering` blijft (geen live verwijzingen in `sidebar_preferences`/`hidden_pages`, gemeten). |
| Item `horeca-menu` ("Kaart") | `/admin/bestellen?tab=kaart`, lichtte nooit op | url `/admin/bestellen` (Kaart is de standaardtab) | Licht nu op op de Bestellen-pagina. |
| Item `kitchen` ("Keuken") | `sidebarTracks: []` → enkel via Instellingen › Meer onderdelen | In de zijbalk voor horeca | `sidebarTracks: ['horeca']`. |
| Item `purchasing` ("Inkoop", `/admin/suppliers`) | `sidebarTracks: ['webshop']` → horeca via Meer onderdelen | In de zijbalk voor horeca | `sidebarTracks: ['webshop','horeca']`. |
| Item `billing` ("SellQo-plan") | Kern, overal in de zijbalk | Niet in de afgesproken horeca-lijst | `sidebarTracks: ['webshop','events']`: horeca-only vindt het onder Instellingen › Meer onderdelen (bestaand mechanisme, TRACKS-3). |
| Item `pos` | Label "Kassa (POS)"; horeca-only opent `/kassa` | Label | Horeca zonder webshop: "Kassa-app" (zelfde voorwaarde als de url-regel `bottomNavUrl`). Met webshop blijft "Kassa (POS)" → kassabeheer. |
| Item `dashboard` | "Dashboard" (onderbalk zegt al "Vandaag" bij horeca) | Label | "Vandaag" bij horeca, zoals de onderbalk (`bottomNavLabelKey`). |
| Gsm-onderbalk (`bottomNav.ts`) | Horeca-standaard eindigt op `ordering` met label "Kaart" — opende dus de zaalplan-editor | `ordering` wordt Zaal | Standaard eindigt op `horeca-menu` (Kaart, opent nu echt de Kaart); `ordering` krijgt kort label "Zaal". Live: geen enkele `sidebar_preferences.bottom_nav` gezet (gemeten), dus niemand verliest een keuze. |
| `/admin/bestellen` (OrderingHub, 9 tabs) | Kaart, Overzicht, Webshop, QR, Zaal, Reservaties, Posten, Extra's, Allergenen op één rij | Opsplitsen | Bovenaan **Kaart · Overzicht · Reservaties · Instellen**. "Instellen" toont een tweede rij: QR-menu · Posten · Extra's · Allergenen · Afhalen & leveren. Alle bestaande `?tab=`-waarden blijven geldig (zie §motivering). `?tab=zaal` → redirect naar `/admin/zaal?tab=bewerken`. |
| `/admin/zaal` | Bestaat niet | Nieuw | Tab **Live** (standaard): zaalplan met kleur per tafel + lijst open rekeningen (tafel, status, open sinds, bedrag), read-only, peilt elke 10 s op `horeca_state.version` en haalt enkel bij verschil `horeca_snapshot` op (zelfde bron als de kassa, trager). Tab **Zaalplan bewerken** (`?tab=bewerken`) = de bestaande `FloorPlanEditor`. |
| Instellingen › Horeca (`HorecaSettingsHub.tsx`) | Links met stand; "Zaalplan" → `?tab=zaal` | Link + GKS-uitleg | Link naar `/admin/zaal?tab=bewerken`; GKS-melding bovenaan. Blijft een linkpagina (geen tweede bewerkplek). |
| Links naar `?tab=zaal` | OrderingHub Overzicht + MenuQrManager `onOpenFloorPlan` | Doel | Naar `/admin/zaal?tab=bewerken`. |
| Links naar `?tab=qr/posten/extras/reservaties` | HorecaPaySettings, HorecaPrinters, ProductStationCard, ProductAddonsCard, Storefront `?section=` → HUB, notificaties reservatie (live: geen rijen met `/admin/bestellen`) | Niets | Blijven werken, ongewijzigd. |
| `doc_articles` live | `zaalplan-en-qr-per-tafel` (context `/admin/bestellen`, "Bestellen → Zaalplan"), `kassa-tafels-rekeningen`, `qr-online-betalen` ("Bestellen › Zaalplan"), `qr-tafelrekening` ("Bestellen › QR-menu"), `horeca-werkplek` (menu-uitleg), `horeca-kaart` ("Bestellen › Kaart") | Teksten en context | Migratie `20261101230400`: zaalplan-artikel naar context `/admin/zaal`, padteksten bijgewerkt, werkplek-artikel herschreven (nieuwe zijbalk + GKS), nieuw artikel "Live zaaloverzicht". |
| i18n | Geen key voor "Zaal", "Kassa-app", groep "Horeca" | Nieuwe keys | In nl/en/fr/de/uk. |
| Kassa (`src/kassa/**`) | Leest `horeca_snapshot` | Niets | Niet aangeraakt; enkel de pure helper `checkTotalCents` en het type `Check` geïmporteerd (zelfde bedrag als de kassa, één bron per getal). |
| Rapporten / personeel | — | Niets | Niet aangeraakt (bouwer RAPPORT). |

### Motivering Bestellen-hub: instel-tabs blijven in Bestellen, gegroepeerd

Het voorbeeld uit de opdracht (instel-tabs naar Instellingen › Horeca) is bewust **niet** gekozen:

1. `HorecaSettingsHub` is ontworpen als linkpagina met de stand ("één plek per taak, een tweede plek is enkel een link"). Vijf bewerkschermen erin verhuizen maakt er een tweede bewerkplek van, of vraagt een volledige verhuis van vijf componenten met redirects.
2. `Settings.tsx` leest enkel `?section=` (CLAUDE.md §6): elke diepe link (`?tab=qr`, `?tab=posten`, `?tab=extras`) zou een nieuw sub-sectiemechanisme in Instellingen vragen en zes bestaande links breken of laten redirecten.
3. De instel-tabs worden door dezelfde mensen gebruikt als de Kaart (beheerder/medewerker); in Instellingen staan ze achter `settings_general`, wat de rechten voor staff verandert.

Gekozen: één extra niveau. De bovenste rij heeft nog vier tabs (past op 390 px), de vijf instel-tabs staan onder **Instellen**, elk nog altijd rechtstreeks deeplinkbaar met hun eigen `?tab=`. Geen enkele bestaande link verandert van doel; Instellingen › Horeca blijft ernaar linken.

## 1. Paper trail (voor `docs/role-audit.md`)

## HORECA-ZIJBALK-1 — kortere horeca-zijbalk, live Zaal, Bestellen opgesplitst — 1 november 2026

**Root cause**
- `sidebarConfig.ts` kende maar één ordening (webshop-groepen Dagelijks/Verkoop/Marketing/Beheer/Systeem). Een horecazaak kreeg haar items verspreid over vier groepen, met "SellQo-plan" ertussen en zonder Keuken en Inkoop (`kitchen` had `sidebarTracks: []`, `purchasing` `['webshop']`).
- "Zaal(plan)" (`ordering`) wees naar `/admin/bestellen?tab=zaal`: de editor, geen live beeld. Er bestond geen alleen-lezen overzicht van de open rekeningen in het beheer.
- `ordering` en `horeca-menu` hadden een `?tab=` in hun url; `AdminSidebar.activeUrl` vergelijkt enkel `pathname`, dus ze lichtten nooit op.
- Gsm-onderbalk: de horeca-standaard eindigde op `ordering` met kort label "Kaart" (`bottomNav.ts` SHORT_LABEL) maar opende het zaalplan.
- `OrderingHub.tsx` had negen tabs op één rij, dagelijks werk en eenmalige instellingen door elkaar.
- Instellingen › Horeca zei niets over GKS, terwijl SellQo Kassa nog niet gecertificeerd is (CLAUDE.md §9).

**Uitgevoerd**
- `src/components/admin/sidebar/sidebarConfig.ts`: `sidebarLayout(has)` — horeca-only: Dagelijks (Vandaag, Kassa-app, Zaal, Keuken, Bestellingen) · Beheer (Kaart, Betalingen, Rapporten, Inkoop) · Systeem (Instellingen, Help); horeca + webshop/events: eigen groep "Horeca" (Kassa, Zaal, Keuken, Kaart) na Dagelijks; anders `sidebarGroups` ongewijzigd. `ordering` → `/admin/zaal`, label `navigation.items.floor`; `horeca-menu` → `/admin/bestellen`; `kitchen` in de zijbalk voor horeca; `purchasing` `sidebarTracks ['webshop','horeca']`; `billing` `sidebarTracks ['webshop','events']` (horeca-only: via Instellingen › Meer onderdelen). `visibleNavIds` volgt de layout. Id's ongewijzigd.
- `src/components/admin/sidebar/bottomNav.ts`: `sidebarLabelKey` ("Vandaag" bij horeca, "Kassa-app" bij horeca zonder webshop — zelfde voorwaarde als `bottomNavUrl`); standaard-onderbalk eindigt op `horeca-menu` (Kaart); `ordering` kort label "Zaal".
- `src/components/admin/AdminSidebar.tsx`: rendert `sidebarLayout(hasTrack)` en de labels via `sidebarLabelKey`.
- Nieuw `src/pages/admin/Floor.tsx` + route `zaal` in `src/App.tsx` (RouteGuard `orders`, horeca-module-gate): tabs Live (standaard) en Zaalplan bewerken (`?tab=bewerken`, de bestaande `FloorPlanEditor`).
- Nieuw `src/components/admin/horeca/LiveFloorOverview.tsx`, `src/hooks/useLiveChecks.ts`, `src/lib/horeca/liveFloor.ts` (+ test): peilt elke 10 s `horeca_state.version`, haalt enkel bij een nieuwe versie `horeca_snapshot` op (zelfde RPC als de kassa), toont zaalplan in kassakleuren met "bedrag · minuten" per tafel en een lijst van alle open rekeningen (tafel/naam/toog, deelrekening, personen, stand bezet/rekening gevraagd/wordt afgerekend, open sinds, bedrag). Bedrag = `checkTotalCents` uit `src/kassa/app/horeca/types.ts` (enkel geïmporteerd).
- `src/pages/admin/OrderingHub.tsx`: tabs Kaart · Overzicht · Reservaties · Instellen; onder Instellen een tweede rij QR-menu · Posten · Extra's · Allergenen · Afhalen & leveren. Alle oude `?tab=`-waarden werken; `?tab=zaal` → `<Navigate to="/admin/zaal?tab=bewerken" replace>`. Kop "Kaart & bestellen" (de zijbalk zegt "Kaart"). Padding `p-4 sm:p-6` (5 px horizontale overloop op 390 px weg).
- `src/components/admin/settings/HorecaSettingsHub.tsx`: GKS-melding bovenaan (niet gecertificeerd; > € 25.000/jaar excl. btw maaltijden ter plaatse of een FDM = GKS-plichtig; dan SellQo niet als registrerende kassa gebruiken zolang SellQo Kassa niet gecertificeerd is; twijfel → boekhouder). Geen datum, geen belofte. Link Zaalplan → `/admin/zaal?tab=bewerken`.
- i18n: 39 nieuwe keys in nl/en/fr/de/uk (`navigation.items.floor|pos_app`, `navigation.bottom.floor`, `navigation.groups.horeca`, `admin.orderingHub.tab_setup|page_title`, `admin.liveFloor.*`, `settings.horecaHub.gks_*`).
- Migratie `supabase/migrations/20261101230400_horeca_zijbalk_1_docs.sql` (zie §2).
- Tests: `horecaMenu.test.ts` (volgorde horeca, geen item kwijt t.o.v. de gewone groepen, labels, combinatie-groep), `bottomNav.test.ts` (nieuwe standaard + labels), `tracks.test.ts` (`/admin/zaal` en `/admin/bestellen` = horeca), nieuw `src/lib/horeca/liveFloor.test.ts`.
- Harnas: nieuw scenario `scripts/harness/scenarios/horeca-beheer` (zijbalk horeca-only en horeca+webshop, Zaal live/bewerken, Bestellen incl. `?tab=qr` en `?tab=zaal`, Instellingen › Horeca, Kaart als beheerder en als staff). `scripts/harness/vite.config.ts`: `HARNESS_CACHE_DIR` optioneel (zie Vervolg).

**Security-keuzes**
- Geen RLS, policies of grants geraakt. Live Zaal leest `horeca_state` (bestaande RLS, zoals de kassa) en roept `horeca_snapshot` aan (security definer, controleert lidmaatschap van de winkel; `grant execute … to authenticated`). Nooit `horeca_apply`: het scherm kan niets wijzigen.
- Route `/admin/zaal` achter `RouteGuard requireRead="orders"` + horeca-module-gate + TrackGate (`ordering.tracks = ['horeca']`), zelfde als `/admin/bestellen`. Zijbalk-item `ordering` behoudt `excludeRoles ['marketing','accountant','warehouse']`.

**Gedeelde paden**
- Geen `storefront-api`/`storefront-customer-api`/gedeelde storefront-tabellen geraakt. Geen edge functions. `src/kassa/**` niet gewijzigd (enkel type + pure functie geïmporteerd). Webshop-only zijbalk: `sidebarLayout` geeft `sidebarGroups` ongewijzigd terug (test `toBe(sidebarGroups)`); enige zichtbare verschil voor webshop-only: geen.

**Verificatie**
- `npx vitest run src/components/admin/sidebar src/test/tracks.test.ts src/lib/horeca src/components/admin/horeca` → 8 bestanden, 70 tests groen.
- `node scripts/i18n-parity.mjs` → exit 0 (10922 keys × 5 talen).
- `npx eslint` op alle gewijzigde en nieuwe bestanden → exit 0, gelijk aan de baseline (0).
- `npx tsc --noEmit -p tsconfig.app.json` → exit 2 met 27 fouten, allemaal `RejectExcessProperties` in niet-aangeraakte bestanden (useOrders, useQuotes, TrackingImportDialog, …); exact dezelfde 27 fouten/bestanden staan in de tsc-log van de RAPPORT-worktree (`/tmp/tsc-rapport.log`) → bestaand, niet van deze batch. 0 fouten in gewijzigde/nieuwe bestanden.
- Harnas `horeca-beheer` op 390 en 1280: geen console-/paginafouten; zijbalk horeca-only = "Vandaag · Kassa-app · Zaal · Keuken · Bestellingen · Kaart · Betalingen · Rapporten · Inkoop · Instellingen · Help"; horeca+webshop: groep Horeca met Kassa (POS) · Zaal · Keuken · Kaart, geen dubbels; geen horizontale overloop na de padding-fix. Screenshots `/tmp/harness/horeca-beheer-{390,1280}-*.png` bekeken.
- Migratie-replace vooraf gesimuleerd met een SELECT op de live `doc_articles` (alle 9 artikels veranderen, daarna geen "Bestellen ›/→" meer).
- `npm run build` niet gedraaid (geheugenkrapte in de sandbox; drie tsc's parallel). Nog te doen bij het samenvoegen.

**Bewust ongemoeid / Vervolg**
- `/admin/reports`, personeel/uren (bouwer RAPPORT) en `src/kassa/**` niet aangeraakt.
- Reservaties en QR-tafelaanvragen staan (nog) niet op Live Zaal; enkel open rekeningen (zoals gevraagd). Kan later met `fetchReservations` / `table_requests`, zelfde peiling.
- Instel-tabs bleven in Bestellen (motivering in §0); Instellingen › Horeca blijft een linkpagina.
- Key `admin.orderingHub.bestellen` is nu ongebruikt (laten staan, onschadelijk; opruimen in een i18n-sweep).
- Harnas: parallelle worktrees deelden `/tmp/harness-vite-cache` en braken elkaars dep-optimalisatie ("Failed to fetch dynamically imported module"). Nu `HARNESS_CACHE_DIR`. Ook: een koude Tailwind-transform van `src/index.css` duurde onder CPU-krapte > 30 s, waardoor `shoot.mjs` op de eerste `networkidle` time-out gaf; gemeten via `--serve` + eigen runner met ruimere time-outs.

## 2. Migratie

`supabase/migrations/20261101230400_horeca_zijbalk_1_docs.sql` — enkel `doc_articles` (tenant):
- snapshot `snapshots.sellqo_20261101_doc_articles_horeca_zijbalk1` van de 10 geraakte artikels;
- padteksten in 9 artikels: "Bestellen › Kaart" → "Kaart", "Bestellen › Posten" → "Kaart › Instellen › Posten", "Bestellen ›/→ Zaalplan" → "Zaal › Zaalplan bewerken", "Bestellen › QR-menu" → "Kaart › Instellen › QR-menu", "Bestellen › Reservaties" → "Kaart › Reservaties"; `zaalplan-en-qr-per-tafel` context → `/admin/zaal`;
- `horeca-werkplek` herschreven (nieuwe zijbalk, onderbalk, GKS-alinea);
- nieuw `zaal-live-overzicht` (context `/admin/zaal`, categorie …006, sort 7).
Idempotent; handmatig terugdraaien staat bovenaan. Draaien **na** de publish van de admin. Geen edge functions te deployen.

## 3. Changelog-tekst (NL)

**Titel:** Een kortere horeca-menu en een live zicht op je zaal
**Beschrijving:** Heb je een horecazaak, dan staat je menu nu in de volgorde van je dag: Vandaag, Kassa-app, Zaal, Keuken, Bestellingen, Kaart, Betalingen, Rapporten, Inkoop. Onder Zaal zie je live welke tafels open staan, voor hoeveel en sinds wanneer; je zaalplan bewerk je op de tab ernaast.

(type: improvement)

## 4. Samenhang

- **Bestond al:** zijbalk per spoor (TRACKS-1/2/3), Meer onderdelen, onderbalk (ONDERBALK-1), Bestellen-hub met 9 tabs, zaalplan-editor, kassa-zaalplan (TablesScreen), Instellingen › Horeca als linkpagina, 10 helpartikels met "Bestellen ›"-paden.
- **Aangepast/verhuisd:** "Zaal" wijst naar het nieuwe live overzicht; de editor verhuisde van `/admin/bestellen?tab=zaal` naar `/admin/zaal?tab=bewerken` (oude link redirect; alle verwijzingen in code — Overzicht-kaart, QR-tab, Instellingen › Horeca — en in de helpartikels bijgewerkt). Instel-tabs gegroepeerd onder "Instellen" zonder url-wijziging. Onderbalk "Kaart" opent nu echt de Kaart.
- **Wie is overgezet:** niemand nodig — live geen `sidebar_preferences.bottom_nav` en geen `hidden_pages` met `ordering`/`kitchen`/`horeca-menu` (gemeten 1-11). `hidden_pages` "purchasing" bij Astra Sleep en Mancini Milano blijft werken (id ongewijzigd; geen horeca).
- **Opgeruimd:** dode "Kaart"-label op de onderbalk die het zaalplan opende; items die nooit oplichtten.
- **Bewust blijven staan:** `admin.orderingHub.bestellen` (ongebruikte key); SellQo-plan voor horeca-only enkel via Meer onderdelen; webshop-only zijbalk identiek.
- **Sweep:** `grep -rn "bestellen?tab=zaal\|tab_floor"` → enkel nog de redirect in OrderingHub; `?tab=qr|posten|extras|reservaties`-links (HorecaPaySettings, HorecaPrinters, ProductStationCard, ProductAddonsCard, Storefront `?section=`-HUB, reservatienotificaties) werken ongewijzigd.

## 5. Aanvulling (ronde 3) — gsm-zijbalk a11y, boekhouding voor horeca, harnas parallel — 1 november 2026

**Root cause**
- `src/components/ui/sidebar.tsx`: de gsm-zijbalk (Radix `Sheet`) had geen `SheetTitle`/`SheetDescription` → console-error "DialogContent requires a DialogTitle" en geen naam voor schermlezers.
- SellQo Connect (`/admin/connect`, item `integrations`: `tracks ['webshop','events']`, `sidebarTracks ['webshop']`, `featureKey apiAccess`) bestaat niet voor een zaak met enkel horeca (TrackGate → "niet in je pakket"). De Odoo-koppeling (`OdooAccountingCard` + `OdooAccountingSettings`) stond enkel daar, dus horeca-only vond haar boekhoudinstellingen nergens.

**Uitgevoerd**
- `src/components/ui/sidebar.tsx`: `SheetHeader.sr-only` met `SheetTitle`/`SheetDescription` (i18n `navigation.sheet_title|sheet_desc`). Harnasfilter op die melding weggehaald; harnas draait zonder fouten.
- Nieuw `src/lib/accountingLink.ts` (+ test): één plek per winkel — horeca zonder webshop/events → `/admin/settings?section=accounting`; anders `/admin/connect?tab=accounting` (bestaande tab).
- Nieuw `src/components/admin/settings/AccountingSettings.tsx`: dezelfde `OdooAccountingCard` + dialoog met `OdooAccountingSettings` als in Connect, geen kopie van logica.
- `src/pages/admin/Settings.tsx`: sectie `accounting` in de groep Financieel, `tracks ['horeca']`, nieuw veld `hideWithTracks ['webshop','events']` (zo nooit twee plekken), `requiredRead settings_financial`.
- `src/components/admin/reports/HorecaReportsTab.tsx`: link "Boekhouding (Odoo)" bovenaan Rapporten › Horeca (Z-archief) naar `accountingUrl(hasTrack)`.
- `scripts/harness/shoot.mjs`: `HARNESS_TIMEOUT` (default 30000) voor goto, networkidle en stappen. `scripts/harness/README.md`: sectie "Parallel draaien" (eigen `HARNESS_CACHE_DIR`/`HARNESS_PORT`, opwarmen via `--serve`, lazy schermen + vers tabblad).
- Harnas `horeca-beheer`: schermen `settings-accounting` (zonder en met `odoo_sync`) en `reports`.
- i18n 9 keys × 5 talen.

**Security-keuzes / gating**
- Geen gating weggehaald of toegevoegd. `apiAccess` blijft op Connect; de Odoo-kaart bewaakt zelf `checkFeature('odoo_sync')` en toont zonder dat recht de bestaande upgradekaart (geen dode link). Edge functions `manage-odoo-connection` e.a. ongewijzigd. Rechten: sectie achter `settings_financial`; `OdooAccountingSettings` gebruikt intern `useCan`.
- `hideWithTracks`: in de platform-beheerweergave (hasTrack = alles) is de sectie verborgen; daar staat Connect open.

**Verificatie**
- vitest 12 bestanden, 81 tests groen (incl. `src/lib/accountingLink.test.ts` — toevoegen aan de Vitest-stap van ci.yml); i18n-parity exit 0; eslint gelijk aan baseline (0 fouten, 1 bestaande warning); `tsc` exit 0, 0 fouten.
- Harnas 390/1280 exit 0 zonder filter: upsell zonder `odoo_sync`, kaart "Niet verbonden / Verbind Odoo" met `odoo_sync`, rapportlink → `/admin/settings?section=accounting`.

**Beslispunt voor Akke (live gemeten 01-11, read-only)**
- `pricing_plans.features.odoo_sync` is **false** op Horeca Small en Horeca Big (true enkel op webshop Pro/Enterprise). Een horecazaak ziet dus altijd de upgradekaart, met de bestaande tekst "Beschikbaar op Pro of Enterprise" (webshopplannen). De kaart "Kassa-omzet naar Odoo" van bouwer ODOO (night-odoo) zal voor horeca-only achter dezelfde vergrendeling vallen als ze `odoo_sync` gebruikt. Aanbeveling: `odoo_sync` (of een eigen sleutel) aan Horeca Big toevoegen via een planmigratie + `landing.pricing.feat_*`-label (plan-scope-regel 28-10), en de upgradetekst van `OdooAccountingCard` per spoor maken (die is ook nog hardcoded Nederlands, bestaand).

**Samenhang**
- Bestond al: Connect › Boekhouding (webshop/events), Rapporten › Horeca (Z-archief), Instellingen › Financieel.
- Aangepast: horeca-only krijgt Instellingen › Boekhouding; elke winkel ziet precies één plek (getest).
- Bewust blijven staan: Connect zelf (en `apiAccess`) blijft webshop/events; geen nieuw zijbalk-item.
