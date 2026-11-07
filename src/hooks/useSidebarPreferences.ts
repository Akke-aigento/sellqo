import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

export interface SidebarPreferences {
  id: string;
  user_id: string;
  tenant_id: string;
  /** FIXES-0711: niet meer gebruikt (zijbalk-personalisatie weg); kolom blijft bestaan. */
  hidden_items: string[];
  /** ONDERBALK-1: snelkoppelingen in de gsm-onderbalk (menu-item-id's, volgorde). Null = standaard. */
  bottom_nav?: string[] | null;
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

  // FIXES-0711: de zijbalk-personalisatie (hidden_items) is weg uit de UI. De kolom blijft staan
  // (DB-safety) maar wordt niet meer geschreven of gelezen; de standaardindeling geldt.

  // ONDERBALK-1: enkel bottom_nav meesturen, zodat de verborgen menu-items (hidden_items) blijven staan.
  const updateBottomNav = useMutation({
    mutationFn: async (items: string[] | null) => {
      if (!user?.id || !currentTenant?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('sidebar_preferences')
        .upsert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          bottom_nav: items && items.length ? items.slice(0, 5) : null,
          updated_at: new Date().toISOString(),
        } as never, { onConflict: 'user_id,tenant_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences'] });
    },
  });

  return {
    preferences,
    isLoading,
    bottomNav: preferences?.bottom_nav ?? null,
    setBottomNav: updateBottomNav.mutateAsync,
    isSavingBottomNav: updateBottomNav.isPending,
  };
}
