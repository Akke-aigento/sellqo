import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

export interface SidebarPreferences {
  id: string;
  user_id: string;
  tenant_id: string;
  hidden_items: string[];
  created_at: string;
  updated_at: string;
}

export function useSidebarPreferences() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['sidebar-preferences', user?.id, currentTenant?.id],
    queryFn: async () => {
      if (!user?.id || !currentTenant?.id) return null;
      
      const { data, error } = await supabase
        .from('sidebar_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data as SidebarPreferences | null;
    },
    enabled: !!user?.id && !!currentTenant?.id,
  });

  const updatePreferences = useMutation({
    mutationFn: async (hiddenItems: string[]) => {
      if (!user?.id || !currentTenant?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sidebar_preferences')
        .upsert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          hidden_items: hiddenItems,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,tenant_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences'] });
    },
  });

  const toggleItem = (itemId: string) => {
    const currentHidden = preferences?.hidden_items || [];
    const newHidden = currentHidden.includes(itemId)
      ? currentHidden.filter(id => id !== itemId)
      : [...currentHidden, itemId];
    updatePreferences.mutate(newHidden);
  };

  const isItemHidden = (itemId: string) => {
    return preferences?.hidden_items?.includes(itemId) || false;
  };

  const showAllItems = () => {
    updatePreferences.mutate([]);
  };

  return {
    preferences,
    isLoading,
    hiddenItems: preferences?.hidden_items || [],
    toggleItem,
    isItemHidden,
    showAllItems,
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
  };
}
