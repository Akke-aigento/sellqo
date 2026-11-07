/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde Stripe-objecten */
// FIXES-0711 — Stripe-stub voor de handler-tests (import_map.resolve.json): ongetypeerd (`any`), zodat
// deno check de echte aanroepen (create/retrieve/expire met stripeAccount) niet tegen een nagebouwde
// API controleert. Gedrag stuurt de test via globalThis:
//   __stripeCreateError  → checkout.sessions.create faalt met die fout (bv. een foute sleutel);
//   __stripeRetrieve     → de sessie die retrieve teruggeeft.
const Stripe: any = class {
  checkout = {
    sessions: {
      create: (_params: any, _opts?: any) => {
        const fail = (globalThis as any).__stripeCreateError;
        if (fail) return Promise.reject(fail);
        return Promise.resolve({ id: 'cs_test_1', url: 'https://stripe.test/1' });
      },
      retrieve: (id: string, _opts?: any) => Promise.resolve((globalThis as any).__stripeRetrieve ?? { id, status: 'open', payment_status: 'unpaid', url: 'https://stripe.test/1' }),
      expire: (id: string, _opts?: any) => Promise.resolve({ id, status: 'expired' }),
    },
  };
  refunds = { create: (_p: any, _o?: any) => Promise.resolve({ id: 're_test_1' }) };
};

export default Stripe;
