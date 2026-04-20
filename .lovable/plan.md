

## Shared VAT helper voor edge functions

Aanmaken van één gedeeld helper-bestand dat alle order-creatie paden straks zullen importeren voor consistente per-regel BTW-resolutie en -extractie. Deze stap is puur additief: nog geen enkele bestaande functie wordt aangepast.

### Nieuw bestand
**`supabase/functions/_shared/vat.ts`** met drie exports:

1. **`resolveLineVatBatch(supabase, productIds, tenantDefaultRate)`**
   - Eén enkele DB-query (`products` + join `vat_rates`) voor alle product-IDs samen — voorkomt N+1.
   - Filtert `null`/`undefined` IDs eruit.
   - Retourneert `Map<productId, { vat_rate, vat_rate_id }>`.
   - Bij DB-fout: logt warning en retourneert lege map (callers vallen terug op tenant default).
   - Producten zonder `vat_rate_id` of zonder geldige join → tenant default rate, `vat_rate_id = null`.

2. **`resolveLineVatSync(productId, batchMap, tenantDefaultRate)`**
   - Synchrone lookup in de batch map.
   - Veilig voor items zonder `product_id` (bijv. shipping/discount lijnen) → tenant default.

3. **`extractVatFromGross(grossAmount, vatRate)`**
   - Inclusief-BTW extractie: `gross * (rate / (100 + rate))`, afgerond op 2 decimalen.
   - Retourneert `0` bij `vatRate <= 0` (export-only / vrijgesteld), zonder deel-door-nul.

Plus de TypeScript interface **`LineVatResolution { vat_rate: number; vat_rate_id: string | null }`**.

### Eigenschappen
- Géén imports van Deno- of Supabase-specifieke modules nodig: `supabase` wordt als `any`-parameter doorgegeven, dus het bestand compileert zowel onder Deno (edge runtime) als onder lokale type-checks.
- Geen side-effects bij import — alleen pure exports.
- Idempotent: bestand bestaat nog niet, wordt vers aangemaakt.

### Niet aanraken
- Geen wijziging aan bestaande edge functions (`storefront-api`, `stripe-connect-webhook`, `create-bank-transfer-order`, `sync-bol-orders`, `import-bol-shipments`, POS).
- Geen DB-migraties.
- Geen wijzigingen aan `supabase/config.toml`.
- Geen RLS, triggers of types-bestand.

### Verificatie
1. Bestand bestaat op exact pad `supabase/functions/_shared/vat.ts`.
2. Drie exports aanwezig: `resolveLineVatBatch`, `resolveLineVatSync`, `extractVatFromGross`, plus de `LineVatResolution` interface.
3. Geen TypeScript-fouten (helper gebruikt alleen `any`/native types — geen externe imports vereist).
4. Geen enkele andere file gewijzigd (nog geen import hooks).

### Vervolg (out-of-scope hier)
In aparte vervolgprompts wordt deze helper bedraad in elk order-creatie pad om:
- per `order_items` rij `vat_rate`, `vat_amount` en `vat_rate_id` te vullen,
- order-niveau `tax_amount` consistent uit gross te extraheren.

