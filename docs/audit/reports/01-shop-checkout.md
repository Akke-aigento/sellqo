# Audit: /shop/:tenantSlug/checkout — Afrekenen
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopCheckout.tsx (872 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

> **Gedeeld pad.** Deze pagina praat via `supabase.functions.invoke('storefront-api')` (`:38-50`) met de core. Dat is een van de drie contracten waar de vijf custom frontends op leunen (CLAUDE.md §1). Geen enkele fixrichting hieronder wijzigt het contract; waar een aanroep geraakt wordt, staat dat er expliciet bij.

## Verdict-samenvatting
🔴 2 · 🟡 2 · 🟢 4

## Bevindingen

### 🔴 A1 — Een onbekend `payment_type` leegt de winkelwagen en doet verder niets
- **Wat:** bij het afronden wordt de winkelwagen gewist vóórdat bekend is of er ook echt genavigeerd kan worden. Valt het antwoord buiten de twee bekende gevallen, dan blijft de klant achter op de afrekenpagina met een lege wagen en geen enkele melding.
- **Waar:** `src/pages/storefront/ShopCheckout.tsx:403-420`
  ```ts
  clearCart();
  if (result.payment_type === 'redirect' && result.checkout_url) { window.location.href = ...; }
  else if (result.payment_type === 'qr') { navigate(...); }
  // geen else
  ```
- **Root cause:** `clearCart()` staat vóór de vertakking in plaats van erbinnen, en er is geen `else`-tak. Ook het geval `payment_type === 'redirect'` mét een ontbrekende `checkout_url` valt hier stil doorheen — de eerste voorwaarde eist beide.
- **Gevolg:** de order bestaat mogelijk al server-side, maar de klant ziet geen bevestiging, geen QR, geen foutmelding, en z'n wagen is leeg. Opnieuw beginnen betekent alles opnieuw invoeren, met kans op een dubbele bestelling.
- **Fixrichting:** `clearCart()` per geslaagde tak verplaatsen en een `else` toevoegen die een fout toont en de wagen intact laat. **Platform:** CC. **Frozen-path-risico:** nee — enkel clientlogica, de aanroep verandert niet.

### 🔴 E1 — Het e-mailadres wordt nooit op vorm gecontroleerd
- **Wat:** `validateForm` eist alleen dat het veld niet leeg is. `abc` komt er zonder morren doorheen.
- **Waar:** `src/pages/storefront/ShopCheckout.tsx:242-245` — `if (!customerData.email || !customerData.firstName || !customerData.lastName)`.
- **Root cause:** het invoerveld heeft wel `type="email"` (`:480`), maar de browservalidatie draait alleen bij een echte formulier-submit. Hier hangt de vervolgstap aan een `onClick` op een knop (`:732`), dus `checkValidity()` wordt nooit aangeroepen. De enige controle die overblijft is de leegtecheck.
- **Gevolg:** de order wordt aangemaakt met een onbruikbaar adres. De bevestigingsmail bouncet, de klant hoort niets, en de tenant heeft een bestelling zonder contactmogelijkheid. Bij vooruitbetaling per overschrijving is dat direct pijnlijk.
- **Bijkomend:** `houseNumber` en `country` worden niet gevalideerd, terwijl `street`, `postalCode` en `city` dat wel zijn (`:255`). `country` stuurt btw en verzendkosten aan; hij wordt weliswaar voorgevuld uit `defaultShippingCountry`, maar de garantie ontbreekt.
- **Fixrichting:** een vormcontrole op e-mail toevoegen in `validateForm`, en `country` (en waar van toepassing `houseNumber`) in dezelfde check meenemen. **Platform:** CC. **Frozen-path-risico:** nee.

### 🟡 S-2 (gedeeld) — verkeerde taal naar `storefront-api`
Zie `01-storefront-gedeeld.md`. Raakt `:270` en `:320` van dit bestand en bepaalt de taal van de orderbevestiging.

### 🟡 D1 — Gedragsvingerafdruk van de checkout-acties
De pagina roept zes acties aan: `cart_create`, `cart_add`(sync), `checkout_start`, `checkout_customer`, `checkout_select_payment_method`, `checkout_complete`. Statisch is vast te stellen dát ze worden aangeroepen en met welke velden; of de live functie exact dezelfde parameters verwacht, is dat niet (runbook §9: Lovable synct edge functions niet automatisch van main).
```sql
-- bestaan de acties in de gedeployde versie? neveneffectvrij: onbekende actie moet nette fout geven
SELECT net.http_post(
  url    := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/storefront-api',
  headers:= '{"Content-Type":"application/json","Authorization":"Bearer <anon>"}'::jsonb,
  body   := '{"action":"__audit_probe__","tenant_id":"<test-tenant>","params":{}}'::jsonb
) AS request_id;
-- daarna: SELECT status_code, content FROM net._http_response WHERE id = <request_id>;
```
**Duiding:** een nette `success:false` met onbekende-actie-melding bevestigt dat de functie leeft en de dispatcher werkt. Daarna per actie de parameternamen vergelijken met `:270-330`.

## 🟢 Geverifieerd correct
1. **Dubbel afrekenen is afgevangen.** `:304-305` zet `submittingRef` vóór het async-werk en `:353-356` reset hem in een `finally` — ook bij een fout. Geen kans op twee orders door dubbelklikken.
2. **Geannuleerde Stripe-terugkeer wordt netjes opgevangen.** `:128-134` toont een melding en poetst `?cancelled=true` uit de URL met `history.replaceState`, zodat een refresh de melding niet herhaalt.
3. **Verlopen sessie leidt terug in plaats van te falen.** `:430-433` vangt een ontbrekende `serverCartId` af, meldt het en zet de klant terug op de gegevensstap.
4. **Betaalmethoden komen uit tenantconfiguratie**, niet uit een vaste lijst (`:139-142`), met `card` als terugval — en bij precies één methode wordt de keuzestap overgeslagen (`:343-347`).
