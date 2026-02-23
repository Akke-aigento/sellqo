
# Dynamische standaard landkeuze op checkout

## Probleem
Het land in de checkout staat hardcoded op `'BE'`. Het zou automatisch het land van de tenant (winkel) moeten gebruiken.

## Oplossing
In `src/pages/storefront/ShopCheckout.tsx`:

1. **Verwijder hardcoded `'BE'`** -- Zet de initiële `country` op een lege string `''`
2. **Voeg een `useEffect` toe** die, zodra de tenant data geladen is, het land instelt op `tenant.country` (bijv. `'NL'`, `'BE'`, `'DE'`), maar alleen als de gebruiker het nog niet zelf heeft gewijzigd

## Technisch detail

Wijziging in `src/pages/storefront/ShopCheckout.tsx`:

- Regel 55: `country: 'BE'` wordt `country: ''`
- Nieuw `useEffect` na bestaande effects:
  ```typescript
  useEffect(() => {
    if (tenant?.country && !customerData.country) {
      setCustomerData(prev => ({ ...prev, country: tenant.country || 'BE' }));
    }
  }, [tenant]);
  ```

Dit zorgt ervoor dat:
- Een Belgische winkel standaard "Belgie" toont
- Een Nederlandse winkel standaard "Nederland" toont
- Als de klant het land al heeft gewijzigd, wordt het niet overschreven
