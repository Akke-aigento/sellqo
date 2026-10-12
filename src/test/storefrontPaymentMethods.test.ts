import { describe, expect, it } from 'vitest';
import { storefrontPaymentMethods, paymentIconKeys } from '@/lib/storefrontPaymentMethods';

describe('APP-CLEAN-3a storefrontPaymentMethods', () => {
  it('volgt de checkout: stripe + submethoden + overschrijving', () => {
    expect(storefrontPaymentMethods({ payment_methods_enabled: ['stripe', 'bank_transfer'], stripe_payment_methods: ['card', 'ideal'] }))
      .toEqual(['card', 'ideal', 'bank_transfer']);
  });
  it('alleen overschrijving → geen kaartmerken', () => {
    const m = storefrontPaymentMethods({ payment_methods_enabled: ['bank_transfer'] });
    expect(m).toEqual(['bank_transfer']);
    expect(paymentIconKeys(m)).toEqual([]);
  });
  it('kaart = Visa + Mastercard, geen wallets of Revolut', () => {
    expect(paymentIconKeys(['card', 'bancontact'])).toEqual(['visa', 'mastercard', 'bancontact']);
  });
  it('stripe zonder submethoden valt terug op de checkout-standaard', () => {
    expect(storefrontPaymentMethods({ payment_methods_enabled: ['stripe'] })).toEqual(['card', 'ideal', 'bancontact']);
  });
});
