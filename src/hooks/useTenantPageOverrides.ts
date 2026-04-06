import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export function useTenantPageOverrides() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: hiddenPages = [], isLoading } = useQuery({
    queryKey: ['tenant-page-overrides', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('tenant_feature_overrides')
        .select('hidden_pages')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return (data?.hidden_pages as string[]) || [];
    },
    enabled: !!tenantId,
  });

  const togglePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (!tenantId) throw new Error('No tenant');

      const newHidden = hiddenPages.includes(pageId)
        ? hiddenPages.filter(id => id !== pageId)
        : [...hiddenPages, pageId];

      const { error } = await supabase
        .from('tenant_feature_overrides')
        .upsert({
          tenant_id: tenantId,
          hidden_pages: newHidden,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id',
        });

      if (error) throw error;
      return newHidden;
    },
    onSuccess: (newHidden) => {
      queryClient.setQueryData(['tenant-page-overrides', tenantId], newHidden);
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-overrides'] });
    },
    onError: () => {
      toast.error('Kon pagina-instelling niet opslaan');
    },
  });

  const setHiddenPages = useMutation({
    mutationFn: async (pages: string[]) => {
      if (!tenantId) throw new Error('No tenant');

      const { error } = await supabase
        .from('tenant_feature_overrides')
        .upsert({
          tenant_id: tenantId,
          hidden_pages: pages,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id',
        });

      if (error) throw error;
      return pages;
    },
    onSuccess: (pages) => {
      queryClient.setQueryData(['tenant-page-overrides', tenantId], pages);
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-overrides'] });
    },
  });

  const isPageHidden = (pageId: string) => hiddenPages.includes(pageId);

  const togglePage = (pageId: string) => togglePageMutation.mutate(pageId);

  return {
    hiddenPages,
    isLoading,
    isPageHidden,
    togglePage,
    setHiddenPages: setHiddenPages.mutate,
    isToggling: togglePageMutation.isPending,
  };
}
