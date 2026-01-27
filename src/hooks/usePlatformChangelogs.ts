import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ChangelogPlatform = 'bol_com' | 'amazon' | 'stripe' | 'ebay' | 'shopify' | 'woocommerce' | 'meta' | 'resend' | 'other';
export type ChangeType = 'breaking' | 'feature' | 'deprecation' | 'security' | 'bugfix' | 'enhancement';
export type ImpactLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface PlatformChangelog {
  id: string;
  platform: ChangelogPlatform;
  version: string | null;
  change_type: ChangeType;
  title: string;
  description: string | null;
  impact_level: ImpactLevel;
  affected_features: string[];
  source_url: string | null;
  deadline_date: string | null;
  detected_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  action_required: boolean;
  action_taken: string | null;
  action_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PLATFORM_LABELS: Record<ChangelogPlatform, string> = {
  bol_com: 'Bol.com',
  amazon: 'Amazon',
  stripe: 'Stripe',
  ebay: 'eBay',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  meta: 'Meta',
  resend: 'Resend',
  other: 'Overig',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  breaking: 'Breaking Change',
  feature: 'Nieuwe Feature',
  deprecation: 'Deprecation',
  security: 'Security Update',
  bugfix: 'Bugfix',
  enhancement: 'Verbetering',
};

export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  none: 'Geen impact',
  low: 'Laag',
  medium: 'Medium',
  high: 'Hoog',
  critical: 'Kritiek',
};

export function usePlatformChangelogs() {
  const queryClient = useQueryClient();

  const { data: changelogs = [], isLoading } = useQuery({
    queryKey: ['platform-changelogs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_changelogs')
        .select('*')
        .order('detected_at', { ascending: false });
      if (error) throw error;
      return data as PlatformChangelog[];
    },
  });

  const createChangelogMutation = useMutation({
    mutationFn: async (changelogData: Partial<PlatformChangelog>) => {
      const { data, error } = await supabase
        .from('platform_changelogs')
        .insert(changelogData as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-changelogs'] });
      toast.success('Changelog toegevoegd');
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  const updateChangelogMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlatformChangelog> & { id: string }) => {
      const { data, error } = await supabase
        .from('platform_changelogs')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-changelogs'] });
      toast.success('Changelog bijgewerkt');
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  const acknowledgeChangelog = async (id: string) => {
    const { data: userData } = await supabase.auth.getUser();
    return updateChangelogMutation.mutateAsync({
      id,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userData.user?.id,
    });
  };

  const completeAction = async (id: string, actionTaken: string) => {
    return updateChangelogMutation.mutateAsync({
      id,
      action_taken: actionTaken,
      action_completed_at: new Date().toISOString(),
    });
  };

  const getStats = () => {
    const unacknowledged = changelogs.filter(c => !c.acknowledged_at).length;
    const actionRequired = changelogs.filter(c => c.action_required && !c.action_completed_at).length;
    const breaking = changelogs.filter(c => c.change_type === 'breaking' && !c.action_completed_at).length;
    const critical = changelogs.filter(c => c.impact_level === 'critical' && !c.action_completed_at).length;
    
    return { unacknowledged, actionRequired, breaking, critical, total: changelogs.length };
  };

  return {
    changelogs,
    isLoading,
    createChangelog: createChangelogMutation.mutateAsync,
    updateChangelog: updateChangelogMutation.mutateAsync,
    acknowledgeChangelog,
    completeAction,
    getStats,
    isCreating: createChangelogMutation.isPending,
    isUpdating: updateChangelogMutation.isPending,
  };
}
