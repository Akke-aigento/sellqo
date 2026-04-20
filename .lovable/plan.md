

## Add VAT snapshot columns to `order_items`

Additieve migratie die drie nullable kolommen toevoegt aan `order_items` om per-regel BTW-data te bevriezen op het moment van order-aanmaak. Geen bestaande data wordt gewijzigd, geen RLS/triggers worden geraakt.

### Migratie SQL

```sql
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS vat_rate_id UUID REFERENCES public.vat_rates(id);

COMMENT ON COLUMN public.order_items.vat_rate IS 'VAT rate applied to this line at order creation (frozen snapshot, e.g. 21.00 for 21%)';
COMMENT ON COLUMN public.order_items.vat_amount IS 'VAT amount included in total_price (inclusive pricing model)';
COMMENT ON COLUMN public.order_items.vat_rate_id IS 'Reference to vat_rates row, frozen at order creation';
```

### Eigenschappen
- Alle drie kolommen zijn **nullable** (geen `NOT NULL`, geen `DEFAULT`).
- `IF NOT EXISTS` maakt de migratie idempotent.
- `vat_rate_id` heeft een FK naar `public.vat_rates(id)` zonder `ON DELETE` clausule (default = `NO ACTION`), zodat een vat_rate die nog door een order_item wordt gerefereerd niet per ongeluk verwijderd kan worden.

### Niet aanraken
- Geen RLS-policies, triggers, indexes of andere tabellen.
- Geen backfill / UPDATE op bestaande rijen — historische rijen blijven `NULL` in de nieuwe kolommen voor boekhoudconsistentie.
- Geen wijzigingen aan order-creatie code in deze stap (is een aparte vervolgstap).

### Verificatie na migratie
1. `information_schema.columns` query bevestigt dat de drie kolommen bestaan op `public.order_items` met types `numeric(5,2)`, `numeric(10,2)`, `uuid` en allemaal `is_nullable = YES`.
2. `SELECT COUNT(*) FROM order_items WHERE vat_rate IS NOT NULL OR vat_amount IS NOT NULL OR vat_rate_id IS NOT NULL` → moet `0` zijn.
3. Een test-insert van een `order_items` rij zonder de nieuwe kolommen (oude code-pad) blijft slagen — backward compatible.

### Vervolg (out-of-scope voor deze taak)
Het daadwerkelijk vullen van deze kolommen bij order-aanmaak (in `storefront-api`, `stripe-connect-webhook`, `sync-bol-orders`, `import-bol-shipments`, POS) is een aparte follow-up.

