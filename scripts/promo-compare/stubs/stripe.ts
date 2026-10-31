/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-namespace -- testharnas: ongetypeerde Stripe-objecten */
// Stub voor https://esm.sh/stripe@… in een import map (deno check / rooktest zonder netwerk).
// De functies gebruiken `Stripe` zowel als waarde (`new Stripe(...)`) als als namespace
// voor types (`Stripe.Event`, `Stripe.Checkout.Session`, …). Zonder de namespace-declaratie
// faalt `deno check` met TS2503 "Cannot find namespace 'Stripe'". Alle types zijn `any`:
// dit is een typecheck-stub, geen nagebouwde Stripe-API. Gebruikt een functie een nieuw
// Stripe-type, voeg het hier toe (lijst: grep -rhoE "Stripe\.[A-Z][A-Za-z.]*" supabase/functions).
const Stripe: any = class {};
// Ook als type (`stripe: Stripe` in _shared/stripe.ts), anders TS2709.
type Stripe = any;

declare namespace Stripe {
  type Event = any;
  type Account = any;
  type Payout = any;
  type PayoutListParams = any;
  type PaymentIntent = any;
  type Refund = any;
  type RequestOptions = any;
  type BalanceTransaction = any;
  type BalanceTransactionListParams = any;
  namespace Balance {
    type Available = any;
    type Pending = any;
  }
  namespace Checkout {
    type Session = any;
    namespace SessionCreateParams {
      type LineItem = any;
    }
  }
}

export default Stripe;
