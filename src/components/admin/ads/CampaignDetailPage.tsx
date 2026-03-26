import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, Pause, Play, Trash2, TrendingUp, Image, Package, Users } from 'lucide-react';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { AD_PLATFORMS, CAMPAIGN_TYPES, type AdCampaign, type AdCampaignStatus } from '@/types/ads';
import { CreativeManager } from './CreativeManager';
import { CampaignPerformanceChart } from './CampaignPerformanceChart';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const STATUS_CONFIG: Record<AdCampaignStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Concept', variant: 'outline' },
  pending_approval: { label: 'Wacht op goedkeuring', variant: 'secondary' },
  active: { label: 'Actief', variant: 'default' },
  paused: { label: 'Gepauzeerd', variant: 'secondary' },
  ended: { label: 'Beëindigd', variant: 'outline' },
  rejected: { label: 'Afgewezen', variant: 'destructive' },
};

interface CampaignDetailPageProps {
  campaignId: string;
  onBack: () => void;
}

export function CampaignDetailPage({ campaignId, onBack }: CampaignDetailPageProps) {
  const { campaigns, updateStatus, deleteCampaign } = useAdCampaigns();
  const campaign = campaigns.find(c => c.id === campaignId);

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Campagne niet gevonden</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Button>
      </div>
    );
  }

  const platformInfo = AD_PLATFORMS[campaign.platform];
  const statusConfig = STATUS_CONFIG[campaign.status as AdCampaignStatus] || STATUS_CONFIG.draft;
  const campaignTypeInfo = CAMPAIGN_TYPES[campaign.campaign_type as keyof typeof CAMPAIGN_TYPES];

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : '0';
  const cpc = campaign.clicks > 0 ? (campaign.spend / campaign.clicks).toFixed(2) : '0';
  const convRate = campaign.clicks > 0 ? ((campaign.conversions / campaign.clicks) * 100).toFixed(2) : '0';

  const handleDelete = () => {
    if (confirm('Weet je zeker dat je deze campagne wilt verwijderen?')) {
      deleteCampaign.mutate(campaign.id, { onSuccess: onBack });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${platformInfo.color}`}>
            {platformInfo.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
            <p className="text-muted-foreground">
              {platformInfo.name} • {campaignTypeInfo?.name || campaign.campaign_type}
              {campaign.start_date && ` • ${format(new Date(campaign.start_date), 'dd MMM yyyy', { locale: nl })}`}
              {campaign.end_date && ` - ${format(new Date(campaign.end_date), 'dd MMM yyyy', { locale: nl })}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'active' && (
            <Button variant="outline" onClick={() => updateStatus.mutate({ id: campaign.id, status: 'paused' })}>
              <Pause className="h-4 w-4 mr-2" />
              Pauzeren
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button variant="outline" onClick={() => updateStatus.mutate({ id: campaign.id, status: 'active' })}>
              <Play className="h-4 w-4 mr-2" />
              Hervatten
            </Button>
          )}
          <Button variant="destructive" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: 'Bereik', value: formatNumber(campaign.impressions) },
          { label: 'Clicks', value: formatNumber(campaign.clicks) },
          { label: 'CTR', value: `${ctr}%` },
          { label: 'CPC', value: `€${cpc}` },
          { label: 'Uitgaven', value: formatCurrency(campaign.spend) },
          { label: 'Conversies', value: formatNumber(campaign.conversions) },
          { label: 'ROAS', value: `${campaign.roas?.toFixed(1) || '0'}x` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overzicht
          </TabsTrigger>
          <TabsTrigger value="creatives">
            <Image className="h-4 w-4 mr-2" />
            Creatives
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-2" />
            Producten
          </TabsTrigger>
          <TabsTrigger value="audience">
            <Users className="h-4 w-4 mr-2" />
            Doelgroep
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campagne Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Budget</dt>
                    <dd className="font-medium">
                      {campaign.budget_amount ? formatCurrency(campaign.budget_amount) : '-'}
                      {campaign.budget_type === 'daily' ? ' /dag' : ' totaal'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Biedstrategie</dt>
                    <dd className="font-medium capitalize">{campaign.bid_strategy?.replace(/_/g, ' ') || 'Auto'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Doel ROAS</dt>
                    <dd className="font-medium">{campaign.target_roas || '-'}x</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Conversieratio</dt>
                    <dd className="font-medium">{convRate}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Omzet</dt>
                    <dd className="font-medium">{formatCurrency(campaign.revenue)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tijdlijn</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Aangemaakt</dt>
                    <dd className="font-medium">{format(new Date(campaign.created_at), 'dd MMM yyyy HH:mm', { locale: nl })}</dd>
                  </div>
                  {campaign.start_date && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Startdatum</dt>
                      <dd className="font-medium">{format(new Date(campaign.start_date), 'dd MMM yyyy', { locale: nl })}</dd>
                    </div>
                  )}
                  {campaign.end_date && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Einddatum</dt>
                      <dd className="font-medium">{format(new Date(campaign.end_date), 'dd MMM yyyy', { locale: nl })}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="creatives" className="mt-6">
          <CreativeManager campaignId={campaign.id} />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gekoppelde Producten</CardTitle>
              <CardDescription>
                {campaign.product_ids?.length 
                  ? `${campaign.product_ids.length} product(en) geselecteerd`
                  : 'Geen producten gekoppeld aan deze campagne'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaign.product_ids && campaign.product_ids.length > 0 ? (
                <div className="space-y-2">
                  {campaign.product_ids.map(id => (
                    <div key={id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono">{id}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Voeg producten toe via de campagne-wizard om ze hier te tonen.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Doelgroep</CardTitle>
              <CardDescription>
                {campaign.segment_id 
                  ? 'Gekoppeld aan klantsegment' 
                  : campaign.audience_type 
                  ? `Type: ${campaign.audience_type}` 
                  : 'Geen specifieke doelgroep ingesteld'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {campaign.audience_type && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="font-medium capitalize">{campaign.audience_type}</dd>
                  </div>
                )}
                {campaign.segment_id && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Segment ID</dt>
                    <dd className="font-medium font-mono text-xs">{campaign.segment_id}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
