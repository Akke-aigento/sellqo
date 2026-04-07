

## Fix: Stripe status toont altijd "Niet gekoppeld" op dashboard

### Oorzaak
`useShopHealth` gebruikt `useStripeConnect(tenantId)` om de Stripe-status te bepalen. Maar `useStripeConnect` roept `checkStatus()` **niet automatisch aan** — het vereist een handmatige aanroep. Daardoor blijft `status` altijd `null`, en is `stripeConnected` altijd `false`.

### Oplossing
De `tenants` tabel heeft al `stripe_charges_enabled` als kolom, en `currentTenant` is al beschikbaar in `useShopHealth`. We hoeven helemaal geen edge function aan te roepen — we lezen gewoon de waarde van de tenant.

### Wijziging

**`src/hooks/useShopHealth.ts`**:
- Verwijder `useStripeConnect` import en aanroep
- Vervang `stripeStatus?.charges_enabled || false` door `currentTenant?.stripe_charges_enabled || false`
- Verwijder `stripeLoading` uit de `isLoading` check

Dit is sneller (geen extra API call), betrouwbaarder (data komt direct uit de DB), en lost het probleem direct op.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/hooks/useShopHealth.ts` | `useStripeConnect` vervangen door directe tenant property |

### Geen database wijzigingen nodig

