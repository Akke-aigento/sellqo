import { useState } from 'react';
import { Link2, Loader2, RefreshCw, CheckCircle2, AlertCircle, ShoppingBag, Search, Facebook, Instagram, Music, Image, MessageCircle, Globe, Camera } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSocialChannels } from '@/hooks/useSocialChannels';
import { SOCIAL_CHANNEL_INFO, type SocialChannelType } from '@/types/socialChannels';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product';

// Icon mapping for social channels
const CHANNEL_ICONS: Record<SocialChannelType, React.ComponentType<{ className?: string }>> = {
  google_shopping: Search,
  facebook_shop: Facebook,
  instagram_shop: Instagram,
  tiktok_shop: Music,
  pinterest_catalog: Image,
  whatsapp_business: MessageCircle,
  microsoft_shopping: Globe,
  snapchat_catalog: Camera,
};

interface ProductSocialChannelsProps {
  product: Product;
  onRefresh?: () => void;
}

interface ProductSocialChannelSettings {
  [channelType: string]: {
    enabled: boolean;
    lastSyncedAt?: string;
    syncStatus?: 'pending' | 'synced' | 'error';
  };
}

export function ProductSocialChannels({ product, onRefresh }: ProductSocialChannelsProps) {
  const { activeConnections, isLoading: connectionsLoading } = useSocialChannels();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  // Parse social_channels from product JSONB
  const socialChannels: ProductSocialChannelSettings = (product as any).social_channels || {};

  const toggleChannel = async (channelType: string, enabled: boolean) => {
    const updatedChannels = {
      ...socialChannels,
      [channelType]: {
        ...socialChannels[channelType],
        enabled,
      },
    };

    const { error } = await supabase
      .from('products')
      .update({ 
        social_channels: updatedChannels,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id);

    if (error) {
      toast({
        title: 'Fout',
        description: 'Kon kanaal niet updaten',
        variant: 'destructive',
      });
    } else {
      const info = SOCIAL_CHANNEL_INFO[channelType as SocialChannelType];
      toast({
        title: enabled ? 'Kanaal geactiveerd' : 'Kanaal gedeactiveerd',
        description: info?.name || channelType,
      });
      onRefresh?.();
    }
  };

  const syncChannel = async (channelType: string, connectionId: string) => {
    setIsSyncing(channelType);
    
    try {
      // Determine which edge function to call based on channel type
      const isMeta = ['facebook_shop', 'instagram_shop', 'whatsapp_business'].includes(channelType);
      
      if (isMeta) {
        const { error } = await supabase.functions.invoke('sync-meta-catalog', {
          body: {
            connectionId,
            productIds: [product.id],
            operation: 'sync',
          },
        });
        
        if (error) throw error;
      } else {
        // For other channels (Google Shopping, etc.) - placeholder for future implementation
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: 'Sync gestart',
        description: 'Product wordt gesynchroniseerd naar het kanaal',
      });
      
      onRefresh?.();
    } catch (error: any) {
      toast({
        title: 'Sync mislukt',
        description: error.message || 'Kon product niet synchroniseren',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(null);
    }
  };

  const syncAllChannels = async () => {
    setIsBulkSyncing(true);
    
    const enabledChannels = activeConnections.filter(conn => 
      socialChannels[conn.channel_type]?.enabled
    );

    for (const conn of enabledChannels) {
      await syncChannel(conn.channel_type, conn.id);
    }
    
    setIsBulkSyncing(false);
  };

  // Show loading state
  if (connectionsLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No connected social channels
  if (activeConnections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Social Commerce
          </CardTitle>
          <CardDescription>
            Verkoop dit product via social media shops
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">
              Geen social commerce kanalen verbonden
            </p>
            <Button variant="outline" asChild>
              <a href="/admin/connect">
                <Link2 className="h-4 w-4 mr-2" />
                Naar SellQo Connect
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabledCount = Object.values(socialChannels).filter(c => c.enabled).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Social Commerce
            </CardTitle>
            <CardDescription>
              Selecteer op welke sociale kanalen dit product beschikbaar is
            </CardDescription>
          </div>
          {enabledCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={syncAllChannels}
              disabled={isBulkSyncing}
            >
              {isBulkSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync Alles ({enabledCount})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {activeConnections.map((connection) => {
            const info = SOCIAL_CHANNEL_INFO[connection.channel_type];
            if (!info) return null;

            const channelSettings = socialChannels[connection.channel_type];
            const isEnabled = channelSettings?.enabled ?? false;
            const syncStatus = channelSettings?.syncStatus;
            const Icon = CHANNEL_ICONS[connection.channel_type];

            return (
              <div
                key={connection.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border',
                  isEnabled && 'border-primary/30 bg-primary/5',
                )}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`channel-${connection.id}`}
                    checked={isEnabled}
                    onCheckedChange={(checked) => toggleChannel(connection.channel_type, checked === true)}
                  />
                  <div className={cn('p-2 rounded-lg', info.bgColor)}>
                    <Icon className={cn('h-4 w-4', info.color)} />
                  </div>
                  <div>
                    <label 
                      htmlFor={`channel-${connection.id}`}
                      className="font-medium cursor-pointer"
                    >
                      {info.name}
                    </label>
                    <div className="flex items-center gap-2 mt-0.5">
                      {connection.channel_name && (
                        <span className="text-xs text-muted-foreground">
                          {connection.channel_name}
                        </span>
                      )}
                      {isEnabled && syncStatus === 'synced' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Gesynchroniseerd
                        </Badge>
                      )}
                      {isEnabled && syncStatus === 'error' && (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Fout
                        </Badge>
                      )}
                      {isEnabled && syncStatus === 'pending' && (
                        <Badge variant="secondary" className="text-xs">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {isEnabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => syncChannel(connection.channel_type, connection.id)}
                    disabled={isSyncing === connection.channel_type}
                  >
                    {isSyncing === connection.channel_type ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Geselecteerde producten worden automatisch gesynchroniseerd naar de gekoppelde catalogi. 
            <a href="/admin/connect" className="text-primary hover:underline ml-1">
              Beheer koppelingen →
            </a>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
