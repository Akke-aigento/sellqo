# ALLERGEEN-ADMIN-1 — "geen" vs "niet ingevuld" in de admin — 1-2 november 2026

Nachtrun, bouwer ADMIN, branch `night-admin` (na merge van `night-final`). Bouwt verder op
ALLERGEEN-VERKLAARD-1 (bouwer API: `products.allergens_declared` + trigger + vinkje in `ProductAllergensCard`).

## Inventaris (CLAUDE.md §8.1)

| Plek | Doet nu | Wat verandert | Voorstel / keuze |
|---|---|---|---|
| `ProductAllergensCard` (productformulier + Kaart-paneel) | Vinkje "Bevat geen van de 14 allergenen" (API) | Niets | Eén bewerkplek; hier enkel lezen. |
| Kaart-paneel, kop "Extra's en allergenen" | Enkel "allergenen: n" als n > 0, anders niets | 3 standen | "allergenen: n" / "geen allergenen" / amber "allergenen niet ingevuld" (`AllergenStateLabel`). |
| Kaart-lijst (`KaartManager`) | Geen allergeneninfo | Teller | Amber balk "Bij n product(en) … nog niet ingevuld. Bekijk welke." → `Kaart › Instellen › Allergenen`. Geen kolom per rij (rommel). |
| `useKaart` | Selecteert `allergens` | + `allergens_declared`, `hide_from_storefront` | Valt terug zonder de kolom bij 42703 (admin live vóór de migratie). |
| Allergenenkaart (`AllergenChart`, Bestellen › Instellen › Allergenen) | Telt "leeg" als ontbrekend, print lege rij = lijkt "geen" | 3 standen + to-do | Per rij "geen allergenen" of amber "niet ingevuld"; lijst "Nog in te vullen" met link naar het product; afdruk zet "(geen allergenen)" / "(niet ingevuld)" achter de naam. Zelfde selectie als de Kaart-teller (`onAllergenChart` + `KAART_TYPES`) → zelfde getal. |
| `kaart_duplicate_product` | Kopieert allergens, niet de verklaring | + `allergens_declared` | Migratie `20261101230420` (create or replace op de LIVE definitie). |
| Helpartikels | Geen apart allergenen-artikel live (gemeten) | Nieuw | `allergenen-invullen` (migratie `20261101230430`). |
| QR-menu (sf-menu, MENU-ALLERGEEN-1) | Toont amber "allergenen niet ingevuld" bij onbekend | Niets | Het helpartikel verwijst ernaar. |
| Extra's (`product_addon_options`) | Geen verklaring-kolom | Niets | Lege rij blijft leeg; artikel zegt dat. |

## Paper trail (voor `docs/role-audit.md`)

## ALLERGEEN-ADMIN-1 — "geen" vs "niet ingevuld" op de Kaart en de allergenenkaart — 1 november 2026

**Root cause**
- Na ALLERGEEN-VERKLAARD-1 kent `products` drie standen, maar de admin toonde er twee: `KaartProductSheet.tsx` (kop Extra's en allergenen) toonde enkel een aantal; `AllergenChart.tsx` telde elk leeg product als ontbrekend en drukte een lege rij af die op "bevat geen" leek; `useKaart.ts` las `allergens_declared` niet.
- `kaart_duplicate_product` (live definitie = `20261024210000_kaart_3_menu_order.sql`) nam `allergens_declared` niet mee: een kopie van een "geen"-gerecht werd "niet ingevuld".

**Uitgevoerd**
- Nieuw `src/components/admin/storefront/food/allergenState.ts` (`allergenState`, `isMissingColumn`) + test `__tests__/allergenState.test.ts`.
- Nieuw `src/components/admin/horeca/kaart/AllergenStateLabel.tsx`; `KaartProductSheet.tsx` gebruikt het in de kop.
- `useKaart.ts`: `allergens_declared` + `hide_from_storefront`, fallback bij 42703; export `KAART_TYPES`, `onAllergenChart`.
- `KaartManager.tsx`: amber balk met het aantal niet-ingevulde producten (enkel voor wie mag bewerken), link naar `?tab=allergens`.
- `AllergenChart.tsx`: drie standen per rij, lijst "Nog in te vullen" (links naar `/admin/products/:id/edit`), "alles ingevuld"-melding, afdruk met standen, zelfde selectie als de Kaart.
- i18n (nl/en/fr/de/uk): `admin.kaart.allergenState.{none,missing,banner}`, `admin.storefront.food.allergenChart.{state_missing,state_none,missing_todo,todo_title,all_done}`. Key `allergenChart.missing` is nu ongebruikt (laten staan).
- Migraties: `20261101230420_allergeen_admin_1_duplicate.sql`, `20261101230430_allergeen_admin_1_docs.sql`.
- Harnas `horeca-beheer`: mocks met de drie standen, scherm `bestellen&tab=allergens`, controles op de balk en de kop.

**Security-keuzes**
- `kaart_duplicate_product`: signatuur, `security definer`, `search_path ''`, rolcontrole (tenant_admin/staff) en grants ongewijzigd (live grants: authenticated, service_role). Enkel één kolom extra in de insert, waarde uit de bronrij van dezelfde tenant.
- Geen RLS/policies geraakt. De to-do-links gaan naar het productformulier (bestaande route, `trackGateExact`).

**Gedeelde paden**
- `products` gedeeld met de storefronts: geen kolomwijziging hier. `storefront-api` niet aangeraakt.

**Verificatie**
- vitest food + horeca + sidebar + tracks: 11 bestanden, 79 tests groen.
- `node scripts/i18n-parity.mjs` exit 0. eslint op de gewijzigde bestanden exit 0 (baseline `AllergenChart` had 0 fouten).
- `npx tsc --noEmit -p tsconfig.app.json` → **exit 0** (na de merge van night-final zijn ook de 27 eerdere fouten weg).
- Harnas 390/1280: Kaart-balk "Bij 10 product(en) …", allergenenkaart-to-do met dezelfde 10 namen (één bron), rijen "geen allergenen"/"niet ingevuld", paneelkop "allergenen: 2"; geen paginafouten. Bestaande Radix-melding van de gsm-zijbalk (zie Vervolg) uitgefilterd.
- Live-definitie van `kaart_duplicate_product` gelezen met `pg_get_functiondef` (read-only); de kolom `allergens_declared` bestaat live nog niet (migratie 230340 nog niet gedraaid).

**Uitrolvolgorde**
1. `20261101230340_allergeen_verklaard_1.sql` (API) → 2. `20261101230420_allergeen_admin_1_duplicate.sql` (vereist de kolom) → 3. admin-publish → 4. `20261101230430_allergeen_admin_1_docs.sql`.
Natrek na 2: `select pg_get_functiondef('public.kaart_duplicate_product'::regproc) like '%src.allergens_declared%'`.

**Bewust ongemoeid / Vervolg**
- De zin in het helpartikel over de waarschuwing op het QR-menu klopt pas als de sf-menu-build (MENU-ALLERGEEN-1 / ALLERGEEN-VERKLAARD-1) live staat.
- Extra's hebben geen verklaring; een eigen `allergens_declared` op `product_addon_options` zou een aparte batch zijn.
- `src/components/ui/sidebar.tsx`: de gsm-Sheet heeft geen `SheetTitle` → Radix-console-error en een a11y-gat. Bestaand, niet in scope; voorstel: `<SheetTitle className="sr-only">` toevoegen.
- Er is geen bulkactie "geen allergenen" op de Kaart; dat kan via `kaart_bulk_update` (RPC-uitbreiding) als Akke het wil.

**Nieuwe vitest-bestanden voor ci.yml:** `src/components/admin/storefront/food/__tests__/allergenState.test.ts`.

## Changelog-tekst (NL)

**Titel:** Zie meteen welke gerechten nog geen allergenen hebben
**Beschrijving:** Op je Kaart en je allergenenkaart zie je nu het verschil tussen "geen allergenen" en "nog niet ingevuld", met een lijst van wat je nog moet invullen. Een kopie of nieuwe maat van een product neemt ook "bevat geen van de 14 allergenen" mee.

(type: improvement)

## Samenhang

- **Bestond al:** vinkje in `ProductAllergensCard` (één bewerkplek, ongemoeid), allergenenkaart, Kaart-paneel, QR-menu-waarschuwing (sf-menu).
- **Aangepast:** de drie weergaven (paneelkop, Kaart-balk, allergenenkaart) gebruiken één helper en één selectie, dus overal hetzelfde getal.
- **Overgezet/opgeruimd:** niets; ongebruikte key `allergenChart.missing` blijft staan.
- **Taal:** overal dezelfde bewoording als het vinkje ("Bevat geen van de 14 allergenen").
