

## Newsletter opt-in toevoegen aan storefront_customers

### Database migratie

Nieuwe kolom `newsletter_opt_in` (boolean, default false) toevoegen aan `storefront_customers`.

### Edge function aanpassingen (`supabase/functions/storefront-customer-api/index.ts`)

1. **`get_profile` (regel 118)**: `newsletter_opt_in` toevoegen aan het result object
2. **`update_profile` (regels 124-131)**: 
   - `newsletter_opt_in` destructuren uit params
   - Toevoegen aan updates object als defined
   - Toevoegen aan `.select()` clause

### Bestanden

| Bestand | Actie |
|---|---|
| Migratie | `ALTER TABLE public.storefront_customers ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN NOT NULL DEFAULT false;` |
| `supabase/functions/storefront-customer-api/index.ts` | get_profile + update_profile aanpassen |

