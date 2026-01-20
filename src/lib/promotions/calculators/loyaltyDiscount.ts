import type { AppliedDiscount } from '../types';
import type { LoyaltyProgram, CustomerLoyalty } from '@/types/promotions';

export interface LoyaltyResult {
  discount: AppliedDiscount | null;
  pointsEarned: number;
  pointsRedeemed: number;
  loyaltyDiscount: number;
  tierMultiplier: number;
  tierDiscount: number;
}

export function calculateLoyaltyBenefits(
  subtotal: number,
  pointsToRedeem: number,
  loyaltyProgram: LoyaltyProgram | null,
  customerLoyalty: CustomerLoyalty | null
): LoyaltyResult {
  const result: LoyaltyResult = {
    discount: null,
    pointsEarned: 0,
    pointsRedeemed: 0,
    loyaltyDiscount: 0,
    tierMultiplier: 1,
    tierDiscount: 0,
  };

  if (!loyaltyProgram || !loyaltyProgram.is_active) return result;

  // Calculate tier benefits if customer has loyalty
  if (customerLoyalty?.current_tier) {
    const tier = customerLoyalty.current_tier;
    result.tierMultiplier = tier.points_multiplier || 1;
    
    if (tier.discount_percentage) {
      result.tierDiscount = subtotal * (tier.discount_percentage / 100);
    }
  }

  // Calculate points earned from this purchase
  const basePoints = Math.floor(subtotal * loyaltyProgram.points_per_euro);
  result.pointsEarned = Math.floor(basePoints * result.tierMultiplier);

  // Calculate points redemption
  if (pointsToRedeem > 0 && customerLoyalty) {
    // Validate redemption
    const availablePoints = customerLoyalty.points_balance;
    const minPoints = loyaltyProgram.min_points_redeem || 0;

    if (pointsToRedeem >= minPoints && pointsToRedeem <= availablePoints) {
      // Calculate discount value from points
      const pointValue = loyaltyProgram.points_value; // e.g., 0.01 = 1 cent per point
      let potentialDiscount = pointsToRedeem * pointValue;

      // Apply max redemption percentage
      if (loyaltyProgram.max_redemption_percentage) {
        const maxDiscount = subtotal * (loyaltyProgram.max_redemption_percentage / 100);
        potentialDiscount = Math.min(potentialDiscount, maxDiscount);
      }

      // Recalculate points actually needed
      const actualPointsUsed = Math.ceil(potentialDiscount / pointValue);

      result.pointsRedeemed = actualPointsUsed;
      result.loyaltyDiscount = potentialDiscount;

      result.discount = {
        type: 'loyalty',
        name: `${actualPointsUsed} punten ingewisseld`,
        value: potentialDiscount,
        source_id: loyaltyProgram.id,
        description: `Loyaltypunten: ${actualPointsUsed} punten = €${potentialDiscount.toFixed(2)}`,
      };
    }
  }

  // Add tier discount if applicable
  if (result.tierDiscount > 0 && customerLoyalty?.current_tier) {
    result.discount = {
      type: 'loyalty',
      name: `${customerLoyalty.current_tier.name} tier korting`,
      value: result.tierDiscount,
      source_id: loyaltyProgram.id,
      description: `${customerLoyalty.current_tier.name}: ${customerLoyalty.current_tier.discount_percentage}% korting`,
    };
    result.loyaltyDiscount += result.tierDiscount;
  }

  return result;
}
