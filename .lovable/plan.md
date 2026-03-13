

## Plan: hideChrome globaal in ShopLayout voor custom frontend

### Wat verandert

De hideChrome-detectie wordt verplaatst van `ShopCheckout.tsx` naar `ShopLayout.tsx` zelf, zodat **alle** pagina's (juridisch, producten, etc.) automatisch zonder header/footer worden getoond wanneer ze vanuit een custom frontend worden bezocht.

### Technische aanpak

**1. `src/components/storefront/ShopLayout.tsx`**

Voeg detectielogica toe aan het begin van de `ShopLayout` component:

- Lees `?from=` query parameter uit `window.location.search`
- Lees `document.referrer`
- `hideChrome = true` als:
  - `from` param aanwezig en bevat niet `sellqo.app`, OF
  - `referrer` aanwezig en bevat niet `sellqo.app` en niet leeg, OF
  - de prop `hideChrome` is `true` (backward compat voor checkout)
- Persist naar `sessionStorage('hide_chrome')` zodat interne navigatie ook chrome-vrij blijft
- Lees `sessionStorage` bij mount als fallback
- Combineer: `finalHideChrome = detectedHideChrome || persistedHideChrome || propHideChrome`
- Gebruik `finalHideChrome` i.p.v. `hideChrome` in alle bestaande checks (announcement bar, header, footer, mobile bottom nav, popups)
- Skip ook de redirect-naar-custom-frontend logica wanneer `finalHideChrome` actief is

**2. `src/pages/storefront/ShopCheckout.tsx`**

- Verwijder de `isCustomFrontend` berekening en de `hideChrome={isCustomFrontend}` prop — ShopLayout handelt dit nu zelf af
- Vervang `<ShopLayout hideChrome={isCustomFrontend}>` door `<ShopLayout>` (3 plekken)
- De `cancelUrl` navigatie voor de "terug" knop blijft behouden (die is onafhankelijk)

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/storefront/ShopLayout.tsx` | Detectie + sessionStorage logica toevoegen |
| `src/pages/storefront/ShopCheckout.tsx` | `hideChrome` prop verwijderen (3x) |

