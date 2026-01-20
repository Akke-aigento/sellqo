// Utility functions for validating promotion eligibility

export function isPromotionActive(
  isActive: boolean,
  validFrom: string | null,
  validUntil: string | null
): boolean {
  if (!isActive) return false;
  
  const now = new Date();
  
  if (validFrom) {
    const from = new Date(validFrom);
    if (now < from) return false;
  }
  
  if (validUntil) {
    const until = new Date(validUntil);
    if (now > until) return false;
  }
  
  return true;
}

export function checkSchedule(schedule: {
  days?: number[];
  start_time?: string;
  end_time?: string;
} | null): boolean {
  if (!schedule) return true;
  
  const now = new Date();
  const currentDay = now.getDay(); // 0-6
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Check day of week
  if (schedule.days && schedule.days.length > 0) {
    if (!schedule.days.includes(currentDay)) return false;
  }
  
  // Check time range
  if (schedule.start_time && currentTime < schedule.start_time) return false;
  if (schedule.end_time && currentTime > schedule.end_time) return false;
  
  return true;
}

export function matchesProducts(
  cartProductIds: string[],
  targetProductIds: string[] | null
): boolean {
  if (!targetProductIds || targetProductIds.length === 0) return true;
  return cartProductIds.some(id => targetProductIds.includes(id));
}

export function matchesCategories(
  cartCategoryIds: (string | null | undefined)[],
  targetCategoryIds: string[] | null
): boolean {
  if (!targetCategoryIds || targetCategoryIds.length === 0) return true;
  const validCategories = cartCategoryIds.filter((c): c is string => !!c);
  return validCategories.some(id => targetCategoryIds.includes(id));
}

export function calculateDiscountValue(
  originalAmount: number,
  discountType: string,
  discountValue: number,
  maxDiscountAmount?: number | null
): number {
  let discount = 0;
  
  if (discountType === 'percentage') {
    discount = originalAmount * (discountValue / 100);
  } else if (discountType === 'fixed_amount' || discountType === 'fixed') {
    discount = discountValue;
  }
  
  // Apply max discount cap if set
  if (maxDiscountAmount && discount > maxDiscountAmount) {
    discount = maxDiscountAmount;
  }
  
  // Never discount more than the original amount
  return Math.min(discount, originalAmount);
}
