

## Fix: Lange wachttijd na Stripe-betaling (~1 minuut)

### Probleem
Na een Stripe-betaling wordt de klant doorgestuurd naar de success-pagina. De order wordt pas aangemaakt wanneer de **Stripe webhook** (`checkout.session.completed`) binnenkomt — dit kan 5-60 seconden duren. De success-pagina toont "Verifying your payment..." totdat de webhook heeft afgevuurd en de volledige orderverwerking klaar is.

### Oorzaak
Er is geen endpoint dat de Stripe-betalingsstatus actief controleert. Het systeem is volledig afhankelijk van de webhook voor het aanmaken van de order.

### Oplossing: `checkout_verify_payment` actie toevoegen

**Bestand:** `supabase/functions/storefront-api/index.ts`

Nieuwe actie `checkout_verify_payment` die:
1. `cart_id` ontvangt van de success-pagina
2. De `stripe_session_id` van de cart ophaalt
3. De Stripe Checkout Session opvraagt via de Stripe API
4. Als `payment_status === 'paid'`: de order direct aanmaakt (dezelfde logica als de webhook)
5. Als nog niet betaald: `{ status: 'pending' }` retourneert

**Idempotentie:** Als de webhook de order al heeft aangemaakt (`checkout_status === 'converted'`), zoekt het de bestaande order op en retourneert die — geen dubbele orders.

### Stappen
1. Helper-functie `createOrderFromCart` extraheren uit de webhook-code om duplicatie te voorkomen
2. Nieuwe `checkoutVerifyPayment` functie toevoegen aan de storefront API
3. Route `checkout_verify_payment` registreren in de action-switch
4. Webhook aanpassen om dezelfde helper te gebruiken (refactor)

### Resultaat
- Success-pagina kan direct na redirect verifiëren → order in **2-5 seconden** i.p.v. 30-60
- Webhook blijft als safety net (idempotent)
- Geen wijzigingen nodig aan Mancini-frontend (alleen een andere API-actie aanroepen)

### Bestanden
| Bestand | Wat |
|---------|-----|
| `supabase/functions/storefront-api/index.ts` | `checkoutVerifyPayment` + helper + route |
| `supabase/functions/stripe-connect-webhook/index.ts` | Refactor naar gedeelde helper (optioneel, kan later) |

