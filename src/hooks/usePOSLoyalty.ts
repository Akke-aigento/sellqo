import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

interface EarnPointsParams {
  customerId: string;
  orderTotal: number;
  orderId?: string;
  description?: string;
}

interface RedeemPointsParams {
  customerId: string;
  points: number;
  euroValue: number;
  orderId?: string;
  description?: string;
}

interface LoyaltyProgram {
  id: string;
  points_per_euro: number;
  point_value: number;
}

interface CustomerLoyalty {
  id: string;
  points_balance: number;
  points_earned_total: number;
  points_spent_total: number;
}

export function usePOSLoyalty() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  // Helper to get active loyalty program
  const getActiveLoyaltyProgram = async (): Promise<LoyaltyProgram | null> => {
    if (!currentTenant?.id) return null;

    const { data } = await supabase
      .from('loyalty_programs')
      .select('id, points_per_euro, point_value')
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    return data;
  };

  // Helper to get or create customer loyalty record
  const getOrCreateCustomerLoyalty = async (
    customerId: string,
    programId: string
  ): Promise<CustomerLoyalty | null> => {
    // Try to find existing
    const { data: existing } = await supabase
      .from('customer_loyalty')
      .select('id, points_balance, points_earned_total, points_spent_total')
      .eq('customer_id', customerId)
      .eq('loyalty_program_id', programId)
      .maybeSingle();

    if (existing) return existing;

    // Create new loyalty record
    const { data: created, error } = await supabase
      .from('customer_loyalty')
      .insert({
        customer_id: customerId,
        loyalty_program_id: programId,
        points_balance: 0,
        points_earned_total: 0,
        points_spent_total: 0,
      })
      .select('id, points_balance, points_earned_total, points_spent_total')
      .single();

    if (error) {
      console.error('Error creating customer loyalty:', error);
      return null;
    }

    return created;
  };

  // Earn points after a sale
  const earnPoints = useMutation({
    mutationFn: async ({ customerId, orderTotal, orderId, description }: EarnPointsParams) => {
      const program = await getActiveLoyaltyProgram();
      if (!program) {
        console.log('No active loyalty program');
        return null;
      }

      const customerLoyalty = await getOrCreateCustomerLoyalty(customerId, program.id);
      if (!customerLoyalty) {
        console.error('Could not get/create customer loyalty');
        return null;
      }

      // Calculate points to earn
      const pointsToEarn = Math.floor(orderTotal * program.points_per_euro);
      if (pointsToEarn <= 0) return null;

      // Create transaction record
      const { error: txError } = await supabase
        .from('loyalty_transactions')
        .insert({
          customer_loyalty_id: customerLoyalty.id,
          transaction_type: 'earn',
          points: pointsToEarn,
          order_id: orderId || null,
          description: description || `POS verkoop: ${orderTotal.toFixed(2)} EUR`,
        });

      if (txError) throw txError;

      // Update balance
      const { error: updateError } = await supabase
        .from('customer_loyalty')
        .update({
          points_balance: customerLoyalty.points_balance + pointsToEarn,
          points_earned_total: customerLoyalty.points_earned_total + pointsToEarn,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', customerLoyalty.id);

      if (updateError) throw updateError;

      return { pointsEarned: pointsToEarn };
    },
    onSuccess: (result) => {
      if (result) {
        queryClient.invalidateQueries({ queryKey: ['customer-loyalty'] });
      }
    },
    onError: (error) => {
      console.error('Error earning loyalty points:', error);
    },
  });

  // Redeem points during checkout
  const redeemPoints = useMutation({
    mutationFn: async ({ customerId, points, euroValue, orderId, description }: RedeemPointsParams) => {
      const program = await getActiveLoyaltyProgram();
      if (!program) {
        throw new Error('Geen actief loyalty programma');
      }

      const customerLoyalty = await getOrCreateCustomerLoyalty(customerId, program.id);
      if (!customerLoyalty) {
        throw new Error('Klant loyalty niet gevonden');
      }

      if (customerLoyalty.points_balance < points) {
        throw new Error('Onvoldoende punten');
      }

      // Create transaction record
      const { error: txError } = await supabase
        .from('loyalty_transactions')
        .insert({
          customer_loyalty_id: customerLoyalty.id,
          transaction_type: 'redeem',
          points: -Math.abs(points),
          order_id: orderId || null,
          description: description || `POS inwisseling: ${euroValue.toFixed(2)} EUR`,
        });

      if (txError) throw txError;

      // Update balance
      const { error: updateError } = await supabase
        .from('customer_loyalty')
        .update({
          points_balance: customerLoyalty.points_balance - points,
          points_spent_total: customerLoyalty.points_spent_total + points,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', customerLoyalty.id);

      if (updateError) throw updateError;

      return { pointsRedeemed: points, euroValue };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty'] });
    },
    onError: (error) => {
      console.error('Error redeeming loyalty points:', error);
      toast.error('Fout bij inwisselen punten');
    },
  });

  return {
    earnPoints,
    redeemPoints,
    getActiveLoyaltyProgram,
  };
}
