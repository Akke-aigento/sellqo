/**
 * PROMO-SAFE-1 — opbouw van DiscountCodeFormData uit de formulierwaarden.
 * Puur (geen React), zodat het gedrag bij bewerken testbaar is.
 */
import type { DiscountAppliesTo, DiscountCode, DiscountCodeFormData, DiscountType } from '@/types/discount';
import { isoToLocalDate, localDayEndIso, localDayStartIso } from '@/lib/discountDates';

export interface DiscountFormValues {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_order_amount?: number | null;
  maximum_discount_amount?: number | null;
  usage_limit?: number | null;
  usage_limit_per_customer?: number | null;
  /** YYYY-MM-DD, lokale kalenderdag (Europe/Brussels). */
  valid_from?: string | null;
  /** YYYY-MM-DD, lokale kalenderdag (Europe/Brussels). */
  valid_until?: string | null;
  is_active: boolean;
  applies_to: DiscountAppliesTo;
  first_order_only: boolean;
  product_ids: string[];
  category_ids: string[];
}

export type StoredDiscountDates = Pick<DiscountCode, 'valid_from' | 'valid_until'>;

/** Valt de gekozen dag samen met de dag van het opgeslagen moment? */
function sameLocalDay(stored: string | null | undefined, day: string): stored is string {
  return !!stored && isoToLocalDate(stored) === day;
}

/**
 * Een ongewijzigde datum behoudt het opgeslagen moment byte-identiek, zodat een
 * bewerking van iets anders een bestaande code niet stil verschuift. Een nieuw
 * gekozen dag = begin (vanaf) of einde (tot) van die lokale dag; leeg = null.
 */
export function resolveDiscountDate(
  day: string | null | undefined,
  stored: string | null | undefined,
  edge: 'start' | 'end',
): string | null {
  if (!day) return null;
  if (sameLocalDay(stored, day)) return stored;
  return edge === 'start' ? localDayStartIso(day) : localDayEndIso(day);
}

export function buildDiscountFormData(
  values: DiscountFormValues,
  stored?: StoredDiscountDates | null,
): DiscountCodeFormData {
  return {
    code: values.code,
    description: values.description || '',
    discount_type: values.discount_type,
    discount_value: values.discount_value,
    minimum_order_amount: values.minimum_order_amount || null,
    maximum_discount_amount: values.maximum_discount_amount || null,
    usage_limit: values.usage_limit || null,
    usage_limit_per_customer: values.usage_limit_per_customer || null,
    valid_from: resolveDiscountDate(values.valid_from, stored?.valid_from, 'start'),
    valid_until: resolveDiscountDate(values.valid_until, stored?.valid_until, 'end'),
    is_active: values.is_active,
    applies_to: values.applies_to,
    product_ids: values.product_ids,
    category_ids: values.category_ids,
    first_order_only: values.first_order_only,
  };
}
