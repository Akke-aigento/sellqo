import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

export interface ABTestConfig {
  id: string;
  campaign_a_id: string;
  campaign_b_id: string;
  tenant_id: string;
  test_metric: 'open_rate' | 'click_rate' | 'conversion';
  test_percentage: number;
  winner_threshold: number;
  auto_select_winner: boolean;
  winner_id: string | null;
  status: 'pending' | 'running' | 'completed';
  created_at: string;
  updated_at: string;
  // Joined data
  campaign_a?: any;
  campaign_b?: any;
}

export function useABTests() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: abTests = [], isLoading } = useQuery({
    queryKey: ['ab-tests', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('ab_test_configs')
        .select(`
          *,
          campaign_a:email_campaigns!ab_test_configs_campaign_a_id_fkey(id, name, subject, status, total_sent, total_opened, total_clicked),
          campaign_b:email_campaigns!ab_test_configs_campaign_b_id_fkey(id, name, subject, status, total_sent, total_opened, total_clicked)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ABTestConfig[];
    },
    enabled: !!currentTenant?.id,
  });

  const createABTest = useMutation({
    mutationFn: async (config: Partial<ABTestConfig>) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('ab_test_configs')
        .insert({
          tenant_id: currentTenant.id,
          campaign_a_id: config.campaign_a_id,
          campaign_b_id: config.campaign_b_id,
          test_metric: config.test_metric || 'open_rate',
          test_percentage: config.test_percentage || 20,
          winner_threshold: config.winner_threshold || 0.95,
          auto_select_winner: config.auto_select_winner ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      // Mark campaigns as A/B test
      await supabase
        .from('email_campaigns')
        .update({ is_ab_test: true, variant_label: 'A' })
        .eq('id', config.campaign_a_id);

      await supabase
        .from('email_campaigns')
        .update({ is_ab_test: true, variant_label: 'B', ab_variant_of: config.campaign_a_id })
        .eq('id', config.campaign_b_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'A/B test aangemaakt!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij aanmaken', description: error.message, variant: 'destructive' });
    },
  });

  const selectWinner = useMutation({
    mutationFn: async ({ testId, winnerId }: { testId: string; winnerId: string }) => {
      const { error } = await supabase
        .from('ab_test_configs')
        .update({ 
          winner_id: winnerId, 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', testId);

      if (error) throw error;

      // Mark winner campaign
      await supabase
        .from('email_campaigns')
        .update({ ab_test_winner_selected_at: new Date().toISOString() })
        .eq('id', winnerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      toast({ title: 'Winnaar geselecteerd!' });
    },
  });

  const calculateStats = (campaign: any) => {
    const sent = campaign?.total_sent || 0;
    const opened = campaign?.total_opened || 0;
    const clicked = campaign?.total_clicked || 0;

    return {
      sent,
      opened,
      clicked,
      openRate: sent > 0 ? (opened / sent) * 100 : 0,
      clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
    };
  };

  return {
    abTests,
    isLoading,
    createABTest,
    selectWinner,
    calculateStats,
  };
}
