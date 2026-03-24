

## Klantaccounts voor Storefront — Volledige Frontend Implementatie

### Huidige situatie

**Backend (storefront-customer-api): 100% klaar**
- Registratie (email + wachtwoord, PBKDF2)
- Login → JWT token (7 dagen geldig)
- Profiel ophalen/bewerken
- Adressen CRUD (JSONB array)
- Bestellingen ophalen
- Wachtwoord wijzigen + reset via e-mail (Resend)
- Server-side wishlist (storefront_favorites tabel)

**Frontend: 0% — niets gebouwd**
- Geen login/registratie pagina's
- Geen account dashboard
- Geen auth context/hooks
- Wishlist draait puur op localStorage, geen server-sync
- Checkout kent geen "ingelogde klant" flow
- Wachtwoord reset URL (regel 243) verwijst naar `/shop/:slug/reset-password` — pagina bestaat niet

### Plan

#### 1. Storefront Auth Context + Hook
**Nieuw bestand: `src/context/StorefrontAuthContext.tsx`**
- `StorefrontAuthProvider` met state: `customer`, `token`, `isAuthenticated`, `loading`
- Token opslaan in `localStorage` (`storefront_token_{tenantSlug}`)
- Bij mount: token uit storage laden → `get_profile` call om te valideren
- Functies: `login()`, `register()`, `logout()`, `updateProfile()`, `refreshProfile()`
- Alle calls via `supabase.functions.invoke('storefront-customer-api', { body: { action, tenant_id, params } })` met `x-storefront-token` header

**Nieuw bestand: `src/hooks/useStorefrontCustomerApi.ts`**
- Helper functies voor alle storefront-customer-api actions
- Automatisch token meesturen uit context
- Error handling + type-safe responses

#### 2. Login & Registratie pagina
**Nieuw bestand: `src/pages/storefront/ShopAuth.tsx`**
- Tabbed UI: Login | Registreren
- Login: email + wachtwoord + "Wachtwoord vergeten?" link
- Registratie: voornaam, achternaam, email, wachtwoord, bevestig wachtwoord
- Na succes → redirect naar vorige pagina of account dashboard
- Responsive, past bij tenant-thema via ShopLayout

**Nieuw bestand: `src/pages/storefront/ShopResetPassword.tsx`**
- Twee flows:
  1. "Vergeten" → email invoeren → `request_password_reset`
  2. Landing via reset-link (met `?token=&email=`) → nieuw wachtwoord invoeren → `reset_password`

#### 3. Account Dashboard
**Nieuw bestand: `src/pages/storefront/ShopAccount.tsx`**
- Tabbed/sidebar layout met secties:
  - **Profiel**: naam, email (readonly), telefoon — bewerken inline
  - **Adressen**: lijst + toevoegen/bewerken/verwijderen
  - **Bestellingen**: overzicht met status, bedrag, datum → klik voor detail
  - **Wachtwoord wijzigen**: huidig + nieuw + bevestig
  - **Uitloggen**

#### 4. Wishlist server-sync
**Wijzigen: `src/context/WishlistContext.tsx`**
- Als klant ingelogd is (via StorefrontAuthContext): sync met server via `wishlist_get`, `wishlist_add`, `wishlist_remove`
- Als niet ingelogd: blijf localStorage gebruiken (huidige gedrag)
- Bij inloggen: merge localStorage wishlist naar server, daarna server als bron
- Bij uitloggen: clear localStorage wishlist

#### 5. Checkout integratie
**Wijzigen: `src/pages/storefront/ShopCheckout.tsx`**
- Als klant ingelogd: pre-fill email, naam, telefoon uit profiel
- Adres-selector: kies uit opgeslagen adressen of vul nieuw adres in
- Optie "Adres opslaan voor volgende keer" checkbox
- `customer_email` automatisch meegeven aan order

#### 6. Routes + Navigatie
**Wijzigen: `src/App.tsx`**
- Nieuwe routes:
  - `/shop/:tenantSlug/account` → ShopAccount (protected: redirect naar login als niet ingelogd)
  - `/shop/:tenantSlug/login` → ShopAuth
  - `/shop/:tenantSlug/reset-password` → ShopResetPassword
- `StorefrontAuthProvider` wrappen rond alle `/shop/:tenantSlug/*` routes

**Wijzigen: `src/components/storefront/ShopLayout.tsx`**
- Header: user-icoon toevoegen
  - Niet ingelogd → link naar login
  - Ingelogd → dropdown met "Mijn account", "Bestellingen", "Uitloggen"

#### 7. Custom Frontend compatibiliteit
Al deze functies werken automatisch voor custom frontends omdat:
- De `storefront-customer-api` edge function is een zelfstandig endpoint
- Custom frontends roepen dezelfde API aan via hun sellqo-proxy
- Het SDK-prompt document (reeds geschreven) beschrijft de customer actions
- Geen Supabase Auth dependency — eigen JWT-systeem op storefront_customers tabel

De enige aanpassing voor custom frontends: de password-reset URL (regel 243 in storefront-customer-api) moet dynamisch worden op basis van de tenant's custom frontend URL in plaats van hardcoded `sellqo.lovable.app`.

**Wijzigen: `supabase/functions/storefront-customer-api/index.ts`**
- Bij `request_password_reset`: tenant's `custom_frontend_url` ophalen uit `tenant_theme_settings`
- Als `use_custom_frontend = true`: reset URL bouwen met die URL
- Fallback: huidige `sellqo.lovable.app/shop/{slug}/...`

### Bestanden

| Bestand | Actie |
|---|---|
| `src/context/StorefrontAuthContext.tsx` | Nieuw — auth state + API calls |
| `src/hooks/useStorefrontCustomerApi.ts` | Nieuw — typed API helper |
| `src/pages/storefront/ShopAuth.tsx` | Nieuw — login + registratie |
| `src/pages/storefront/ShopResetPassword.tsx` | Nieuw — wachtwoord reset flow |
| `src/pages/storefront/ShopAccount.tsx` | Nieuw — account dashboard |
| `src/context/WishlistContext.tsx` | Wijzigen — server-sync voor ingelogde klanten |
| `src/pages/storefront/ShopCheckout.tsx` | Wijzigen — pre-fill + adresselectie |
| `src/components/storefront/ShopLayout.tsx` | Wijzigen — account link in header |
| `src/App.tsx` | Wijzigen — routes + provider |
| `supabase/functions/storefront-customer-api/index.ts` | Wijzigen — dynamische reset URL |

