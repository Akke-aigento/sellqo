

## Openstaande items uit het Klantaccounts-plan

Van de 7 onderdelen zijn er 5 afgerond. Dit blijft over:

### Afgerond
1. StorefrontAuthContext + hook
2. Login & Registratie pagina (ShopAuth)
3. Wachtwoord reset pagina (ShopResetPassword)
4. Account Dashboard (ShopAccount)
5. Routes + Navigatie (App.tsx + ShopLayout header)
6. Custom frontend reset-URL (edge function)

### Nog te doen

**1. Wishlist server-sync** — `src/context/WishlistContext.tsx`
- Momenteel draait de wishlist 100% op localStorage, geen connectie met de backend `storefront_favorites` tabel
- Aanpassing: als klant ingelogd is (via `useStorefrontAuth`), sync met server via `wishlist_get`, `wishlist_add`, `wishlist_remove` uit `useStorefrontCustomerApi`
- Bij inloggen: merge localStorage items naar server, daarna server als bron gebruiken
- Bij uitloggen: terugvallen op localStorage
- Niet-ingelogde bezoekers behouden het huidige localStorage-gedrag

**2. Checkout integratie** — `src/pages/storefront/ShopCheckout.tsx`
- De checkout leest momenteel alleen de Supabase Auth sessie (regel 160), maar kent de storefront-klant niet
- Aanpassing: `useStorefrontAuth` importeren en als klant ingelogd is:
  - Pre-fill email, voornaam, achternaam, telefoon uit klantprofiel
  - Adres-selector tonen: kies uit opgeslagen adressen of vul nieuw in
  - Checkbox "Adres opslaan voor volgende keer" → `add_address` call na bestelling

### Bestanden

| Bestand | Wijziging |
|---|---|
| `src/context/WishlistContext.tsx` | Server-sync voor ingelogde klanten + merge-logica |
| `src/pages/storefront/ShopCheckout.tsx` | Pre-fill klantgegevens + adresselectie |

