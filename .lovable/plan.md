
Doel
- De veldmapping in `/admin/import` moet exact overeenkomen met de Shopify CSV’s die je bezorgd hebt:
  - Customers: 45 core velden + Klaviyo metafields (optioneel, maar niet “verlies”).
  - Products: 64 velden incl. metafields.
  - Orders: 78 velden (momenteel 0 auto-mapping, zoals je screenshot toont).

Wat er nu misloopt (op basis van de code)
1) Er bestaat geen Shopify orders default mapping
- `src/lib/importMappings.ts` heeft `SHOPIFY_CUSTOMER_MAPPING`, `SHOPIFY_PRODUCT_MAPPING`, maar geen `SHOPIFY_ORDER_MAPPING`.
- `getDefaultMapping()` retourneert voor Shopify geen mapping voor `orders`, dus alles blijft “skip”.

2) De mapping-UI toont geen order target fields
- `src/components/admin/import/FieldMappingStep.tsx` ondersteunt enkel `customers` en `products` in `getTargetFields()`.
- Voor `orders` krijgt de dropdown dus geen “SellQo veld” keuzes en blijft alles “skip”.

3) Shopify customers/products mapping is onvolledig t.o.v. jouw export
- In `SHOPIFY_CUSTOMER_MAPPING` ontbreken o.a. `Accepts Email Marketing`, `Accepts SMS Marketing`, `Default Address Address2`, `Total Spent`, `Total Orders`, enz.
- In `SHOPIFY_PRODUCT_MAPPING` wordt `Vendor` expliciet geskipt en `Product Category` gaat naar `category_id` (met een transformer die niet bestaat), terwijl je CSV “Product Category” bevat en je vooral data wilt bewaren.

4) Metafields (zoals Klaviyo) lijken “niet gemapt” omdat er geen plek is om ze te bewaren
- In je screenshot zie je vooral metafields die “skip” staan.
- Zelfs als we ze willen mappen, is er in de huidige wizard geen standaard “metadata”-veld in de database voor customers/products om die te bewaren.

Oplossingsrichting (dieper dan “een paar keys toevoegen”)
We gaan het op 2 niveaus oplossen:
A) Volledige Shopify mapping definitions toevoegen (Customers + Products + Orders) zodat core velden automatisch gemapt worden.
B) Metafields en “extra” velden niet weggooien: toevoegen van een JSONB “raw_import_data” opslagveld voor customers/products, en orders extra velden naar bestaande `raw_marketplace_data` sturen. Zo blijven alle velden bewaard zonder dat we 100 extra kolommen moeten aanmaken.

Concreet implementatieplan

Stap 1 — Database uitbreiden voor volledige data-retentie (kleine, veilige migratie)
Waarom: Klaviyo metafields en andere extra velden moeten ergens naartoe.
- Voeg toe:
  - `customers.raw_import_data jsonb default '{}'`
  - `products.raw_import_data jsonb default '{}'`
- Voeg ook toe (belangrijk voor je “Accepts SMS Marketing” core veld):
  - `customers.sms_subscribed boolean default false`
  - (optioneel) `customers.sms_subscribed_at timestamptz` (kan later, niet strikt nodig voor mapping)

Resultaat: alle metafields kunnen automatisch “gemapt” worden naar `raw_import_data` i.p.v. “skip”.

Stap 2 — Target field lijsten uitbreiden zodat dropdowns de juiste “SellQo velden” tonen
Bestand: `src/types/import.ts`
- Breid `CUSTOMER_TARGET_FIELDS` uit met bestaande DB velden die nu ontbreken, o.a.:
  - `province`, `province_code`, `tax_exempt`, `verified_email`
  - `email_subscribed`, `sms_subscribed`
  - `email_marketing_status`, `email_marketing_level`, `sms_marketing_status`, `sms_marketing_level`
  - `total_spent`, `total_orders`
  - `shopify_customer_id`, `original_created_at`, `import_source`
  - `raw_import_data`
- Breid `PRODUCT_TARGET_FIELDS` uit met:
  - `vendor`, `google_product_category`, `shopify_handle`, `shopify_product_id`, `image_alt_texts`, `published_scope`, `original_created_at`, `import_source`
  - `raw_import_data`
- Voeg nieuw toe:
  - `export const ORDER_TARGET_FIELDS = [...]`
    - o.a. `order_number`, `payment_status`, `status`, `paid_at`, `shipped_at`, `cancelled_at`, `currency`, `subtotal`, `shipping_cost`, `tax_amount`, `total`, `discount_code`, `discount_amount`
    - `billing_address`, `shipping_address`
    - `marketplace_source`, `marketplace_order_id`, `external_reference`, `payment_method`, `order_tags`, `risk_level`
    - `raw_marketplace_data` (bestaat al in orders tabel)
    - `original_created_at`, `import_source`

Stap 3 — Shopify mappings volledig en exact volgens jouw CSV headers
Bestand: `src/lib/importMappings.ts`

3.1 Customers mapping (core 45 velden)
- Voeg alle core kolommen toe die jij oplijst:
  - `Customer ID` -> `shopify_customer_id` (en/of `external_id` als fallback)
  - `Accepts Email Marketing` -> `email_subscribed` (transform: yes/no)
  - `Accepts SMS Marketing` -> `sms_subscribed` (transform: yes/no)
  - `Default Address Address2` -> (niet naar aparte kolom; we bewaren in `raw_import_data.default_address.address2` + eventueel later concatenation)
  - `Total Spent` -> `total_spent` (decimal)
  - `Total Orders` -> `total_orders` (number)
  - `Default Address Province Code` -> `province_code` (niet `billing_state`, want dat bestaat niet)
  - `Default Address Phone` -> `phone` als fallback of naar raw_import_data (maar core wil je meestal in phone)

3.2 Customers metafields (Klaviyo e.d.)
- Alle metafields uit jouw lijst mappen naar `raw_import_data` met keys (bv. `raw_import_data.klaviyo.last_active`, `raw_import_data.klaviyo.locale`, …).
- Belangrijk: dit gebeurt zó dat de UI niet “skip” toont maar “raw_import_data”.

3.3 Products mapping (core + metafields)
- Fixes t.o.v. huidige code:
  - `Vendor` mag niet “skip” zijn -> map naar `vendor`
  - `Product Category` map naar `google_product_category` (of naar `raw_import_data.product_category` als je dat liever apart houdt; default: `google_product_category` omdat de kolom bestaat)
  - `Type` map naar `original_category_value` (kolom bestaat in products)
  - `Handle` -> `slug` (blijft nodig want slug is verplicht), en daarnaast ook naar `shopify_handle` via een kleine post-processing regel (zie Stap 4)
  - `Published` -> `is_active` (boolean transformer)
  - `Image Alt Text` -> `image_alt_texts` (array transformer; per rij verzamelen)
- Alle product metafields (battery, color, material, …) -> `raw_import_data` (zodat niets verloren gaat).

3.4 Orders mapping (78 velden)
- Voeg `SHOPIFY_ORDER_MAPPING` toe die minstens alle “core” ordersvelden premapt:
  - `Name` -> `order_number` (required)
  - `Email` -> `customer_email`
  - `Financial Status` -> `payment_status` (shopifyPaymentStatus transformer)
  - `Fulfillment Status` -> `status` (shopifyFulfillmentStatus transformer)
  - `Paid at` -> `paid_at` (datetime)
  - `Fulfilled at` -> `shipped_at` (datetime)
  - `Currency` -> `currency`
  - `Subtotal`, `Shipping`, `Taxes`, `Total`, `Discount Amount` -> decimals
  - `Discount Code` -> `discount_code`
  - `Cancelled at` -> `cancelled_at`
  - `Tags` -> `order_tags` (tagArray)
  - `Risk Level` -> `risk_level`
  - `Source` -> `marketplace_source` (of `raw_marketplace_data.source` als je marketplace_source strikt wil beperken; default: marketplace_source)
  - `Payment Method` -> `payment_method`
  - `Payment Reference` / `Payment References` -> `external_reference` en rest in `raw_marketplace_data`
- Adressen:
  - `Billing Name/Street/Address1/Address2/...` -> `billing_address` (als JSON object)
  - `Shipping Name/Street/Address1/Address2/...` -> `shipping_address` (als JSON object)
- Line item velden:
  - Voor de wizard-mapping + preview: mappen naar `raw_marketplace_data.lineitem.*` zodat ze niet “skip” blijven.
  - (Later, bij echte import-executie) kunnen we deze gebruiken om `order_items` correct te maken door te groeperen op `Name`/`Id`.

Stap 4 — Wizard mapping engine upgraden: JSON merge + “per-field naar JSON” zonder dot-targets in dropdown
Probleem: we willen meerdere CSV kolommen in één JSON veld (bv. billing_address), én metafields in raw_import_data, zonder dat we 200 dropdown opties moeten toevoegen.
Bestand: `src/lib/importMappings.ts`
- We breiden `transformRecord()` uit zodat het:
  1) Transformers kan gebruiken met argument (bv. `jsonString:street`, `jsonDecimal:tax1_value`).
  2) Indien `result[target]` al een object is, de nieuwe objectwaarde merged i.p.v. overschrijven.
- Nieuwe transformers (naast bestaande):
  - `yesNo` (Shopify uses yes/no)
  - `datetime` (naar ISO string)
  - `shopifyPaymentStatus`
  - `shopifyFulfillmentStatus`
  - `jsonString:<key>` -> `{ [key]: stringValue }`
  - `jsonNumber:<key>` -> `{ [key]: numberValue }`
  - `jsonDecimal:<key>` -> `{ [key]: decimalValue }`
  - `jsonBoolean:<key>` -> `{ [key]: booleanValue }`

Voorbeeld:
- `Billing City` target = `billing_address`, transform = `jsonString:city`
- `Billing Zip` target = `billing_address`, transform = `jsonString:postal_code`
=> transformRecord merge’t deze tot één `billing_address` object.

Stap 5 — UI fixes: orders tab + target fields + betere “auto mapping”
Bestand: `src/components/admin/import/FieldMappingStep.tsx`
- Voeg `orders` case toe in `getTargetFields()` (met `ORDER_TARGET_FIELDS`).
- Gebruik geen `defaultMapping[header]` meer, maar een helper `findMatchingMapping(header, mapping)` die minimaal:
  - trimt, case-insensitive match doet
  - optioneel: baseHeader match (`Header (metafields...)` -> exacte key als aanwezig)
Dit voorkomt dat kleine variaties alsnog “skip” worden.

Stap 6 — Preview verbeteringen zodat je meteen ziet dat orders “leven”
Bestand: `src/components/admin/import/PreviewValidation.tsx`
- Voeg `orders` toe in `getDisplayColumns()` (bv. `order_number`, `customer_email`, `total`, `payment_status`, `status`)
- Breid `validateRecord()` in `importMappings.ts` uit met minimale order-validatie:
  - order_number verplicht
  - customer_email verplicht
  - total verplicht (of subtotal+total afhankelijk)
(Preview is nu ook realistischer.)

Testplan (wat jij meteen kan checken met jouw CSV’s)
1) Ga naar `/admin/import`
2) Selecteer Shopify + vink Customers/Products/Orders aan
3) Upload jouw 3 CSV’s
4) Stap “Veld Mapping”:
   - Customers: alle core velden moeten automatisch gemapt zijn
   - Metafields: moeten standaard naar `raw_import_data` gemapt zijn (niet “skip”)
   - Products: Vendor, Product Category, SEO velden, Variant velden moeten grotendeels gemapt zijn; metafields naar `raw_import_data`
   - Orders: niet langer “alles skip”; je ziet meteen mappings voor Name/Email/Financial Status/Total/Addresses/etc.
5) Stap “Preview”:
   - Orders preview toont order_number + totals + status/payout mapping

Belangrijke scope-note
- Deze wizard (`/admin/import`) simuleert momenteel de echte import (ImportWizard heeft nog een TODO voor “actual import”). Dit plan lost het mapping-probleem en data-retentie in de wizard op.
- Als je wil dat “Start import” ook effectief orders + order_items gaat aanmaken (incl. groeperen van line-items per order), dan is dat een volgende stap: een backend import-runner die de wizard output uitvoert.

Bestanden die we zullen aanpassen
- Database migration: add `raw_import_data` + `sms_subscribed` (customers) / `raw_import_data` (products)
- `src/types/import.ts` (target fields + ORDER_TARGET_FIELDS)
- `src/lib/importMappings.ts` (SHOPIFY_ORDER_MAPPING + uitbreidingen customer/product + transformers + merge logic + fuzzy matching)
- `src/components/admin/import/FieldMappingStep.tsx` (orders support + fuzzy default mapping)
- `src/components/admin/import/PreviewValidation.tsx` (orders preview columns)

Risico’s / randgevallen
- Shopify “Orders export” is line-item per rij: mapping is ok, maar echte import moet groeperen (later stap).
- Sommige velden bestaan dubbel (bv. “Payment Reference” en “Payment References”): we mappen één naar `external_reference`, de rest bewaren we in `raw_marketplace_data`.
- Product Handle moet ook slug vullen: we vullen slug, en zetten daarnaast shopify_handle via afgeleide logica (of bewaren in raw_import_data als extra zekerheid).
