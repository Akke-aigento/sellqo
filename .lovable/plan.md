
# Shopify OAuth Koppeling - Geïmplementeerd ✅

## Status: Klaar voor testen

De Shopify OAuth flow is nu geïmplementeerd. Gebruikers kunnen nu met één klik hun Shopify store verbinden.

## Wat is geïmplementeerd:

### Edge Functions
- ✅ `shopify-oauth-init` - Start de OAuth flow, valideert store URL, redirect naar Shopify
- ✅ `shopify-oauth-callback` - Verwerkt de callback, wisselt code voor token, slaat connectie op

### UI Componenten
- ✅ `ShopifyOAuthConnect.tsx` - Nieuwe OAuth component met store URL input
- ✅ `ConnectMarketplaceDialog.tsx` - Gebruikt nu OAuth flow voor Shopify

### Secrets (toegevoegd)
- ✅ `SHOPIFY_CLIENT_ID` 
- ✅ `SHOPIFY_CLIENT_SECRET`

### API Scopes
De app vraagt om de volgende permissions:
- `read_products`, `write_products`
- `read_orders`, `write_orders`
- `read_inventory`, `write_inventory`
- `read_customers`
- `read_fulfillments`, `write_fulfillments`
- `read_locations`

## Shopify Partners Setup (Jouw actie)

Om de OAuth flow te laten werken, moet je de Shopify App configureren:

### 1. App Redirect URL instellen
In je Shopify Partners dashboard, configureer:
- **App URL**: `https://sellqo.lovable.app`
- **Allowed redirection URL(s)**: 
  ```
  https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/shopify-oauth-callback
  ```

### 2. Test de flow
1. Ga naar SellQo Connect → E-commerce → Shopify
2. Klik "Verbind"
3. Voer je store naam in (bijv. `mijn-winkel`)
4. Je wordt doorgestuurd naar Shopify om in te loggen
5. Na autorisatie word je teruggestuurd naar SellQo

## Verschil met voorheen
| Voorheen (Custom App) | Nu (OAuth) |
|----------------------|------------|
| 5+ stappen in Shopify Admin | 1 stap: inloggen |
| Handmatig scopes configureren | Automatisch |
| Access token kopiëren | Niet nodig |
| Developer kennis vereist | Geen kennis nodig |

## Volgende stappen (optioneel)
- [ ] App indienen bij Shopify voor review (voor publiek gebruik)
- [ ] Webhook registratie voor realtime order updates
- [ ] Token refresh implementatie (indien nodig)
