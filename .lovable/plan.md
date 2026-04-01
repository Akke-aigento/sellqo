

## Prompt 13: Inventory-Aware Ad Pausing

### Overzicht

4 onderdelen: (1) Advertenties tab op product pagina, (2) Edge function voor voorraad-monitoring, (3) Inventory Alerts verbetering op dashboard, (4) Cron job voor automatische checks.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/products/ProductAdsSection.tsx` | Nieuw — Advertenties sectie component |
| `src/pages/admin/ProductForm.tsx` | Tab toevoegen: "Advertenties" (3-kolom tabs) |
| `supabase/functions/ads-inventory-watch/index.ts` | Nieuw — Edge function |
| `src/pages/admin/Ads.tsx` | Inventory Alerts sectie verbeteren |

### 1. Product Advertenties Tab — `ProductAdsSection.tsx`

Nieuw component dat de `ads_product_channel_map` data beheert voor een product.

**Props**: `productId: string`, `tenantId: string`, `productEan?: string`

**UI**:
- Card "Advertenties" met per kanaal (voorlopig alleen Bol.com) een rij:
  - Switch "Geadverteerd op Bol.com" → `is_advertised`
  - Input "Min. voorraad voor ads" → `min_stock_for_ads` (default 1)
  - Input "Channel Ref (EAN)" → `channel_product_ref`, auto-filled met product EAN als beschikbaar
- Bij toggle/change: upsert naar `ads_product_channel_map` (on conflict `tenant_id, product_id, channel`)

**Queries**:
- Fetch bestaande `ads_product_channel_map` record voor dit product + tenant
- Upsert mutation met `useQueryClient` invalidation

### 2. ProductForm.tsx wijziging

- Tabs uitbreiden van 2 naar 3: Product | Marketplaces | **Advertenties**
- `TabsList` grid-cols-2 → grid-cols-3
- Nieuwe `TabsContent value="ads"` met `<ProductAdsSection productId={id} tenantId={currentTenant.id} productEan={product?.barcode || product?.bol_ean} />`
- Alleen tonen als `isEditing` (nieuw product heeft nog geen ID)

### 3. Edge Function: `ads-inventory-watch/index.ts`

**Trigger**: POST (geen body nodig, verwerkt alle tenants)

**Flow**:
1. Query alle `ads_product_channel_map` waar `is_advertised = true`, JOIN met `products` voor `stock`
2. Per record waar `stock < min_stock_for_ads`:
   - Check of er actieve campagnes zijn die dit product targeten (via `ads_bolcom_targeting_products` → `ads_bolcom_adgroups` → `ads_bolcom_campaigns` waar status = 'active')
   - Zo ja: invoke `ads-bolcom-manage` intern met `pause_campaign` voor elke actieve campagne
   - Insert `ads_ai_recommendations` record: channel='bolcom', type='pause_campaign', reason met product + voorraad info, status='auto_applied', auto_apply=true, applied_at=now()
3. Per record waar `stock >= min_stock_for_ads`:
   - Check of er gepauzeerde campagnes zijn met een eerdere auto_applied pause recommendation
   - Zo ja: invoke `ads-bolcom-manage` met `resume_campaign`
   - Insert recommendation met type='resume_campaign', status='auto_applied'

**Auth**: Service role key (cron job, geen user context) — gebruik `SUPABASE_SERVICE_ROLE_KEY`

### 4. Inventory Alerts verbetering — `Ads.tsx`

De bestaande alerts sectie werkt al met `ads_product_channel_map` JOIN `products`. Verbeteringen:
- Voeg kolom toe: "Gepauzeerde ads" — count van auto-paused campaigns voor dit product
- Voeg "Voorraad bijwerken" knop toe → `Link to={/admin/products/${item.product_id}}`
- Toon ook als er geen alerts zijn: een groene badge "Alle producten boven drempel"

### 5. Cron Job (pg_cron)

SQL insert (via insert tool, niet migration) om pg_cron schedule te maken:
- Elke 15 minuten: `*/15 * * * *`
- POST naar `ads-inventory-watch` edge function
- Met anon key auth header

### Technische details

- `ads_product_channel_map` heeft al een unique constraint op `(tenant_id, product_id, channel)` — we gebruiken upsert met onConflict
- De edge function verwerkt alle tenants in één run (service role bypast RLS)
- Campagne matching: `ads_bolcom_targeting_products.product_id` → naar boven joinen tot campagne level
- De `ads-bolcom-manage` function wordt intern aangeroepen via `fetch` naar de eigen Supabase URL (niet via SDK invoke)

