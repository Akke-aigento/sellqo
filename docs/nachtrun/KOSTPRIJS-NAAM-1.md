# KOSTPRIJS-NAAM-1 — één naam voor products.cost_price: "Kostprijs (excl. btw)" — 2 november 2026

Batch VERVOLG-1 (onderdeel B), branch `vervolg-1`. Niet gepusht, niet gedeployed, geen DB-writes.

## Root cause
Hetzelfde veld `products.cost_price` heette in het productformulier "Inkoopprijs"
(`admin.productForm.inkoopprijs`, `src/pages/admin/ProductForm.tsx:1186`) en op de Kaart "Kostprijs (excl. btw)"
(`admin.kaart.cost.label`). In het Duits/Frans/Oekraïens week het ook af ("Einkaufspreis"/"Prix d'achat"/"Закупівельна
ціна" tegenover de Kaart). Twee helpartikels noemden het "inkoopprijs".

## Inventaris (grep + live SQL)
| Plek | Deed | Wat verandert |
|---|---|---|
| Productformulier, label (`admin.productForm.inkoopprijs`) | "Inkoopprijs" | = Kaart-label in elke taal |
| Productformulier, hulptekst | hardcoded NL "Voor winstberekening (niet zichtbaar)" | via bestaande key `product_form.field_cost_price_desc` (5 talen) |
| `product_form.field_cost_price` (dode key, nergens gebruikt) | "Inkoopprijs" | zelfde waarde als het label, zodat er geen tweede naam rondslingert |
| Kaart (`admin.kaart.cost.label`) | "Kostprijs (excl. btw)" | bron, ongewijzigd |
| Voorraadrapport + variantentab (`admin.stockReport.colCostPrice`) | "Kostprijs" (kolomkop) | ongewijzigd (kop zonder "(excl. btw)" past in een tabel) |
| Bulkbewerking (`kostprijs_aanpassen`) | "Kostprijs aanpassen" | ongewijzigd |
| Export (`src/lib/exportUtils.ts:348`), raster (`gridTypes.ts:64`) | "Kostprijs" | ongewijzigd |
| Helpartikel `voorraadbeheer` | "Registreer per product de inkoopprijs" | "de kostprijs (excl. btw)" |
| Helpartikel `teamleden-rollen` | "vergelijkingsprijs, inkoopprijs, btw-tarief" | "kostprijs" |
| Inkoop/leveranciers (INKOOP-*), AI-instellingen ("Inkoopprijzen of marges" als voorbeeldtekst), Printful-commentaar | gaat over inkoop | bewust ongemoeid |

## Uitgevoerd
- `src/i18n/locales/{nl,en,fr,de,uk}.json`: `admin.productForm.inkoopprijs` en `product_form.field_cost_price` =
  waarde van `admin.kaart.cost.label` (nl "Kostprijs (excl. btw)", en "Cost price (excl. VAT)", fr "Prix de revient
  (HTVA)", de "Einkaufspreis (ohne MwSt.)", uk "Собівартість (без ПДВ)"). Key-namen blijven (geen hernoeming nodig).
- `src/pages/admin/ProductForm.tsx`: hulptekst via `t('product_form.field_cost_price_desc')`; twee commentaren.
- `supabase/migrations/20261102080010_kostprijs_naam_1_docs.sql`: snapshot `snapshots.sellqo_20261102_doc_articles_kostprijs1`
  + twee `replace`'s met guard op de oude zin.

## Security-keuzes
n.v.t.: enkel labels en helptekst; `PermissionGate product_costs` rond het veld blijft.

## Gedeelde-paden-waarschuwing
Geen gedeelde paden. `doc_articles` is een gedeelde tabel maar enkel twee eigen rijen, snapshot vooraf.

## Verificatie
- Live read-only: enkel deze twee artikels bevatten "inkoopprijs", elke zin precies 1×.
- Migratie 2× op lokale PG16: exit 0, tweede run raakt niets.
- tsc exit 0, i18n-parity exit 0, eslint ProductForm.tsx 17 = 17 fouten (baseline, geen nieuwe).
- Geen harnas: enkel een labeltekst in een bestaand formulierveld, geen opmaakwijziging.

## Bewust ongemoeid / Vervolg
- Duitse kolomkop voorraadrapport "Einstandspreis" ≠ Kaart "Einkaufspreis": beide correct Duits, niet gelijkgetrokken.
- `adminManagedHint` in ProductForm is nog hardcoded NL (geldt voor meerdere velden): eigen i18n-batch.
- Het productraster (`gridTypes.ts`) heeft hardcoded NL kolomkoppen.

## Changelog (NL)
**Kostprijs heet overal hetzelfde**
In je productformulier heet het veld nu "Kostprijs (excl. btw)", net als op de Kaart, in het voorraadrapport en in de hulpartikels. Het is hetzelfde getal als voorheen; enkel de naam is gelijkgetrokken.
