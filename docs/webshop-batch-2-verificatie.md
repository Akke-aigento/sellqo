# WEBSHOP-2 — Pagina-shell: implementatie & verificatie

**Status:** afgerond en goedgekeurd — 2026-08-12
**Scope:** frontend. Geen migraties, geen edge-functies, geen schemawijziging.

---

## 1. Pre-flight (§0)

| Controle | Uitkomst |
|---|---|
| Migraties gewijzigd? | Nee — `supabase/migrations/` ongewijzigd |
| Edge-functies gewijzigd? | Nee — `storefront-resolve`, `storefront-api`, `checkout-engine` niet aangeraakt |
| Gedeelde tabellen gewijzigd? | Nee — geen kolom toegevoegd, hernoemd of verwijderd |
| `use_custom_frontend`-pad geraakt? | Nee — opslag en gedrag ongewijzigd; alleen de *presentatie* in de admin is verplaatst |
| `create-tenant` gewijzigd? | Nee — conform de beslissing om `theme_id` leeg te laten |

Gewijzigde bestanden:

```
 M src/components/storefront/ShopLayout.tsx      (+22)
 M src/hooks/useStorefront.ts                    (+1/-1)
 M src/pages/admin/Storefront.tsx                (herschreven)
 M src/types/storefront.ts                       (+16/-1)
?? src/components/admin/storefront/studio/       (4 nieuwe componenten)
?? src/hooks/useLaunchChecklist.ts               (nieuw)
```

---

## 2. Wat er gebouwd is

### 2.1 Studio-shell (`src/pages/admin/Storefront.tsx`)

Zes secties in de linkernavigatie: **Overzicht · Design · Homepage · Pagina's · Juridisch · Status**.

Bewust *niet* opgenomen: "Navigatie" (komt in WEBSHOP-5b) en "Functies & Gedrag" (komt in WEBSHOP-4). Een menu-item dat nergens heen gaat is precies de dode affordance die de recon in §2.2 aanwees; die fout herhalen we niet.

De actieve sectie zit nu in de URL (`?section=homepage`). Daardoor zijn de checklist-items aanklikbaar, werkt de browser-terugknop en kan er later naar een sectie gelinkt worden.

### 2.2 Kopkaart (`studio/StudioHeader.tsx`)

Status-badge, primaire URL, preview-link, publiceerknop en de datum van de laatste publicatie.

**De publish-bug is hier gefixt.** De knop was `disabled` zolang `themeSettings?.theme_id` leeg was; die conditie is verwijderd. Publiceren hangt niet langer af van een kolom die voor de meeste tenants leeg is.

### 2.3 Launch-checklist (`hooks/useLaunchChecklist.ts` + `studio/LaunchChecklist.tsx`)

Acht items: logo · design · homepage · pagina's · juridische pagina's · betaalmethode · verzending · domein. Elk item linkt naar de plek waar het afgerond wordt — binnen de studio via de sectie-navigatie, daarbuiten via `/admin/shipping`, `?section=payments` en `?section=domain`.

De hook leest uitsluitend bestaande bronnen en schrijft niets. `payment_methods_enabled` wordt apart opgehaald omdat dat veld niet op het gedeelde `Tenant`-type staat; dat type verbreden zou veel meer raken dan deze checklist rechtvaardigt.

`isReadyToLaunch` telt het domein niet mee — een winkel kan prima live op de `/shop/<slug>`-URL.

### 2.4 Custom-frontend-staat (`studio/CustomFrontendState.tsx`)

De amber waarschuwingsbalk boven elke tab is vervangen door één rustige uitleg-pagina, conform §2.1-C van het masterplan.

Belangrijk: deze tenants worden **niet buitengesloten**. De knop "Toch de SellQo-winkel beheren" opent de volledige studio. Ze kunnen dus nog steeds juridische pagina's of de ingebouwde winkel beheren — er is alleen niet langer een waarschuwing die zich op tien plekken herhaalt.

### 2.5 Status-sectie (`studio/StatusSection.tsx`)

Twee keuzes: **online** en **offline**.

**Wachtwoordbeveiliging is bewust weggelaten.** `storefront_password` zit niet in de publieke view `tenant_theme_public`, dus de winkel kan een wachtwoord niet verifiëren. Een optie die suggereert dat de winkel afgeschermd is terwijl iedereen erbij kan, is gevaarlijker dan geen optie. Wachtwoordbeveiliging vraagt om een verify-endpoint en hoort in een eigen batch.

### 2.6 Handhaving (`src/components/storefront/ShopLayout.tsx`)

Zonder handhaving zet de Status-knop een vlag die niemand leest — exact het defect dat de recon bij de publiceerknop vaststelde. Daarom is de gate meteen meegebouwd.

Drie eigenschappen die dit veilig maken:

1. **Fail-open.** Alleen de letterlijke waarde `'offline'` schermt af. Een lege, onbekende of afwijkende waarde levert altijd een zichtbare winkel op. Dat is nodig omdat `storefront_status` geen migratie in de repo heeft (zie §3) en de default dus niet uit de code te verifiëren is.
2. **Alleen de SellQo-winkel.** De gate zit in `ShopLayout`, die uitsluitend de `/shop/*`-routes omhult. Custom frontends halen hun data via `storefront-api` en komen hier nooit langs.
3. **Leest een bestaand veld.** `storefront_status` zat al in de view `tenant_theme_public`; er is niets aan de view of het schema gewijzigd.

---

## 3. Databasecontrole — uitgevoerd

**`storefront_status` heeft geen migratie in de repo.** De kolom bestaat in de live database (zichtbaar in de gegenereerde `src/integrations/supabase/types.ts`, `NOT NULL`) en in de view `tenant_theme_public`, maar is buiten de migraties om toegevoegd. De default was dus niet uit de code af te leiden en is nagetrokken met:

```sql
SELECT t.slug, tts.storefront_status, tts.is_published, tts.theme_id
FROM tenant_theme_settings tts
JOIN tenants t ON t.id = tts.tenant_id;
```

**Uitkomst (12-08-2026):**

- Beide testbedden (`demo-bakkerij`, `sellqo-speeltuin`) staan op `'online'`.
- Geen enkele tenant staat op `'offline'` → de nieuwe gate in `ShopLayout` verandert voor geen enkele bezoeker iets.
- De vijf custom-frontend tenants staan correct op `use_custom_frontend = true`.
- **VanXcel staat op `'password'`.**

### 3.1 Wat die 'password'-waarde blootlegde

De query bracht een defect aan het licht in `StatusSection.tsx` zoals eerst opgeleverd: die normaliseerde élke niet-`'offline'` waarde naar `'online'`. Voor VanXcel toonde de UI dus "Online" terwijl er `'password'` stond — en de eerste de beste wijziging zou die waarde stilzwijgend hebben overschreven. VanXcel is een live tenant.

Verholpen vóór commit: onbekende waarden worden niet langer als `'online'` gepresenteerd. De radiogroep laat dan bewust niets voorgeselecteerd en er verschijnt een melding die de opgeslagen waarde toont en waarschuwt dat een keuze die waarde vervangt. Zo kan de instelling alleen nog bewust verdwijnen, niet per ongeluk.

De gate in `ShopLayout` was hier niet bij betrokken: die is fail-open (alleen `'offline'` blokkeert) en VanXcel draait op een eigen frontend, dus komt er nooit langs.

---

## 4. Verificatie

| Controle | Resultaat |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | ✅ exit 0, geen output |
| `eslint` op alle nieuwe bestanden | ✅ schoon |
| `eslint` op `ShopLayout.tsx` | ✅ 23 problemen vóór én na de wijziging — identiek, geen nieuwe |
| `npm run build` | ✅ exit 0, gebouwd in 1m04 (alleen de bestaande chunk-size-waarschuwing) |
| SQL-natrek `storefront_status` (§3) | ✅ geen tenant op `'offline'`; live tenants ongemoeid |
| Smoke-test Speeltuin | ⬜ open |
| Smoke-test Demo Bakkerij | ⬜ open |

Kanttekening bij de eerste run: `tsc` werd aanvankelijk via `| head -30` aangeroepen, waardoor de exit code van `head` werd afgelezen in plaats van die van `tsc`. Er stond wél een fout in (`LaunchChecklist.tsx:56`, union-narrowing binnen een callback). Die is verholpen door `item.target` naar een lokale constante te tillen; de tweede run is schoon met een correct afgelezen exit code.

### 4.1 Nog te doen bij de smoke-test (door jou, of samen)

1. `/admin/storefront` op Speeltuin: alle zes secties openen, checklist-links volgen.
2. Publiceerknop indrukken op een tenant **zonder** `theme_id` — dit was het defect.
3. Status op offline zetten, `/shop/sellqo-speeltuin` bezoeken → "Binnenkort open". Daarna terug op online.
4. Een custom-frontend tenant (bv. VanXcel) openen → rustige uitlegpagina, geen amber balken. Controleren dat de live site onveranderd is.
5. De SQL uit §3 draaien.

---

## 5. Openstaand

- Handmatige smoke-test op beide testbedden (§4.1) in de draaiende app.
- `docs/role-audit.md`: geen entry nodig. Er zijn geen rollen, RLS-policies of rechten geraakt; de featurepoort `webshop_builder` in `sidebarConfig.ts:126` is ongewijzigd.
- De gate in `ShopLayout` is voorgelegd als bezoeker-zichtbare gedragswijziging en op 12-08-2026 goedgekeurd: fail-open, alleen `'offline'` blokkeert, raakt enkel `/shop/*`.

## 6. Meegenomen naar een latere batch

- **Wachtwoordbeveiliging.** VanXcel's `'password'`-waarde bevestigt dat dit ooit bedoeld is. Een werkende implementatie vraagt om server-side verificatie, want `storefront_password` hoort niet in de publieke view thuis. Eigen batch.
- **Migratie voor `storefront_status`.** De kolom bestaat alleen in de live database. Een inhaalmigratie zou de repo weer in lijn brengen met de werkelijkheid — buiten scope hier, wel het noteren waard.
