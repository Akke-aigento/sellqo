import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { useAdPlatforms } from '@/hooks/useAdPlatforms';
import { AD_PLATFORMS, type AdPlatform, type AdCampaign } from '@/types/ads';
import { CampaignCard } from './CampaignCard';
import { CampaignWizard } from './CampaignWizard';
import { Plus, Search, Filter, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function CampaignsList() {
  const { t } = useTranslation();
  const { campaigns, isLoading } = useAdCampaigns();
  const { connectedPlatforms } = useAdPlatforms();
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<AdCampaign | null>(null);

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || campaign.platform === platformFilter;
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  const handleEdit = (campaign: AdCampaign) => {
    setEditingCampaign(campaign);
    setShowWizard(true);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setEditingCampaign(null);
  };

  if (showWizard) {
    return <CampaignWizard onClose={handleCloseWizard} campaign={editingCampaign} />;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('admin.ads.campaignsList.zoek_campagnes')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t('admin.marketing.contentHistoryList.platform')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.ads.campaignsList.alle_platforms')}</SelectItem>
            {(Object.keys(AD_PLATFORMS) as AdPlatform[]).map(platform => (
              <SelectItem key={platform} value={platform}>
                {AD_PLATFORMS[platform].icon} {AD_PLATFORMS[platform].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('common.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.marketing.contentHistoryList.alle_statussen')}</SelectItem>
            <SelectItem value="active">{t('admin.marketing.aBTestingPanel.actief')}</SelectItem>
            <SelectItem value="paused">{t('admin.marketing.campaignCard.status.gepauzeerd')}</SelectItem>
            <SelectItem value="draft">{t('admin.marketing.campaignCard.status.concept')}</SelectItem>
            <SelectItem value="ended">{t('admin.ads.campaignsList.beeindigd')}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.ads.campaignsList.nieuwe_campagne')}
        </Button>
      </div>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <div className="space-y-3">
          {filteredCampaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} onEdit={handleEdit} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">{t('admin.ads.campaignsList.geen_campagnes')}</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {connectedPlatforms.length === 0 
                ? t('admin.ads.campaignsList.koppel_eerst_een_advertentieplatform_om_campagnes') : t('admin.ads.campaignsList.maak_je_eerste_advertentiecampagne_om_meer')}
            </p>
            <Button onClick={() => setShowWizard(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.ads.campaignsList.eerste_campagne_maken')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">{t('common.noResults')}</h3>
            <p className="text-muted-foreground">
              {t('admin.ads.campaignsList.geen_campagnes_gevonden_met_de_huidige')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
