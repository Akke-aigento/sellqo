import type { POSCartItem } from '@/types/pos';

export type PosVatHandling = 'inclusive' | 'exclusive';

export interface PosCartDiscount {
  type: 'percentage' | 'fixed' | string;
  value: number;
}

export interface PosTotals {
  subtotal: number;
  discount: number;
  cartDiscountAmount: number;
  taxTotal: number;
  total: number;
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
  for (const [rate, amount] of groups.entries()) {
    // Distribute the cart-level discount proportionally over the rate groups
    const share = groupBase > 0 ? amount / groupBase : 0;
    const base = amount - cartDiscountAmount * share;
    if (rate === 0 || base === 0) continue;
    taxTotal += inclusive
      ? round2(base - base / (1 + rate / 100))
      : round2(base * (rate / 100));
  }
  taxTotal = round2(taxTotal);

  const total = inclusive
    ? round2(itemSubtotal - totalDiscount)
    : round2(itemSubtotal - totalDiscount + taxTotal);

  return {
    subtotal: itemSubtotal,
    discount: totalDiscount,
    cartDiscountAmount,
    taxTotal,
    total,
  };
}