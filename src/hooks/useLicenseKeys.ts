import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import type { LicenseKey } from '@/types/product';

export function useLicenseKeys(productId: string | undefined) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const keysQuery = useQuery({
    queryKey: ['license-keys', productId],
    queryFn: async () => {
      if (!productId || !currentTenant) return [];

      const { data, error } = await supabase
        .from('license_keys')
        .select('*')
        .eq('product_id', productId)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LicenseKey[];
    },
    enabled: !!productId && !!currentTenant,
  });

  const addKeys = useMutation({
    mutationFn: async (keys: string[]) => {
      if (!currentTenant || !productId) throw new Error('Missing tenant or product');

      const records = keys.map(key => ({
        product_id: productId,
        tenant_id: currentTenant.id,
        license_key: key.trim(),
        status: 'available' as const,
      }));

      const { error } = await supabase
        .from('license_keys')
        .insert(records);

      if (error) throw error;
    },
    onSuccess: (_, keys) => {
      queryClient.invalidateQueries({ queryKey: ['license-keys', productId] });
      toast({ title: `${keys.length} licentiecode(s) toegevoegd` });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const revokeKey = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('license_keys')
        .update({ status: 'revoked' })
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license-keys', productId] });
      toast({ title: 'Licentiecode ingetrokken' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('license_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license-keys', productId] });
      toast({ title: 'Licentiecode verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Stats
  const availableCount = keysQuery.data?.filter(k => k.status === 'available').length || 0;
  const assignedCount = keysQuery.data?.filter(k => k.status === 'assigned').length || 0;
  const revokedCount = keysQuery.data?.filter(k => k.status === 'revoked').length || 0;

  return {
    keys: keysQuery.data || [],
    isLoading: keysQuery.isLoading,
    availableCount,
    assignedCount,
    revokedCount,
    addKeys,
    revokeKey,
    deleteKey,
    refetch: keysQuery.refetch,
  };
}
