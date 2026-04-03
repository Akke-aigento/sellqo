

## Fix: Laatste checkout bugs (ronde 3)

### Analyse

Na grondig onderzoek van alle code:

**De `.rpc().catch()` bug is al gefixt in de storefront-api.** Alle `supabase.rpc()` en `supabase.from()` calls gebruiken het correcte `{ data, error } = await` patroon. De enige `.catch()` in storefront-api (regel 1710) is op een native `fetch()` call — dat is geldig.

De error die de frontends zien (`supabase.rpc(...).catch is not a function`) kwam van een **vorige deployment**. De huidige code is correct en ik heb zojuist opnieuw gedeployed.

**WEL nog te fixen:**

### Bug 1: `stripe-connect-webhook` heeft nog `.catch()` op rpc (KRITIEK)

Regels 410 en 412 in `stripe-connect-webhook/index.ts`:
```typescript
await supabaseClient.rpc("decrement_variant_stock", ...).catch(() => {});
await supabaseClient.rpc("decrement_stock", ...).catch(() => {});
```
Dit crasht wanneer Stripe een `checkout.session.completed` webhook stuurt na betaling. De order wordt dan niet aangemaakt of stock niet gedecrementeerd.

### Bug 2: `qr_transfer` betaalmethode wordt nooit aangeboden

`checkoutGetPaymentMethods` (regel 1910-1923) biedt alleen `stripe` en `bank_transfer` aan. De `qr_transfer` optie ontbreekt. De tenant heeft een IBAN, dus QR zou beschikbaar moeten zijn.

### Technische aanpak

**`supabase/functions/stripe-connect-webhook/index.ts`** (regels 408-413):
- Vervang `.catch(() => {})` door `{ error } = await` + `console.warn` patroon (identiek aan hoe storefront-api het doet).

**`supabase/functions/storefront-api/index.ts`** — `checkoutGetPaymentMethods` (regels 1916-1923):
- Voeg `qr_transfer` toe als de tenant een IBAN heeft (zelfde conditie als bank_transfer, met `desktop_only: true`).

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/stripe-connect-webhook/index.ts` | Fix `.catch()` op rpc calls (regels 410, 412) |
| `supabase/functions/storefront-api/index.ts` | Voeg `qr_transfer` toe aan payment methods |

### Geen database wijzigingen nodig

