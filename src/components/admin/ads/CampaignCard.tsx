import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { AD_PLATFORMS, type AdCampaign, type AdCampaignStatus } from '@/types/ads';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { MoreHorizontal, Pause, Play, Trash2, Edit, Upload, RefreshCw, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCan } from '@/hooks/useCan';
import { useTranslation } from 'react-i18next';

interface CampaignCardProps {
  campaign: AdCampaign;
  onEdit?: (campaign: AdCampaign) => void;
}

// Labels staan als i18n-key; de sleutel blijft de AdCampaignStatus-enumwaarde.
const STATUS_CONFIG: Record<AdCampaignStatus, { labelKey: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { labelKey: 'admin.ads.campaignCard.status.draft', variant: 'outline' },
  pending_approval: { labelKey: 'admin.ads.campaignCard.status.pending_approval', variant: 'secondary' },
  active: { labelKey: 'admin.ads.campaignCard.status.active', variant: 'default' },
  paused: { labelKey: 'admin.ads.campaignCard.status.paused', variant: 'secondary' },
  ended: { labelKey: 'admin.ads.campaignCard.status.ended', variant: 'outline' },
  rejected: { labelKey: 'admin.ads.campaignCard.status.rejected', variant: 'destructive' },
};

export function CampaignCard({ campaign, onEdit }: CampaignCardProps) {
  const { t } = useTranslation();
  const { updateStatus, deleteCampaign } = useAdCampaigns();
  const queryClient = useQueryClient();
  // H4d: row-action gating in dropdown — hide voor non-write rollen.
  // matrix: ads write = tenant_admin + marketing (edit/pause/duplicate);
  // delete blijft impliciet ook write — geen aparte resource.
  const canWriteAds = useCan('write', 'ads');
  const [pushing, setPushing] = useState(false);
  const [pushStep, setPushStep] = useState('');
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const platformInfo = AD_PLATFORMS[campaign.platform];
  const statusConfig = STATUS_CONFIG[campaign.status as AdCampaignStatus] || STATUS_CONFIG.draft;

  const isBol = campaign.platform === 'bol_ads';
  const notPushed = isBol && !campaign.platform_campaign_id;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handlePause = () => {
    updateStatus.mutate({ id: campaign.id, status: 'paused' });
  };

  const handleActivate = () => {
    updateStatus.mutate({ id: campaign.id, status: 'active' });
  };

  const handleDelete = () => {
    if (confirm('Weet je zeker dat je deze campagne wilt verwijderen?')) {
      deleteCampaign.mutate(campaign.id);
    }
  };

  const startStepSimulation = () => {
    setPushStep('Verbinden met Bol.com...');
    const t1 = setTimeout(() => setPushStep('Campagne aanmaken...'), 5000);
    const t2 = setTimeout(() => setPushStep('Producten toevoegen...'), 15000);
    const t3 = setTimeout(() => setPushStep('Bijna klaar...'), 25000);
    stepTimerRef.current = t1 as unknown as NodeJS.Timeout;
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  };

  const handlePushToBol = async () => {
    setPushing(true);
    const cleanup = startStepSimulation();
    try {
      toast({ title: t('admin.ads.campaignCard.synchroniseren_met_bol_com_2'), description: t('admin.ads.campaignCard.dit_kan_20_30_seconden_duren') });
      const { data, error } = await supabase.functions.invoke('push-bol-campaign', {
        body: { campaign_id: campaign.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: t('admin.ads.campaignCard.campagne_live_op_bol_com'), description: t('admin.ads.campaignCard.producten_toegevoegd', { count: data.eans_targeted?.length || 0 }) });
        queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      } else {
        toast({ title: t('admin.ads.campaignCard.push_gestart'), description: data?.message || 'Status wordt verwerkt' });
      }
    } catch (e: any) {
      toast({ title: t('admin.ads.campaignCard.push_mislukt'), description: e.message, variant: 'destructive' });
    } finally {
      cleanup();
      setPushing(false);
      setPushStep('');
    }
  };

  const handleRepushToBol = async () => {
    setPushing(true);
    setPushStep('Producten opnieuw synchroniseren...');
    const t1 = setTimeout(() => setPushStep('Ad groups bijwerken...'), 5000);
    const t2 = setTimeout(() => setPushStep('Producten toevoegen...'), 12000);
    try {
      toast({ title: t('admin.ads.campaignCard.opnieuw_synchroniseren_met_bol_com'), description: t('admin.ads.campaignCard.dit_kan_15_20_seconden_duren') });
      const { data, error } = await supabase.functions.invoke('push-bol-campaign', {
        body: { campaign_id: campaign.id, force_repush: true },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: t('admin.ads.campaignCard.campagne_bijgewerkt_op_bol_com'), description: t('admin.ads.campaignCard.producten_gesynchroniseerd', { count: data.eans_targeted?.length || 0 }) });
        queryClient.invalidateQueries({ queryKey: ['ad-campaigns'] });
      } else {
        toast({ title: t('admin.ads.campaignCard.update_gestart'), description: data?.message || 'Status wordt verwerkt' });
      }
    } catch (e: any) {
      toast({ title: t('admin.ads.campaignCard.update_mislukt'), description: e.message, variant: 'destructive' });
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setPushing(false);
      setPushStep('');
    }
  };

  return (
    <div className={`relative flex items-center gap-4 p-4 rounded-lg border bg-card transition-colors ${pushing ? 'border-primary/50 animate-pulse' : 'hover:bg-muted/30'}`}>
      {/* Push overlay */}
      {pushing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-background/70 backdrop-blur-[2px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
          <p className="text-sm font-medium">{t('admin.ads.campaignCard.synchroniseren_met_bol_com')}</p>
          {pushStep && <p className="text-xs text-muted-foreground mt-1">{pushStep}</p>}
        </div>
      )}
      {/* Platform Icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${platformInfo.color}`}>
        {platformInfo.icon}
      </div>

      {/* Campaign Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{campaign.name}</h4>
          <Badge variant={statusConfig.variant} className="shrink-0">
            {t(statusConfig.labelKey)}
          </Badge>
          {isBol && campaign.platform_campaign_id && (
            <Badge variant="outline" className="shrink-0 text-xs">
              Bol ID: {campaign.platform_campaign_id}
            </Badge>
          )}
          {notPushed && (
            <Badge variant="destructive" className="shrink-0 text-xs">
              {t('admin.ads.campaignCard.niet_gepusht')}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {platformInfo.name} • {campaign.campaign_type.replace(/_/g, ' ')}
          {campaign.platform_status && (
            <span className="ml-2 text-xs">({campaign.platform_status})</span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-6 text-sm">
        <div className="text-center">
          <p className="font-medium">{formatNumber(campaign.impressions)}</p>
          <p className="text-xs text-muted-foreground">{t('admin.ads.campaignCard.bereik')}</p>
        </div>
        <div className="text-center">
          <p className="font-medium">{formatNumber(campaign.clicks)}</p>
          <p className="text-xs text-muted-foreground">{t('admin.ads.campaignCard.clicks')}</p>
        </div>
        <div className="text-center">
          <p className="font-medium">{formatCurrency(campaign.spend)}</p>
          <p className="text-xs text-muted-foreground">{t('admin.ads.campaignCard.uitgaven')}</p>
        </div>
        <div className="text-center">
          <p className="font-medium">{campaign.roas?.toFixed(1) || '-'}x</p>
          <p className="text-xs text-muted-foreground">ROAS</p>
        </div>
      </div>

      {/* Budget */}
      {campaign.budget_amount && (
        <div className="hidden lg:block text-right">
          <p className="font-medium">{formatCurrency(campaign.budget_amount)}</p>
          <p className="text-xs text-muted-foreground">
            {campaign.budget_type === 'daily' ? '/dag' : 'totaal'}
          </p>
        </div>
      )}

      {/* Push to Bol button for unpushed campaigns */}
      {notPushed && (
        <Button
          variant="outline"
          size="sm"
          onClick={handlePushToBol}
          disabled={pushing}
        >
          {pushing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          Push naar Bol
        </Button>
      )}

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canWriteAds && (
            <DropdownMenuItem onClick={() => onEdit?.(campaign)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('common.edit')}
            </DropdownMenuItem>
          )}
          {canWriteAds && notPushed && (
            <DropdownMenuItem onClick={handlePushToBol} disabled={pushing}>
              <Upload className="h-4 w-4 mr-2" />
              {t('admin.ads.campaignCard.push_naar_bol_com')}
            </DropdownMenuItem>
          )}
          {canWriteAds && isBol && campaign.platform_campaign_id && (
            <DropdownMenuItem onClick={handleRepushToBol} disabled={pushing}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('admin.ads.campaignCard.producten_opnieuw_pushen')}
            </DropdownMenuItem>
          )}
          {canWriteAds && <DropdownMenuSeparator />}
          {canWriteAds && campaign.status === 'active' ? (
            <DropdownMenuItem onClick={handlePause}>
              <Pause className="h-4 w-4 mr-2" />
              {t('admin.adsBolcomCampaignDetail.pauzeren')}
            </DropdownMenuItem>
          ) : canWriteAds && campaign.status === 'paused' ? (
            <DropdownMenuItem onClick={handleActivate}>
              <Play className="h-4 w-4 mr-2" />
              {t('admin.adsBolcomCampaignDetail.hervatten')}
            </DropdownMenuItem>
          ) : null}
          {canWriteAds && <DropdownMenuSeparator />}
          {canWriteAds && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              {t('common.delete')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
