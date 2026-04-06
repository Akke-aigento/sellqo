

## Fix: Winkelmandje leegmaken na betaling

### Probleem
Na een succesvolle checkout blijft het winkelmandje gevuld. `clearCart()` wordt in `ShopCheckout.tsx` aangeroepen vóór de Stripe redirect en QR-navigatie, maar als de gebruiker via een Stripe redirect terugkomt op `ShopOrderConfirmation`, of als de `clearCart` call niet correct doorkomt (bv. pagina refresht), blijft het mandje vol.

### Oplossing
Voeg een `clearCart()` aanroep toe als vangnet bij het laden van beide bevestigingspagina's:

**`src/pages/storefront/ShopOrderConfirmation.tsx`**
- Importeer `useCart` 
- Roep `clearCart()` aan in een `useEffect` bij mount

**`src/pages/storefront/ShopQRPayment.tsx`**
- Importeer `useCart`
- Roep `clearCart()` aan in een `useEffect` bij mount

Dit is een vangnet — de cart wordt ook al gecleared in `ShopCheckout.tsx`, maar deze dubbele check garandeert dat het mandje altijd leeg is na een succesvolle bestelling.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/storefront/ShopOrderConfirmation.tsx` | `clearCart()` bij mount |
| `src/pages/storefront/ShopQRPayment.tsx` | `clearCart()` bij mount |

### Geen database wijzigingen nodig

