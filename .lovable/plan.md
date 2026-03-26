

## Custom Frontend Documentatie Uitbreiden — Ontbrekende Prompts

### Huidige staat
De `CustomFrontendConfigurator.tsx` bevat 5 prompts die de basis dekken (client, proxy, checkout, footer, contact). Maar de API heeft intussen veel meer functionaliteit die **niet gedocumenteerd** is in de prompts.

### Wat ontbreekt (en dus niet functioneel zou zijn op een custom frontend)

| Feature | API Endpoints (bestaan al) | Prompt? |
|---|---|---|
| **Klantaccounts** (registratie, login, e-mailverificatie, profiel, wachtwoord reset) | `storefront-customer-api`: register, login, verify_email, resend_verification, get_profile, update_profile, change_password, request_password_reset, reset_password | Nee |
| **Bestelgeschiedenis & adressen** | get_orders, get_order, get_addresses, add/update/delete_address | Nee |
| **Wishlist/Favorieten** | wishlist_get, wishlist_add, wishlist_remove | Nee |
| **B2B velden** (bedrijfsnaam, BTW-nummer met VIES validatie) | register + update_profile params: company_name, vat_number | Nee |
| **Bundel producten** | get_product retourneert nu bundle_items + bundle_individual_total | Nee |
| **Nieuwsbrief** | POST /newsletter/subscribe | Nee |
| **Reviews** | GET /reviews, GET /products/{slug}/reviews | Nee |
| **Zoeken** | GET /search?q=... | Nee |
| **Navigatie** | GET /navigation (main menu, footer menu) | Nee |
| **Gift cards** | GET /gift-cards, POST /gift-cards/balance | Nee |
| **Verzendmethoden & servicepunten** | GET /shipping, GET /service-points | Nee |
| **Promoties/kortingen** | calculate_promotions, validate_discount_code, cart discount endpoints | Gedeeltelijk (cart discount ja, berekeningen nee) |
| **SEO & Sitemap** | GET /seo, GET /sitemap | Nee |
| **Settings sub-endpoints** | GET /settings/social, /trust, /conversion, /checkout, /languages | Nee |
| **Migratie-compatibele registratie** | Claim-flow voor gemigreerde klanten zonder wachtwoord | Nee |

### Plan: 6 nieuwe prompts toevoegen

**Prompt 6: Klantaccounts — Registratie, Login & Verificatie**
- CustomerAuthContext met JWT token management
- Register met B2B velden (company_name, vat_number, newsletter_opt_in)
- E-mailverificatie flow (verify_email action + /verify-email pagina)
- Login met email_not_verified error handling + resend optie
- Migratie-compatibel: gemigreerde klanten claimen hun account transparant
- Logout + token persistentie in localStorage

**Prompt 7: Klantdashboard — Profiel, Bestellingen, Adressen, Wishlist**
- Account pagina met tabs: Profiel, Bestellingen, Adressen, Favorieten
- Profiel: naam, telefoon, bedrijfsnaam, BTW-nummer (met verified badge), nieuwsbrief toggle
- Bestellingen: lijst + detail view met items, status, totalen
- Adresboek: CRUD met default-adres instelling
- Wishlist: productlijst met "verwijder" en "voeg toe aan winkelwagen"
- Wachtwoord wijzigen + wachtwoord vergeten flow

**Prompt 8: Bundel Producten, Reviews & Zoeken**
- BundleContents component voor product_type === 'bundle'
- Productkaarten met afbeeldingen, individuele prijs (doorgestreept), besparingsindicator
- "Voeg bundel toe" knop die alle items aan cart toevoegt
- Reviews sectie op productpagina + algemene reviews pagina
- Zoekfunctionaliteit met GET /search?q=... + autocomplete

**Prompt 9: Navigatie, Nieuwsbrief & Gift Cards**
- Dynamische navigatie via GET /navigation (main + footer menu)
- Nieuwsbrief component: POST naar /newsletter/subscribe i.p.v. externe redirect
- Gift card pagina: denominaties tonen, saldo checken, toevoegen aan cart

**Prompt 10: SEO, Sitemap & Meertaligheid**
- SEO meta tags per pagina via GET /seo
- Sitemap generatie via GET /sitemap voor SSR/SSG
- Accept-Language header meesturen voor vertalingen
- Settings/languages endpoint voor taalwissel UI

**Prompt 11: Promoties, Verzending & Servicepunten**
- Cart promotie-berekening na elke wijziging (calculate_promotions)
- Besparingsoverzicht in cart drawer
- Kortingscode validatie + toepassen/verwijderen
- Verzendmethoden ophalen + servicepunt selector (PostNL/DHL/DPD)
- Gratis verzending drempel indicator

### Technische aanpak
- Alleen `CustomFrontendConfigurator.tsx` wordt aangepast
- `generatePrompts()` functie uitbreiden met 6 extra prompts
- Elke prompt bevat: types, API calls, component structuur, en foutafhandeling
- Alle prompts gebruiken dezelfde proxy-architectuur uit prompt 2

### Resultaat
Een custom frontend project dat alle 11 prompts volgt heeft **volledige functionaliteit**: shop browsing, accounts met verificatie, B2B, bundels, reviews, zoeken, navigatie, nieuwsbrief, gift cards, SEO, promoties, en verzending — identiek aan de ingebouwde SellQo storefront.

