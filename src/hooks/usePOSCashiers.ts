import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export interface POSCashier {
  id: string;
  tenant_id: string;
  display_name: string;
  avatar_color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePOSCashiers() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cashiersQuery = useQuery({
    queryKey: ['pos-cashiers', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const { data, error } = await supabase
        .from('pos_cashiers')
        .select('id, tenant_id, display_name, avatar_color, is_active, created_at, updated_at')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('display_name');
      if (error) throw error;
      return (data || []) as POSCashier[];
    },
    enabled: !!currentTenant,
  });

  const allCashiersQuery = useQuery({
    queryKey: ['pos-cashiers-all', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const { data, error } = await supabase
        .from('pos_cashiers')
        .select('id, tenant_id, display_name, avatar_color, is_active, created_at, updated_at')
        .eq('tenant_id', currentTenant.id)
        .order('display_name');
      if (error) throw error;
      return (data || []) as POSCashier[];
    },
    enabled: !!currentTenant,
  });

  const createCashier = useMutation({
    mutationFn: async ({ displayName, pin, avatarColor }: { displayName: string; pin: string; avatarColor?: string }) => {
      if (!currentTenant) throw new Error('No tenant');
      const { data, error } = await supabase.rpc('create_pos_cashier', {
        p_tenant_id: currentTenant.id,
        p_display_name: displayName,
        p_pin: pin,
        p_avatar_color: avatarColor || '#3b82f6',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-cashiers'] });
      queryClient.invalidateQueries({ queryKey: ['pos-cashiers-all'] });
      toast({ title: 'Kassamedewerker aangemaakt' });
    },
    onError: (e: Error) => toast({ title: 'Fout', description: e.message, variant: 'destructive' }),
  });

  const updateCashier = useMutation({
    mutationFn: async ({ id, displayName, avatarColor, isActive }: { id: string; displayName?: string; avatarColor?: string; isActive?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (displayName !== undefined) updates.display_name = displayName;
      if (avatarColor !== undefined) updates.avatar_color = avatarColor;
      if (isActive !== undefined) updates.is_active = isActive;
      const { error } = await supabase.from('pos_cashiers').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-cashiers'] });
      queryClient.invalidateQueries({ queryKey: ['pos-cashiers-all'] });
      toast({ title: 'Kassamedewerker bijgewerkt' });
    },
    onError: (e: Error) => toast({ title: 'Fout', description: e.message, variant: 'destructive' }),
  });

  const updatePin = useMutation({
    mutationFn: async ({ cashierId, newPin }: { cashierId: string; newPin: string }) => {
      const { error } = await supabase.rpc('update_cashier_pin', {
        p_cashier_id: cashierId,
        p_new_pin: newPin,
      });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'PIN bijgewerkt' }),
    onError: (e: Error) => toast({ title: 'Fout', description: e.message, variant: 'destructive' }),
  });

  const verifyPin = async (cashierId: string, pin: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('verify_cashier_pin', {
      p_cashier_id: cashierId,
      p_pin: pin,
    });
    if (error) return false;
    return !!data;
  };

  return {
    cashiers: cashiersQuery.data || [],
    allCashiers: allCashiersQuery.data || [],
    isLoading: cashiersQuery.isLoading,
    createCashier,
    updateCashier,
    updatePin,
    verifyPin,
  };
}
