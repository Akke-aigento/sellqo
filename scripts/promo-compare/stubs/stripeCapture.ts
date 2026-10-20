/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde Stripe-objecten */
// CART-PRICE-1 — Stripe-stub voor de rooktest: checkout.sessions.create betaalt niets, maar
// bewaart de sessieparameters in globalThis.__stripeSessions zodat de test kan nakijken
// welk bedrag de klant zou betalen.
const sessions: any[] = ((globalThis as any).__stripeSessions ||= []);

class Stripe {
  checkout = {
    sessions: {
      create: (params: any) => {
        sessions.push(params);
        return Promise.resolve({ id: `cs_test_${sessions.length}`, url: `https://stripe.test/${sessions.length}` });
      },
      // De test zet globalThis.__stripeRetrieve op de sessie die verify moet terugkrijgen.
      retrieve: (id: string) => Promise.resolve((globalThis as any).__stripeRetrieve ?? { id, payment_status: 'unpaid' }),
    },
  };
  constructor(_key?: string, _opts?: unknown) {}
}

export default Stripe;
