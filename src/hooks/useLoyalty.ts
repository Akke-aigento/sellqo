import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { 
  LoyaltyProgram, 
  LoyaltyTier, 
  CustomerLoyalty, 
  LoyaltyTransaction,
  LoyaltyProgramFormData,
  LoyaltyTierFormData 
} from '@/types/promotions';

export function useLoyaltyPrograms() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['loyalty-programs', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('loyalty_programs')
        .select(`
          *,
          tiers:loyalty_tiers(*)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as LoyaltyProgram[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useLoyaltyProgram(id: string | undefined) {
  return useQuery({
    queryKey: ['loyalty-programs', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('loyalty_programs')
        .select(`
          *,
          tiers:loyalty_tiers(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as LoyaltyProgram;
    },
    enabled: !!id,
  });
}

export function useCustomerLoyalty(programId: string | undefined) {
  return useQuery({
    queryKey: ['customer-loyalty', programId],
    queryFn: async () => {
      if (!programId) return [];

      const { data, error } = await supabase
        .from('customer_loyalty')
        .select(`
          *,
          customer:customers(id, email, first_name, last_name),
          current_tier:loyalty_tiers(*)
        `)
        .eq('loyalty_program_id', programId)
        .order('points_balance', { ascending: false });

      if (error) throw error;
      return data as unknown as CustomerLoyalty[];
    },
    enabled: !!programId,
  });
}

export function useLoyaltyTransactions(customerLoyaltyId: string | undefined) {
  return useQuery({
    queryKey: ['loyalty-transactions', customerLoyaltyId],
    queryFn: async () => {
      if (!customerLoyaltyId) return [];

      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('customer_loyalty_id', customerLoyaltyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LoyaltyTransaction[];
    },
    enabled: !!customerLoyaltyId,
  });
}

export function useCreateLoyaltyProgram() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: LoyaltyProgramFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data, error } = await supabase
        .from('loyalty_programs')
        .insert({
          ...formData,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-programs'] });
      toast({ title: 'Loyaliteitsprogramma aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken loyaliteitsprogramma',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateLoyaltyProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<LoyaltyProgramFormData> }) => {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-programs'] });
      toast({ title: 'Loyaliteitsprogramma bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken loyaliteitsprogramma',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteLoyaltyProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('loyalty_programs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-programs'] });
      toast({ title: 'Loyaliteitsprogramma verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen loyaliteitsprogramma',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCreateLoyaltyTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ programId, formData }: { programId: string; formData: LoyaltyTierFormData }) => {
      const { data, error } = await supabase
        .from('loyalty_tiers')
        .insert({
          ...formData,
          loyalty_program_id: programId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-programs'] });
      toast({ title: 'Tier aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken tier',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteLoyaltyTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('loyalty_tiers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-programs'] });
      toast({ title: 'Tier verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen tier',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAdjustLoyaltyPoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      customerLoyaltyId, 
      points, 
      type, 
      description 
    }: { 
      customerLoyaltyId: string; 
      points: number; 
      type: 'earn' | 'redeem' | 'adjust';
      description?: string;
    }) => {
      // Create transaction
      const { error: txError } = await supabase
        .from('loyalty_transactions')
        .insert({
          customer_loyalty_id: customerLoyaltyId,
          transaction_type: type,
          points: type === 'redeem' ? -Math.abs(points) : points,
          description,
        });

      if (txError) throw txError;

      // Update balance
      const { data: current } = await supabase
        .from('customer_loyalty')
        .select('points_balance, points_earned_total, points_spent_total')
        .eq('id', customerLoyaltyId)
        .single();

      if (!current) throw new Error('Klantloyaliteit niet gevonden');

      const newBalance = current.points_balance + (type === 'redeem' ? -Math.abs(points) : points);
      const newEarned = type === 'earn' ? current.points_earned_total + points : current.points_earned_total;
      const newSpent = type === 'redeem' ? current.points_spent_total + Math.abs(points) : current.points_spent_total;

      const { error: updateError } = await supabase
        .from('customer_loyalty')
        .update({
          points_balance: newBalance,
          points_earned_total: newEarned,
          points_spent_total: newSpent,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', customerLoyaltyId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-transactions'] });
      toast({ title: 'Punten aangepast' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanpassen punten',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
