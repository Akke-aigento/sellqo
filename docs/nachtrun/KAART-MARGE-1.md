# KAART-MARGE-1 — kostprijs en foodcost op de Kaart — 1-2 november 2026

Nachtrun, bouwer ADMIN, branch `night-admin`.

## Inventaris (CLAUDE.md §8.1)

| Plek | Doet nu | Wat verandert | Voorstel / keuze |
|---|---|---|---|
| `products.cost_price` (numeric 10,2) | Bestaat; authenticated heeft SELECT/UPDATE (gemeten); `guard_product_commercial_fields` weert marketing/warehouse | Niets | Geen migratie nodig. |
| Productformulier (`ProductForm.tsx`) | "Inkoopprijs" achter `PermissionGate read product_costs`; marge = (netto − kost)/netto met tarief van het product | Niets | Zelfde rekenbasis hergebruikt (verkoopprijs incl. btw, kostprijs excl. btw). |
| Kaart-lijst (`KaartManager.tsx`) | Naam, prijs, op de kaart, beschikbaar | Optionele kolom foodcost | Knop "Foodcost" (enkel met `product_costs` read), onthouden per toestel (localStorage). Chip per product: % (groen ≤ 35 %, rood > 35 %) of "–" als er geen kostprijs is; tikken opent het paneel. |
| Kaart-paneel (`KaartProductSheet.tsx`) | Geen kostprijs | Veld + foodcost | "Kostprijs (excl. btw)" na Categorie: zien met `product_costs` read, bewerken met write (tenant_admin/platform_admin), bewaart bij blur/Enter of bij sluiten; foodcost-chip ernaast. |
| `useKaart.ts` | Select zonder `cost_price` | Kolom erbij | `cost_price` in select, type en `updateProduct`-patch; `useKaartVat().defaultRate` (zoals de kassa: standaardtarief van de zaak, anders `tax_percentage`, anders 21). |
| Voorraadrapport / productgrid | Tonen `cost_price` | Niets | Eén bron: dezelfde kolom. |
| Helpartikel `horeca-kaart` | Niets over kostprijs | Sectie erbij | Migratie `20261101230500`. |

## Paper trail (voor `docs/role-audit.md`)

## KAART-MARGE-1 — kostprijs en foodcost op de Kaart — 1 november 2026

**Root cause**
- `products.cost_price` bestond (productformulier, voorraadrapport), maar `useKaart.ts` selecteerde hem niet en `KaartProductSheet.tsx`/`KaartManager.tsx` toonden of bewerkten hem niet. Een horecazaak beheert haar producten enkel op de Kaart (WERKPLEK-1), dus kostprijs en marge waren voor haar onvindbaar.

**Uitgevoerd**
- Nieuw `src/components/admin/horeca/kaart/foodCost.ts`: `foodCostPct(prijsIncl, kost, btw) = kost / (prijsIncl / (1 + btw/100)) × 100`, `FOODCOST_WARN_PCT = 35`, label afgerond op hele procenten. Test `__tests__/foodCost.test.ts`.
- `useKaart.ts`: `cost_price` (select, type, `Number()`-mapping, patch-type); `useKaartVat().defaultRate`.
- `KaartProductSheet.tsx`: props `canSeeCost`/`canEditCost`; sectie Kostprijs met foodcost-chip en uitleg; ongeldige invoer → toast + terugzetten; leeg = `null`.
- `KaartManager.tsx`: `useCan('read'|'write','product_costs')`; knop Foodcost; chip per rij; legende in de samenvatting.
- i18n `admin.kaart.cost.*` (9 keys) in nl/en/fr/de/uk.
- Migratie `supabase/migrations/20261101230500_kaart_marge_1_docs.sql`: sectie "Kostprijs en foodcost" achteraan `horeca-kaart` (idempotent via `not like`).

**Security-keuzes**
- Geen schema-, RLS- of grantwijziging. Bewaren via de bestaande rechtstreekse `products`-update van de Kaart; de DB-trigger `guard_product_commercial_fields` blijft marketing/warehouse weigeren. UI volgt `PERMISSION_MATRIX.product_costs` (read: platform_admin, tenant_admin, accountant, warehouse; write: platform_admin, tenant_admin), net als het productformulier (H4b). Staff ziet de knop en het veld niet (harnas: rol staff → 0 knoppen, geen veld).
- Let op (bestaand, niet veranderd): `cost_price` is via RLS leesbaar voor elk winkellid; de verberging is UI-matig, zoals op het productformulier.

**Gedeelde paden**
- `products` is gedeeld met de storefronts, maar er verandert geen kolom; enkel een bestaande kolom wordt nu ook vanuit de Kaart geschreven. Geen edge functions.

**Verificatie**
- vitest (sidebar + horeca + kaart, incl. foodCost) 70/70 groen; i18n-parity exit 0; eslint exit 0 (baseline 0); tsc: 0 fouten in gewijzigde bestanden (27 bestaande elders, zie HORECA-ZIJBALK-1).
- Harnas `horeca-beheer` (`kaart`, `kaart&role=staff`) op 390/1280: kolom aan/uit, kleuren, "–" bij geen kostprijs, paneel met veld en "Foodcost 34 %"; geen console-fouten.
- Niet gedaan: echte schrijfactie op sellqo.app (R14) — kan pas na publish; graag één keer een kostprijs invullen op de Kaart van een testzaak en terugzien op het productformulier.

**Bewust ongemoeid / Vervolg**
- Geen bulk-kostprijs op de Kaart (de bulkbalk heeft prijs/categorie/zichtbaarheid); kan later via `kaart_bulk_update` (zou een RPC-uitbreiding = migratie vragen).
- Foodcost houdt geen rekening met extra's/supplementen of varianten (variant-`cost_price` bestaat apart).
- Drempel 35 % is vast; een instelling per zaak zou "Instelbaar, nooit maatwerk" volgen (Instellingen › Horeca) als Akke dat wil.

## Changelog-tekst (NL)

**Titel:** Kostprijs en foodcost op je Kaart
**Beschrijving:** Vul bij een product op de Kaart de kostprijs in en je ziet meteen de foodcost: de kostprijs tegenover de verkoopprijs zonder btw. Met de knop Foodcost zet je een kolom aan voor al je producten; boven 35 % kleurt het getal rood.

(type: feature)

## Samenhang

- **Bestond al:** `cost_price` op productformulier (Inkoopprijs + marge), productgrid, voorraadrapport.
- **Aangepast:** de Kaart toont en bewerkt dezelfde kolom (één bron); zelfde rekenregel als de marge op het productformulier; zelfde rechten (product_costs).
- **Opgeruimd / overgezet:** niets nodig.
- **Taal:** het productformulier zegt "Inkoopprijs", de Kaart "Kostprijs (excl. btw)" — bewust horeca-taal; het helpartikel zegt dat het dezelfde kostprijs is. Gelijk trekken kan in een i18n-sweep als Akke dat wil.
