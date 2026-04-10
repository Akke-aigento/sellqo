import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export function useTenantPageOverrides() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: overrides, isLoading } = useQuery({
    queryKey: ['tenant-page-overrides', tenantId],
    queryFn: async () => {
      if (!tenantId) return { hiddenPages: [] as string[], grantedFeatures: [] as string[] };

      const { data, error } = await supabase
        .from('tenant_feature_overrides')
        .select('hidden_pages, granted_features')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return {
        hiddenPages: (data?.hidden_pages as string[]) || [],
        grantedFeatures: (data?.granted_features as string[]) || [],
      };
    },
    enabled: !!tenantId,
  });

  const hiddenPages = overrides?.hiddenPages || [];
  const grantedFeatures = overrides?.grantedFeatures || [];

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
      queryClient.setQueryData(['tenant-page-overrides', tenantId], (old: any) => ({
        hiddenPages: newHidden,
        grantedFeatures: old?.grantedFeatures || [],
      }));
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
      queryClient.setQueryData(['tenant-page-overrides', tenantId], (old: any) => ({
        hiddenPages: pages,
        grantedFeatures: old?.grantedFeatures || [],
      }));
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-overrides'] });
    },
  });

  const toggleFeatureGrant = useMutation({
    mutationFn: async (featureKey: string) => {
      if (!tenantId) throw new Error('No tenant');

      const newGranted = grantedFeatures.includes(featureKey)
        ? grantedFeatures.filter(k => k !== featureKey)
        : [...grantedFeatures, featureKey];

      const { error } = await supabase
        .from('tenant_feature_overrides')
        .upsert({
          tenant_id: tenantId,
          granted_features: newGranted,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id',
        });

      if (error) throw error;
      return newGranted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-page-overrides', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-overrides'] });
    },
    onError: () => {
      toast.error('Kon feature-instelling niet opslaan');
    },
  });

  const isPageHidden = (pageId: string) => hiddenPages.includes(pageId);
  const isFeatureGranted = (featureKey: string) => grantedFeatures.includes(featureKey);

  const togglePage = (pageId: string) => togglePageMutation.mutate(pageId);
  const toggleGrantedFeature = (featureKey: string) => toggleFeatureGrant.mutate(featureKey);

  return {
    hiddenPages,
    grantedFeatures,
    isLoading,
    isPageHidden,
    isFeatureGranted,
    togglePage,
    toggleGrantedFeature,
    setHiddenPages: setHiddenPages.mutate,
    isToggling: togglePageMutation.isPending,
    isTogglingFeature: toggleFeatureGrant.isPending,
  };
}
