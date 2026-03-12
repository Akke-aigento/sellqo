

## Fix: Verzendkosten uit database ophalen i.p.v. hardcoded €5,95

### Probleem
In `ShopCheckout.tsx` en `ShopCart.tsx` staat `const shipping = subtotal > 0 ? 5.95 : 0` — een hardcoded waarde. De `shipping_methods` tabel wordt niet geraadpleegd.

### Oplossing

**1. Verzendmethoden ophalen via storefront-api**
- De `storefront-api` Edge Function heeft waarschijnlijk al een `/shipping-methods` endpoint, of we voegen het toe
- Het endpoint retourneert actieve verzendmethoden voor de tenant, gesorteerd op `sort_order`

**2. ShopCheckout.tsx en ShopCart.tsx aanpassen**
- Haal de actieve verzendmethoden op via de storefront API
- Laat de klant een verzendmethode kiezen (als er meerdere zijn)
- Gebruik de gekozen methode's `price` als verzendkosten
- Respecteer `free_above`: als subtotaal >= `free_above`, dan gratis verzending
- Standaard de methode met `is_default = true` selecteren

**3. Bestanden**
- `supabase/functions/storefront-api/index.ts` — Controleer of GET `/shipping-methods` route bestaat, zo niet toevoegen
- `src/pages/storefront/ShopCheckout.tsx` — Vervang hardcoded €5,95 door dynamische berekening op basis van gekozen verzendmethode
- `src/pages/storefront/ShopCart.tsx` — Zelfde fix: toon verzendkosten op basis van standaard verzendmethode + `free_above` logica

### Logica
```typescript
// Bereken verzendkosten op basis van gekozen methode
const shippingCost = useMemo(() => {
  if (!selectedMethod) return 0;
  if (selectedMethod.free_above && subtotal >= selectedMethod.free_above) return 0;
  return selectedMethod.price;
}, [selectedMethod, subtotal]);
```

