

## Seed sandbox tenant "SellQo Sandbox"

Eén migratie die de demo-tenant + seed-data aanmaakt. Geen frontend-wijzigingen nodig — `is_demo` filtering bestaat al in `usePlatformAdmin.ts` (real-tenant statistieken sluiten demo/internal al uit).

### Schema-correcties t.o.v. de prompt

De prompt-SQL gebruikt enkele kolomnamen die niet in het schema bestaan. De migratie corrigeert deze:

| Prompt | Werkelijke kolom |
|---|---|
| `tenants.store_name` | bestaat niet — weglaten |
| `tenants.store_description` | bestaat niet — weglaten |
| `tenants.contact_email` | bestaat niet — `owner_email` is verplicht |
| `tenants.default_vat_rate` | bestaat niet — `tax_percentage` (al in INSERT) |
| `products.active` | werkelijke kolom is `is_active` |
| `products.images` jsonb cast | werkelijke type is `text[]` — array literal gebruiken |
| `shipping_methods.active` | werkelijke kolom is `is_active`; `name` (text) blijft staan |
| `discount_codes.active` | werkelijke kolom is `is_active` |
| `discount_codes.min_order_amount` | werkelijke kolom is `minimum_order_amount` |
| `vat_rates` lookup `WHERE rate=6` | bevestigd: BE 6% bestaat met `tenant_id IS NULL`, id `cdebb42b-…` |

`discount_type = 'free_shipping'` is geldig (CHECK constraint bevestigd).

### Migratie-inhoud

1. **Tenant insert** — idempotent via `ON CONFLICT (slug) DO NOTHING`, met daarna een `SELECT id INTO _sandbox_id` zodat de seed werkt of de tenant al bestond of net is aangemaakt:

```sql
DO $$
DECLARE
  _sandbox_id uuid;
  _be_6_id uuid;
BEGIN
  INSERT INTO public.tenants (
    name, slug, owner_email, country, currency,
    tax_percentage, default_vat_handling,
    is_demo, subscription_status, subscription_plan
  ) VALUES (
    'SellQo Sandbox', 'sandbox', 'sandbox@sellqo.app',
    'BE', 'EUR', 21, 'inclusive',
    true, 'active', 'enterprise'
  )
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO _sandbox_id FROM public.tenants WHERE slug = 'sandbox';
  SELECT id INTO _be_6_id FROM public.vat_rates
    WHERE country_code = 'BE' AND rate = 6 AND tenant_id IS NULL LIMIT 1;
  ...
```

2. **6 producten** — binnen hetzelfde DO-block, met `is_active`, `track_inventory`, `images` als `text[]`:
   - SANDBOX-001 T-Shirt €29,99 — standaard 21% (vat_rate_id NULL → fallback)
   - SANDBOX-002 Sneakers €149,00 — standaard 21%
   - SANDBOX-003 Pizza €12,50 — `vat_rate_id = _be_6_id`
   - SANDBOX-004 Kookboek €19,95 — `vat_rate_id = _be_6_id`
   - SANDBOX-005 Sticker Pack €3,99 — standaard 21%
   - SANDBOX-006 Sold Out Item €49,99, stock 0 — standaard 21%
   
   Slugs zijn uniek per tenant; idempotent via `ON CONFLICT (tenant_id, slug) DO NOTHING` als die unique constraint bestaat, anders simpele insert (eerste run is voldoende).

3. **2 verzendmethoden**:
   - "Standaard verzending" €5,95, gratis boven €75, `is_active = true`
   - "Afhalen" €0,00, `is_active = true`

4. **2 kortingscodes** met `is_active = true`, `minimum_order_amount = 0`:
   - `TEST20` — percentage 20%
   - `GRATISVERZENDING` — free_shipping

5. **Output**: `RAISE NOTICE 'Sandbox tenant id: %', _sandbox_id;` zodat het UUID in de migratie-logs verschijnt. Daarna haalt het assistent het ID nog één keer op via `SELECT` om het in de chat-respons te tonen.

### Niet wijzigen
- `usePlatformAdmin.ts`: filtering op `is_demo` is al aanwezig.
- `useTenants.ts`: lijst toont alle tenants incl. demo (correct — Platform Admin wil ze zien met DEMO-badge).
- Geen Stripe Connect, geen frontend, geen historische orders.

### Acceptance check na migratie
1. `SELECT id, name, slug, is_demo FROM tenants WHERE slug='sandbox';` → 1 rij, `is_demo = true`.
2. `SELECT count(*) FROM products WHERE tenant_id = <id>;` → 6.
3. `SELECT name, vat_rate_id FROM products WHERE sku IN ('SANDBOX-003','SANDBOX-004');` → beide met BE 6% UUID `cdebb42b-7a35-492d-a13a-7f64459178f9`.
4. Platform Admin → "SellQo Sandbox" zichtbaar met paarse DEMO-badge, niet meegeteld in `total/active/trialing` (al afgehandeld door bestaande filter).
5. Tenant-UUID terug in chat-respons.

### Vervolg (out-of-scope)
- Stripe Connect koppelen aan sandbox-tenant.
- Sandbox storefront-frontend.
- Historische test-orders genereren.

