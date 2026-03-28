import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { useAdPlatforms } from '@/hooks/useAdPlatforms';
import { AD_PLATFORMS, type AdPlatform, type AdCampaignStatus } from '@/types/ads';
import { CampaignCard } from './CampaignCard';
import { CampaignWizard } from './CampaignWizard';
import { Plus, Search, Filter, Target } from 'lucide-react';

export function CampaignsList() {
  const { campaigns, isLoading } = useAdCampaigns();
  const { connectedPlatforms } = useAdPlatforms();
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showWizard, setShowWizard] = useState(false);

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || campaign.platform === platformFilter;
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  if (showWizard) {
    return <CampaignWizard onClose={() => setShowWizard(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek campagnes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle platforms</SelectItem>
            {(Object.keys(AD_PLATFORMS) as AdPlatform[]).map(platform => (
              <SelectItem key={platform} value={platform}>
                {AD_PLATFORMS[platform].icon} {AD_PLATFORMS[platform].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="active">Actief</SelectItem>
            <SelectItem value="paused">Gepauzeerd</SelectItem>
            <SelectItem value="draft">Concept</SelectItem>
            <SelectItem value="ended">Beëindigd</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe Campagne
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
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">Geen campagnes</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {connectedPlatforms.length === 0 
                ? 'Koppel eerst een advertentieplatform om campagnes te kunnen maken.'
                : 'Maak je eerste advertentiecampagne om meer klanten te bereiken.'}
            </p>
            <Button onClick={() => setShowWizard(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Eerste Campagne Maken
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">Geen resultaten</h3>
            <p className="text-muted-foreground">
              Geen campagnes gevonden met de huidige filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
