/**
 * APP-CLEAN-3a — welke betaalmethoden een winkel echt aanbiedt.
 *
 * Zelfde afleiding als ShopCheckout (payment_methods_enabled + stripe_payment_methods),
 * zodat footer-iconen en de "veilig betalen met…"-tekst nooit iets beloven dat de
 * checkout niet heeft. Tot 12-10-2026 toonde elke winkel acht vaste merken
 * (incl. Revolut Pay, dat de checkout niet kent) en "Stripe Geverifieerd Partner".
 */
export type StorefrontPaymentMethod = 'card' | 'ideal' | 'bancontact' | 'klarna' | 'bank_transfer';

export interface PaymentTenantFields {
  payment_methods_enabled?: string[] | null;
  stripe_payment_methods?: string[] | null;
}

const STRIPE_SUB = ['card', 'ideal', 'bancontact', 'klarna'] as const;

export function storefrontPaymentMethods(tenant: PaymentTenantFields | null | undefined): StorefrontPaymentMethod[] {
  if (!tenant) return [];
  const raw = tenant.payment_methods_enabled ?? [];
  const methods: StorefrontPaymentMethod[] = [];
  if (raw.includes('stripe')) {
    const sub = tenant.stripe_payment_methods ?? ['card', 'ideal', 'bancontact'];
    for (const m of sub) if ((STRIPE_SUB as readonly string[]).includes(m) && !methods.includes(m as StorefrontPaymentMethod)) methods.push(m as StorefrontPaymentMethod);
  }
  for (const m of raw) {
    if ((STRIPE_SUB as readonly string[]).includes(m) && !methods.includes(m as StorefrontPaymentMethod)) methods.push(m as StorefrontPaymentMethod);
  }
  if (raw.includes('bank_transfer')) methods.push('bank_transfer');
  return methods;
}

/** Icoon-sleutels voor PaymentMethodIcons. Kaart = Visa + Mastercard; overschrijving heeft geen merkicoon. */
export function paymentIconKeys(methods: StorefrontPaymentMethod[]): string[] {
  const keys: string[] = [];
  if (methods.includes('card')) keys.push('visa', 'mastercard');
  if (methods.includes('ideal')) keys.push('ideal');
  if (methods.includes('bancontact')) keys.push('bancontact');
  if (methods.includes('klarna')) keys.push('klarna');
  return keys;
}
