import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import i18n from 'i18next';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import type { EmailCampaign, EmailCampaignInsert, EmailCampaignUpdate, CampaignSend, MarketingStats } from '@/types/marketing';

/** MAIL-1a: antwoord van send-campaign-batch in mode 'count'. */
export interface CampaignRecipientCount {
  recipients: number;
  limit: { monthly: number | null; used: number; remaining: number | null };
  sender_ok: boolean;
  /** MAIL-2d: plan van de A/B-test van het onderwerp (ontbreekt bij een oudere edge function). */
  ab?: {
    requested: boolean;
    enabled: boolean;
    reason: 'automation' | 'multi_language' | 'too_small' | null;
    percent: number;
    wait_hours: number;
    per_variant: number;
    remainder: number;
    min_audience: number;
  };
}

/** MAIL-2d: cijfers per variant (rpc campaign_ab_stats). 'rest' = wie het winnende onderwerp kreeg. */
export interface CampaignAbStat {
  variant: 'A' | 'B' | 'rest';
  recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  waiting: number;
}

export function useCampaignAbStats(campaignId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['campaign-ab-stats', campaignId],
    queryFn: async () => {
      // De RPC staat nog niet in de gegenereerde types (MAIL-2d).
      const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: CampaignAbStat[] | null; error: Error | null }>;
      const { data, error } = await rpc('campaign_ab_stats', { p_campaign_id: campaignId });
      if (error) throw error;
      return data || [];
    },
    enabled: !!campaignId && enabled,
    refetchInterval: 30_000,
  });
}

/** MAIL-1a: antwoord van send-campaign-batch bij "nu verzenden" (asynchroon). */
export interface CampaignSendResult {
  queued: number;
  total_recipients: number;
  /** MAIL-2d: reden waarom een gevraagde A/B-test niet doorging (bv. 'too_small'). */
  ab_skipped?: string | null;
}

/** Aantal ontvangers, planverbruik en afzenderstatus vóór het verzenden. */
export function countCampaignRecipients(campaignId: string): Promise<CampaignRecipientCount> {
  return invokeWithErrorBody<CampaignRecipientCount>(
    'send-campaign-batch',
    { body: { campaign_id: campaignId, mode: 'count' } },
    i18n.t('admin.marketing.toast.telling_mislukt'),
  );
}

/**
 * MAIL-2a: automatiseringen hebben elk een verborgen systeemcampagne (kind = 'automation').
 * Die horen niet in lijsten, tellingen of de detailpagina van campagnes. `kind` kan null zijn
 * op oudere rijen, dus filter op "null of niet 'automation'" in plaats van een kale neq.
 */
export const NOT_AUTOMATION_CAMPAIGN = 'kind.is.null,kind.neq.automation';

/** Ververs de lijst om de 10 seconden zolang er een campagne aan het verzenden is. */
const SENDING_POLL_MS = 10_000;

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
        .or(NOT_AUTOMATION_CAMPAIGN)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmailCampaign[];
    },
    enabled: !!currentTenant?.id,
    // MAIL-1a: verzenden loopt via een worker; volg de status tot hij 'sent' of 'failed' is.
    refetchInterval: (query) =>
      (query.state.data as EmailCampaign[] | undefined)?.some((c) => c.status === 'sending')
        ? SENDING_POLL_MS
        : false,
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
      toast({ title: i18n.t('admin.marketing.toast.campagne_aangemaakt') });
    },
    onError: (error: Error) => {
      toast({ title: i18n.t('admin.marketing.toast.fout_bij_aanmaken'), description: error.message, variant: 'destructive' });
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
      toast({ title: i18n.t('admin.marketing.toast.campagne_bijgewerkt') });
    },
    onError: (error: Error) => {
      toast({ title: i18n.t('admin.marketing.toast.fout_bij_bijwerken'), description: error.message, variant: 'destructive' });
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
      toast({ title: i18n.t('admin.marketing.toast.campagne_verwijderd') });
    },
    onError: (error: Error) => {
      toast({ title: i18n.t('admin.marketing.toast.fout_bij_verwijderen'), description: error.message, variant: 'destructive' });
    },
  });

  const sendCampaign = useMutation({
    mutationFn: (campaignId: string) =>
      invokeWithErrorBody<CampaignSendResult>(
        'send-campaign-batch',
        { body: { campaign_id: campaignId } },
        i18n.t('admin.marketing.toast.fout_bij_verzenden'),
      ),
    onSuccess: (result, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['email-campaign', campaignId] });
      toast({
        title: i18n.t('admin.marketing.toast.campagne_wordt_verstuurd', {
          count: result?.total_recipients ?? result?.queued ?? 0,
        }),
      });
      if (result?.ab_skipped) {
        toast({
          title: i18n.t('admin.marketing.abTest.skipped_title'),
          description: i18n.t(result.ab_skipped === 'too_small'
            ? 'admin.marketing.abTest.skipped_too_small'
            : 'admin.marketing.abTest.skipped_other'),
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: i18n.t('admin.marketing.toast.fout_bij_verzenden'), description: error.message, variant: 'destructive' });
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
    countRecipients: countCampaignRecipients,
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
        .or(NOT_AUTOMATION_CAMPAIGN)
        .maybeSingle();

      if (error) throw error;
      return data as EmailCampaign | null;
    },
    enabled: !!id,
    refetchInterval: (query) =>
      (query.state.data as EmailCampaign | null | undefined)?.status === 'sending' ? SENDING_POLL_MS : false,
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
        };
      }

      // Fetch campaign stats
      const { data: campaigns } = await supabase
        .from('email_campaigns')
        .select('total_sent, total_opened, total_clicked')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'sent')
        .or(NOT_AUTOMATION_CAMPAIGN);

      const campaignStats = campaigns || [];
      const totalCampaigns = campaignStats.length;
      const totalSent = campaignStats.reduce((sum, c) => sum + (c.total_sent || 0), 0);
      const totalOpened = campaignStats.reduce((sum, c) => sum + (c.total_opened || 0), 0);
      const totalClicked = campaignStats.reduce((sum, c) => sum + (c.total_clicked || 0), 0);

      // MAIL-UX-1: abonnees en uitschrijvingen komen niet meer hier vandaan maar uit
      // marketing_contact_counts (useMarketingContactCounts), dezelfde bron als het tabblad Abonnees.

      return {
        totalCampaigns,
        totalSent,
        totalOpened,
        totalClicked,
        avgOpenRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        avgClickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      };
    },
    enabled: !!currentTenant?.id,
  });
}
