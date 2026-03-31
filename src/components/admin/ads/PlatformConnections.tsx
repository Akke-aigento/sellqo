import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAdPlatforms } from '@/hooks/useAdPlatforms';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { AD_PLATFORMS, type AdPlatform } from '@/types/ads';
import { Link2, Unlink, Info, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function PlatformConnections() {
  const { 
    connections, 
    isLoading, 
    connectPlatform, 
    disconnectPlatform, 
    isConnected,
    hasBolRetailerConnection,
    getBolRetailerConnection,
    hasBolAdvertisingCredentials,
    getPlatformStatus,
  } = useAdPlatforms();
  const { campaigns } = useAdCampaigns();
  const [connecting, setConnecting] = useState<AdPlatform | null>(null);

  const handleConnect = async (platform: AdPlatform) => {
    const status = getPlatformStatus(platform);
    
    if (status === 'requires_connection') {
      toast({
        title: 'Retailer koppeling vereist',
        description: 'Koppel eerst je Bol.com account in SellQo Connect.',
      });
      return;
    }
    
    if (status === 'requires_advertising_credentials') {
      toast({
        title: 'Advertising API vereist',
        description: 'Voeg de Bol.com Advertising API credentials toe in SellQo Connect.',
      });
      return;
    }
    
    if (status === 'coming_soon') {
      toast({
        title: 'Binnenkort beschikbaar',
        description: `${AD_PLATFORMS[platform].name} koppeling komt binnenkort.`,
      });
      return;
    }

    setConnecting(platform);
    
    if (platform === 'bol_ads') {
      try {
        const bolConnection = getBolRetailerConnection();
        await connectPlatform.mutateAsync({
          platform,
          account_name: 'Bol.com Advertenties',
          account_id: bolConnection?.id,
          config: { 
            uses_retailer_api: true,
            retailer_connection_id: bolConnection?.id 
          }
        });
      } catch (error) {
        // Error handled in hook
      }
    }
    
    setConnecting(null);
  };

  const handleDisconnect = async (platform: AdPlatform) => {
    if (confirm(`Weet je zeker dat je ${AD_PLATFORMS[platform].name} wilt ontkoppelen?`)) {
      await disconnectPlatform.mutateAsync(platform);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 w-32 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const renderPlatformCard = (platform: AdPlatform) => {
    const info = AD_PLATFORMS[platform];
    const connection = connections.find(c => c.platform === platform && c.is_active);
    const campaignCount = campaigns.filter(c => c.platform === platform).length;
    const isConnecting = connecting === platform;
    const status = getPlatformStatus(platform);
    const isComingSoon = status === 'coming_soon';
    const requiresConnection = status === 'requires_connection';
    const requiresAdvertisingCredentials = status === 'requires_advertising_credentials';

    return (
      <Card key={platform} className={connection ? 'border-primary/50' : ''}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${info.color}`}>
                {info.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{info.name}</CardTitle>
                <CardDescription>{info.description}</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {connection && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Gekoppeld
                </Badge>
              )}
              {isComingSoon && !connection && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Binnenkort
                </Badge>
              )}
              {(requiresConnection || requiresAdvertisingCredentials) && !connection && (
                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
                  <AlertTriangle className="h-3 w-3" />
                  Actie vereist
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connection ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium">{connection.account_name || connection.account_id || 'Gekoppeld'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Campagnes</span>
                <span className="font-medium">{campaignCount}</span>
              </div>
              {connection.last_sync_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Laatste sync</span>
                  <span className="font-medium">
                    {new Date(connection.last_sync_at).toLocaleDateString('nl-NL')}
                  </span>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleDisconnect(platform)}
                  className="text-destructive"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Ontkoppelen
                </Button>
              </div>
            </div>
          ) : (
          <div className="space-y-4">
              {requiresConnection && platform === 'bol_ads' && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Om Bol.com Ads te gebruiken moet je eerst je Bol.com Retailer account koppelen.
                  </AlertDescription>
                </Alert>
              )}

              {requiresAdvertisingCredentials && platform === 'bol_ads' && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Voeg de Bol.com Advertising API credentials toe aan je bestaande koppeling.
                  </AlertDescription>
                </Alert>
              )}
              
              {!requiresConnection && !requiresAdvertisingCredentials && (
                <p className="text-sm text-muted-foreground">
                  {platform === 'bol_ads' 
                    ? 'Gebruik je bestaande Bol.com Retailer API koppeling voor advertenties.'
                    : platform === 'meta_ads'
                    ? 'Koppel je Facebook Business Manager account om te adverteren op Facebook en Instagram.'
                    : platform === 'google_ads'
                    ? 'Verbind je Google Ads account voor Shopping, Search en Display campagnes.'
                    : 'Koppel je Amazon Seller Central account voor Sponsored Products.'}
                </p>
              )}
              
              {(requiresConnection || requiresAdvertisingCredentials) ? (
                <Button asChild className="w-full">
                  <Link to="/admin/connect?tab=marketplace">
                    <Link2 className="h-4 w-4 mr-2" />
                    {requiresAdvertisingCredentials ? 'Advertising API toevoegen' : 'Ga naar SellQo Connect'}
                  </Link>
                </Button>
              ) : isComingSoon ? (
                <Button 
                  className="w-full"
                  disabled
                  variant="secondary"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Binnenkort beschikbaar
                </Button>
              ) : (
                <Button 
                  className="w-full"
                  onClick={() => handleConnect(platform)}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    'Verbinden...'
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      {platform === 'bol_ads' ? 'Activeren' : 'Koppelen'}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Koppel je advertentie-accounts om campagnes direct vanuit SellQo te beheren. 
          Je advertentiebudget wordt rechtstreeks via je eigen account afgerekend.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(AD_PLATFORMS) as AdPlatform[]).map(renderPlatformCard)}
      </div>
    </div>
  );
}
