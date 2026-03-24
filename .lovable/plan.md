

## Analyse: Tenant-side beheer van storefront klantaccounts

### Huidige situatie

Er bestaan **twee volledig gescheiden klantsystemen**:

| | `customers` (admin) | `storefront_customers` (webshop) |
|---|---|---|
| Aangemaakt door | Tenant via admin panel | Shopper via webshop registratie |
| Zichtbaar in admin | Ja — Klantenpagina | **Nee — nergens** |
| Velden | 70+ velden (marketing, BTW, Shopify, tags...) | 15 velden (basis + wachtwoord) |
| Newsletter opt-in | `email_subscribed`, `email_marketing_status` | **Ontbreekt volledig** |
| BTW/VIES | `vat_number`, `vat_verified`, `vat_verified_at` | **Ontbreekt** |
| Koppeling | Geen link naar `storefront_customers` | Geen link naar `customers` |

**Gevolgen:**
- Tenant heeft **geen idee** dat klanten accounts aanmaken op hun webshop
- Geen overzicht van ingelogde shoppers, hun adressen, wishlist, login-activiteit
- Bij registratie wordt **geen** `customers` record aangemaakt → klant bestaat niet in het CRM
- Geen newsletter opt-in checkbox bij registratie of checkout
- B2B klanten kunnen geen BTW-nummer opgeven/valideren bij registratie

### Plan

#### 1. Auto-sync: storefront_customers → customers
**`supabase/functions/storefront-customer-api/index.ts`**

Bij `register` en `update_profile`: automatisch een `customers` record aanmaken/updaten:
- Match op `tenant_id` + `email`
- Sync velden: `first_name`, `last_name`, `phone`, `email`
- Zet `customer_type` op `'b2c'` (default)
- Sla `storefront_customer_id` referentie op (nieuw veld nodig op `customers`)

#### 2. Database: koppeling + nieuwe velden
**Migratie:**
- `customers` tabel: kolom `storefront_customer_id UUID REFERENCES storefront_customers(id)` toevoegen
- `storefront_customers` tabel: kolommen toevoegen:
  - `newsletter_opted_in BOOLEAN DEFAULT false`
  - `newsletter_opted_in_at TIMESTAMPTZ`
  - `marketing_consent BOOLEAN DEFAULT false`
  - `company_name TEXT`
  - `vat_number TEXT`
  - `vat_verified BOOLEAN DEFAULT false`
  - `vat_verified_at TIMESTAMPTZ`

#### 3. Registratie: newsletter opt-in + bedrijfsgegevens
**`src/pages/storefront/ShopAuth.tsx`**

Registratieformulier uitbreiden:
- Checkbox "Aanmelden voor nieuwsbrief" → stuurt `newsletter_opt_in: true` mee
- Optioneel B2B-blok (toggle): bedrijfsnaam + BTW-nummer
- BTW-nummer validatie via bestaande `validate-vat` edge function

**`supabase/functions/storefront-customer-api/index.ts`**

- `register` action: nieuwe velden opslaan
- Bij `newsletter_opt_in: true`: ook een `newsletter_subscribers` record aanmaken voor de tenant
- Bij `vat_number`: VIES-validatie aanroepen en resultaat opslaan

#### 4. Checkout: newsletter opt-in
**`src/pages/storefront/ShopCheckout.tsx`**

- Checkbox "Aanmelden voor nieuwsbrief" toevoegen onder het e-mailveld
- Bij niet-ingelogde klanten: `newsletter_subscribers` insert bij succesvolle bestelling
- Bij ingelogde klanten: `storefront_customers.newsletter_opted_in` updaten + sync

#### 5. Admin: storefront accounts tab op klantdetail
**`src/pages/admin/CustomerDetail.tsx`**

Nieuwe tab/sectie "Webshop Account":
- Toon of klant een storefront account heeft (gekoppeld via `storefront_customer_id`)
- Info: laatste login, registratiedatum, aantal opgeslagen adressen, wishlist items
- Acties: account deactiveren (`is_active = false`), wachtwoord reset forceren
- Newsletter status: opt-in datum, huidige status

#### 6. Admin: storefront accounts overzicht
**Nieuw: `src/pages/admin/StorefrontAccounts.tsx`** (of tab op Klantenpagina)

Overzichtstabel van alle `storefront_customers` voor de tenant:
- Kolommen: naam, email, registratiedatum, laatste login, newsletter, actief
- Filters: actief/inactief, newsletter opt-in, recent ingelogd
- Bulk acties: deactiveren, newsletter status wijzigen
- Link naar gekoppelde `customers` record

### Bestanden

| Bestand | Actie |
|---|---|
| Migratie | `storefront_customers` velden + `customers.storefront_customer_id` |
| `supabase/functions/storefront-customer-api/index.ts` | Auto-sync naar `customers` + newsletter/BTW bij register |
| `src/pages/storefront/ShopAuth.tsx` | Newsletter checkbox + B2B velden bij registratie |
| `src/pages/storefront/ShopCheckout.tsx` | Newsletter opt-in checkbox |
| `src/pages/admin/CustomerDetail.tsx` | Webshop account sectie |
| `src/pages/admin/StorefrontAccounts.tsx` | Nieuw overzicht (of tab) |
| `src/App.tsx` | Route voor storefront accounts |

