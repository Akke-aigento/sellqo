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

// LOYALTY-1: het formulier en de types gebruiken andere veldnamen dan de databank
// (point_value, min_redemption_points, points_expiry_days). Daardoor faalde aanmaken
// altijd. Deze twee functies vertalen in beide richtingen.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function programFromDb(row: any): LoyaltyProgram {
  return {
    ...row,
    points_value: Number(row.point_value ?? 0),
    min_points_redeem: Number(row.min_redemption_points ?? 0),
    points_expiry_months: row.points_expiry_days != null ? Math.round(Number(row.points_expiry_days) / 30) : null,
    tiers: (row.tiers || []).slice().sort((a: LoyaltyTier, b: LoyaltyTier) => a.min_points - b.min_points),
  } as LoyaltyProgram;
}

function programToDb(formData: Partial<LoyaltyProgramFormData>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (formData.name !== undefined) out.name = formData.name;
  if (formData.description !== undefined) out.description = formData.description;
  if (formData.points_per_euro !== undefined) out.points_per_euro = formData.points_per_euro;
  if (formData.points_value !== undefined) out.point_value = formData.points_value;
  if (formData.min_points_redeem !== undefined) out.min_redemption_points = formData.min_points_redeem;
  if (formData.max_redemption_percentage !== undefined) out.max_redemption_percentage = formData.max_redemption_percentage;
  if (formData.points_expiry_months !== undefined) {
    out.points_expiry_days = formData.points_expiry_months ? formData.points_expiry_months * 30 : null;
  }
  if (formData.is_active !== undefined) out.is_active = formData.is_active;
  return out;
}

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
      return (data || []).map(programFromDb);
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
      return programFromDb(data);
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
          ...programToDb(formData),
          tenant_id: currentTenant.id,
        } as never)
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
        .update(programToDb(formData) as never)
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
        } as never)
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
          // LOYALTY-1: de databank kent 'adjustment', niet 'adjust' (check constraint).
          transaction_type: type === 'adjust' ? 'adjustment' : type,
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

// LOYALTY-1: niveaus bewerken. Bestaande niveaus worden in place bijgewerkt (klanten
// verwijzen ernaar via current_tier_id), nieuwe toegevoegd, weggehaalde verwijderd
// zolang geen klant op dat niveau staat.
export function useSyncLoyaltyTiers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ programId, tiers }: { programId: string; tiers: (LoyaltyTierFormData & { id?: string })[] }) => {
      const { data: existing, error } = await supabase
        .from('loyalty_tiers')
        .select('id')
        .eq('loyalty_program_id', programId);
      if (error) throw error;
      const keep = new Set(tiers.map((t) => t.id).filter(Boolean) as string[]);
      for (const tier of tiers) {
        const row = {
          name: tier.name,
          min_points: tier.min_points,
          points_multiplier: tier.points_multiplier,
          discount_percentage: tier.discount_percentage ?? null,
        };
        if (tier.id) {
          const { error: upErr } = await supabase.from('loyalty_tiers').update(row as never).eq('id', tier.id);
          if (upErr) throw upErr;
        } else {
          const { error: insErr } = await supabase.from('loyalty_tiers').insert({ ...row, loyalty_program_id: programId } as never);
          if (insErr) throw insErr;
        }
      }
      for (const old of existing || []) {
        if (keep.has(old.id)) continue;
        const { error: delErr } = await supabase.from('loyalty_tiers').delete().eq('id', old.id);
        if (delErr) throw new Error('Een niveau waar nog klanten op staan kan niet verwijderd worden.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-programs'] });
    },
    onError: (error) => {
      toast({ title: 'Fout bij opslaan niveaus', description: error.message, variant: 'destructive' });
    },
  });
}
