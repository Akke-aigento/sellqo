export function calculateStripeFee(amountCents: number, method: string): number {
  switch (method) {
    case 'bancontact': return 25;
    case 'ideal': return 29;
    case 'card': return Math.round(amountCents * 0.015) + 25;
    case 'klarna': return Math.round(amountCents * 0.035) + 30;
    case 'sepa_debit': return Math.min(Math.round(amountCents * 0.008), 600);
    case 'bank_transfer': return 0;
    default: return Math.round(amountCents * 0.015) + 25;
  }
}

export function getAvailablePaymentMethods(tenant: any, cartTotalCents: number, country = 'BE') {
  const stripeMethods: string[] = tenant.stripe_payment_methods || [];
  const enabled: string[] = tenant.payment_methods_enabled || [];
  const result: any[] = [];
  const hasStripe = tenant.stripe_account_id && tenant.stripe_charges_enabled && enabled.includes('stripe');

  if (hasStripe && stripeMethods.includes('bancontact')) {
    result.push({ method: 'bancontact', group: 'direct', name: 'Bancontact', 
      description: 'Belgisch betaalsysteem', fee_cents: calculateStripeFee(cartTotalCents, 'bancontact'), available: true });
  }
  if (hasStripe && stripeMethods.includes('ideal')) {
    result.push({ method: 'ideal', group: 'direct', name: 'iDEAL', 
      description: 'Nederlandse bankoverschrijving', fee_cents: calculateStripeFee(cartTotalCents, 'ideal'), available: true });
  }
  if (hasStripe && stripeMethods.includes('card')) {
    result.push({ method: 'card', group: 'direct', name: 'Kaart / Apple Pay / Google Pay', 
      description: 'Visa, Mastercard, Amex', fee_cents: calculateStripeFee(cartTotalCents, 'card'), available: true });
  }
  if (hasStripe && stripeMethods.includes('klarna')) {
    const eu = ['BE','NL','DE','FR','AT','IT','ES','FI','SE','DK','NO'].includes(country);
    const reason = cartTotalCents < 3500 ? 'Minimum €35' : !eu ? 'Niet in jouw land' : null;
    result.push({ method: 'klarna', group: 'later', name: 'Klarna', 
      description: 'Achteraf betalen of in 3 termijnen', 
      fee_cents: calculateStripeFee(cartTotalCents, 'klarna'),
      available: cartTotalCents >= 3500 && eu, reason_unavailable: reason });
  }
  if (tenant.iban && enabled.includes('bank_transfer')) {
    result.push({ method: 'bank_transfer', group: 'transfer', name: 'Bankoverschrijving (QR)', 
      description: 'Scan QR met je bank-app — SEPA Instant', fee_cents: 0, available: true });
  }
  return result;
}
