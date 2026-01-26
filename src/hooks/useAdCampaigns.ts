import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import type { AdCampaign, AdCampaignStatus, AdPlatform, CampaignType, AudienceType, BidStrategy } from '@/types/ads';
import type { Json } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';

export function useAdCampaigns() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['ad-campaigns', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('ad_campaigns')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AdCampaign[];
    },
    enabled: !!currentTenant?.id,
  });

  const createCampaign = useMutation({
    mutationFn: async (input: {
      name: string;
      platform: AdPlatform;
      campaign_type: CampaignType;
      connection_id?: string;
      segment_id?: string;
      audience_type?: AudienceType;
      audience_config?: object;
      product_ids?: string[];
      category_ids?: string[];
      budget_type?: 'daily' | 'lifetime';
      budget_amount?: number;
      bid_strategy?: BidStrategy;
      target_roas?: number;
      start_date?: string;
      end_date?: string;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      const { data, error } = await supabase
        .from('ad_campaigns')
        .insert([{
          tenant_id: currentTenant.id,
          name: input.name,
          platform: input.platform,
          campaign_type: input.campaign_type,
          connection_id: input.connection_id,
          segment_id: input.segment_id,
          audience_type: input.audience_type,
          audience_config: input.audience_config as Json,
          product_ids: input.product_ids,
          category_ids: input.category_ids,
          budget_type: input.budget_type,
          budget_amount: input.budget_amount,
          bid_strategy: input.bid_strategy,
          target_roas: input.target_roas,
          start_date: input.start_date,
          end_date: input.end_date,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      toast({ title: 'Campagne aangemaakt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij aanmaken', description: error.message, variant: 'destructive' });
    }
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, name, status, budget_amount, budget_type, target_roas }: { 
      id: string; 
      name?: string;
      status?: AdCampaignStatus;
      budget_amount?: number;
      budget_type?: 'daily' | 'lifetime';
      target_roas?: number;
    }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (status !== undefined) updates.status = status;
      if (budget_amount !== undefined) updates.budget_amount = budget_amount;
      if (budget_type !== undefined) updates.budget_type = budget_type;
      if (target_roas !== undefined) updates.target_roas = target_roas;
      
      const { data, error } = await supabase
        .from('ad_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      toast({ title: 'Campagne bijgewerkt' });
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AdCampaignStatus }) => {
      const { error } = await supabase
        .from('ad_campaigns')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      toast({ title: 'Status bijgewerkt' });
    }
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ad_campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      toast({ title: 'Campagne verwijderd' });
    }
  });

  // Stats
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return {
    campaigns,
    isLoading,
    activeCampaigns,
    stats: {
      totalImpressions,
      totalClicks,
      totalSpend,
      totalRevenue,
      overallRoas,
    },
    createCampaign,
    updateCampaign,
    updateStatus,
    deleteCampaign,
  };
}
