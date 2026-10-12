import type { POSCartItem } from '@/types/pos';

export type PosVatHandling = 'inclusive' | 'exclusive';

export interface PosCartDiscount {
  type: 'percentage' | 'fixed' | string;
  value: number;
}

export interface PosVatLine {
  /** btw-tarief in procent */
  rate: number;
  /** maatstaf (netto, na korting) */
  base: number;
  /** btw-bedrag */
  tax: number;
}

export interface PosTotals {
  subtotal: number;
  discount: number;
  cartDiscountAmount: number;
  taxTotal: number;
  total: number;
  /** APP-CLEAN-3c: btw per tarief, voor het kassaticket (was altijd "BTW (21%)"). */
  vatLines: PosVatLine[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Canonical POS totals calculation.
 *
 * Mirrors `supabase/functions/create-checkout-session/index.ts` (VAT handling)
 * and follows the per-rate rounding strategy documented in
 * `src/lib/calculations/ROUNDING_RULES.md` (BIS 3.0, per-rate not per-line).
 *
 * - inclusive: prices already include VAT → VAT is EXTRACTED, never added on top.
 * - exclusive: VAT is added on top of the net amount.
 */
export function calculatePosTotals(
  items: POSCartItem[],
  cartDiscount: PosCartDiscount | null | undefined,
  vatHandling: PosVatHandling | string | null | undefined
): PosTotals {
  const itemSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);

  let cartDiscountAmount = 0;
  if (cartDiscount) {
    cartDiscountAmount =
      cartDiscount.type === 'percentage'
        ? (itemSubtotal * cartDiscount.value) / 100
        : cartDiscount.value;
  }

  const totalDiscount = itemDiscount + cartDiscountAmount;

  // Net-after-item-discount per VAT rate group
  const groups = new Map<number, number>();
  for (const item of items) {
    const rate = item.tax_rate || 0;
    const net = item.price * item.quantity - (item.discount || 0);
    groups.set(rate, (groups.get(rate) || 0) + net);
  }

  const groupBase = Array.from(groups.values()).reduce((s, v) => s + v, 0);

  const inclusive = (vatHandling || 'inclusive') !== 'exclusive';

  let taxTotal = 0;
  const vatLines: PosVatLine[] = [];
  for (const [rate, amount] of groups.entries()) {
    // Distribute the cart-level discount proportionally over the rate groups
    const share = groupBase > 0 ? amount / groupBase : 0;
    const base = amount - cartDiscountAmount * share;
    if (rate === 0 || base === 0) continue;
    const tax = inclusive
      ? round2(base - base / (1 + rate / 100))
      : round2(base * (rate / 100));
    taxTotal += tax;
    vatLines.push({ rate, base: round2(inclusive ? base - tax : base), tax });
  }
  taxTotal = round2(taxTotal);
  vatLines.sort((a, b) => b.rate - a.rate);

  const total = inclusive
    ? round2(itemSubtotal - totalDiscount)
    : round2(itemSubtotal - totalDiscount + taxTotal);

  return {
    subtotal: itemSubtotal,
    discount: totalDiscount,
    cartDiscountAmount,
    taxTotal,
    total,
    vatLines,
  };
}
/**
 * APP-CLEAN-3c — btw-regels voor een opgeslagen kassatransactie (ticket, download).
 *
 * Herberekent per tarief uit de bewaarde regels; de mandkorting is het deel van
 * discount_total dat niet op een regel staat. Geeft `null` als de som niet klopt
 * met het opgeslagen tax_total (oude transacties, andere btw-modus): dan toont het
 * ticket één regel "BTW" met het opgeslagen bedrag, zonder verzonnen percentage.
 */
export function receiptVatLines(
  transaction: { items: POSCartItem[]; discount_total?: number | null; tax_total: number },
  vatHandling: PosVatHandling | string | null | undefined,
): PosVatLine[] | null {
  const itemDiscount = transaction.items.reduce((s, i) => s + (i.discount || 0), 0);
  const cartDiscount = Math.max(0, round2((transaction.discount_total || 0) - itemDiscount));
  const totals = calculatePosTotals(
    transaction.items,
    cartDiscount > 0 ? { type: 'fixed', value: cartDiscount } : null,
    vatHandling,
  );
  return Math.abs(totals.taxTotal - Number(transaction.tax_total)) <= 0.02 ? totals.vatLines : null;
}

/** "BTW 21%" / "BTW 6%" — Belgische notatie zonder overbodige decimalen. */
export function vatLabel(rate: number): string {
  return `BTW ${Number.isInteger(rate) ? rate : rate.toFixed(1).replace('.', ',')}%`;
}
