import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { EmailCampaign, EmailCampaignInsert, EmailCampaignUpdate, CampaignSend, MarketingStats } from '@/types/marketing';

export function useEmailCampaigns() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading, error } = useQuery({
    queryKey: ['email-campaigns', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('email_campaigns')
        .select(`
          *,
          segment:customer_segments(id, name, member_count),
          template:email_templates(id, name)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmailCampaign[];
    },
    enabled: !!currentTenant?.id,
  });

  const createCampaign = useMutation({
    mutationFn: async (campaign: EmailCampaignInsert) => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert(campaign)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campagne aangemaakt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij aanmaken', description: error.message, variant: 'destructive' });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: EmailCampaignUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campagne bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij bijwerken', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campagne verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });

  const sendCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await supabase.functions.invoke('send-campaign-batch', {
        body: { campaign_id: campaignId },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campagne wordt verzonden...' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij verzenden', description: error.message, variant: 'destructive' });
    },
  });

  return {
    campaigns,
    isLoading,
    error,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    sendCampaign,
  };
}

export function useEmailCampaign(id: string | undefined) {
  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ['email-campaign', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('email_campaigns')
        .select(`
          *,
          segment:customer_segments(id, name, member_count),
          template:email_templates(id, name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as EmailCampaign | null;
    },
    enabled: !!id,
  });

  return { campaign, isLoading, error };
}

export function useCampaignSends(campaignId: string | undefined) {
  const { data: sends = [], isLoading, error } = useQuery({
    queryKey: ['campaign-sends', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data as CampaignSend[];
    },
    enabled: !!campaignId,
  });

  return { sends, isLoading, error };
}

export function useMarketingStats() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['marketing-stats', currentTenant?.id],
    queryFn: async (): Promise<MarketingStats> => {
      if (!currentTenant?.id) {
        return {
          totalCampaigns: 0,
          totalSent: 0,
          totalOpened: 0,
          totalClicked: 0,
          avgOpenRate: 0,
          avgClickRate: 0,
          subscriberCount: 0,
          subscriberGrowth: 0,
          unsubscribeCount: 0,
        };
      }

      // Fetch campaign stats
      const { data: campaigns } = await supabase
        .from('email_campaigns')
        .select('total_sent, total_opened, total_clicked')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'sent');

      const campaignStats = campaigns || [];
      const totalCampaigns = campaignStats.length;
      const totalSent = campaignStats.reduce((sum, c) => sum + (c.total_sent || 0), 0);
      const totalOpened = campaignStats.reduce((sum, c) => sum + (c.total_opened || 0), 0);
      const totalClicked = campaignStats.reduce((sum, c) => sum + (c.total_clicked || 0), 0);

      // Fetch subscriber count
      const { count: subscriberCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('email_subscribed', true);

      // Fetch unsubscribe count
      const { count: unsubscribeCount } = await supabase
        .from('email_unsubscribes')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id);

      return {
        totalCampaigns,
        totalSent,
        totalOpened,
        totalClicked,
        avgOpenRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        avgClickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
        subscriberCount: subscriberCount || 0,
        subscriberGrowth: 0, // Would need historical data to calculate
        unsubscribeCount: unsubscribeCount || 0,
      };
    },
    enabled: !!currentTenant?.id,
  });
}
