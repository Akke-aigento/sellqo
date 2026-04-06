import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { useAdPlatforms } from '@/hooks/useAdPlatforms';
import { AD_PLATFORMS, type AdPlatform } from '@/types/ads';
import { TrendingUp, MousePointer, Eye, DollarSign, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CampaignCard } from './CampaignCard';

interface AdsDashboardProps {
  onNewCampaign?: () => void;
}

export function AdsDashboard({ onNewCampaign }: AdsDashboardProps) {
  const { campaigns, isLoading: campaignsLoading, stats, activeCampaigns } = useAdCampaigns();
  const { connectedPlatforms, isLoading: platformsLoading } = useAdPlatforms();

  const isLoading = campaignsLoading || platformsLoading;
  const hasData = campaigns.length > 0 && (stats.totalImpressions > 0 || stats.totalSpend > 0);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connectedPlatforms.length === 0 ? (
            <Badge variant="outline" className="text-muted-foreground">
              Nog geen platforms gekoppeld
            </Badge>
          ) : (
            <Badge variant="secondary">
              {connectedPlatforms.length} platform{connectedPlatforms.length !== 1 ? 's' : ''} actief
            </Badge>
          )}
        </div>
        {onNewCampaign && (
          <Button onClick={onNewCampaign}>
            Nieuwe Campagne
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bereik</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasData ? formatNumber(stats.totalImpressions) : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasData ? 'impressies afgelopen 30 dagen' : 'Nog geen data beschikbaar'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clicks</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasData ? formatNumber(stats.totalClicks) : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasData 
                ? `CTR: ${stats.totalImpressions > 0 
                    ? ((stats.totalClicks / stats.totalImpressions) * 100).toFixed(2) 
                    : 0}%`
                : 'Nog geen data beschikbaar'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Uitgaven</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasData ? formatCurrency(stats.totalSpend) : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasData ? 'totaal deze periode' : 'Nog geen data beschikbaar'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ROAS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasData ? `${stats.overallRoas.toFixed(1)}x` : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasData ? `omzet: ${formatCurrency(stats.totalRevenue)}` : 'Nog geen data beschikbaar'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connected Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gekoppelde Platforms</CardTitle>
          <CardDescription>Status van je advertentie-accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(AD_PLATFORMS) as AdPlatform[]).map(platform => {
              const info = AD_PLATFORMS[platform];
              const connection = connectedPlatforms.find(c => c.platform === platform);
              const campaignCount = campaigns.filter(c => c.platform === platform).length;
              
              return (
                <div
                  key={platform}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    connection ? 'bg-card' : 'bg-muted/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                    connection ? info.color : 'bg-muted'
                  }`}>
                    {info.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{info.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {connection 
                        ? `${campaignCount} campagne${campaignCount !== 1 ? 's' : ''}`
                        : 'Niet gekoppeld'
                      }
                    </p>
                  </div>
                  {connection && (
                    <Badge variant="secondary" className="shrink-0">
                      <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                      Actief
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Campaigns */}
      {activeCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actieve Campagnes</CardTitle>
            <CardDescription>Je lopende advertentiecampagnes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeCampaigns.slice(0, 5).map(campaign => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
              {activeCampaigns.length > 5 && (
                <Button variant="ghost" className="w-full" asChild>
                  <Link to="/admin/ads?tab=campaigns">
                    Bekijk alle {activeCampaigns.length} campagnes
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Suggestions — Beta label */}
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Suggesties</CardTitle>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
          <CardDescription>
            Slimme campagne-aanbevelingen op basis van je verkoopdata — binnenkort beschikbaar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            AI-suggesties worden automatisch gegenereerd zodra je actieve campagnes met prestatiedata hebt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
