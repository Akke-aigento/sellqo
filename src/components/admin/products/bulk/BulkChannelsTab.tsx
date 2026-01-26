import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSocialChannels } from '@/hooks/useSocialChannels';
import { SOCIAL_CHANNEL_INFO, type SocialChannelType } from '@/types/socialChannels';
import { Facebook, Instagram, ShoppingBag, MapPin, Send, ExternalLink, Globe, Camera, MessageCircle, Search, Image, Music } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BulkEditTabProps } from './BulkEditTypes';

const ICON_MAP: Record<string, React.ReactNode> = {
  Search: <Search className="h-4 w-4" />,
  Facebook: <Facebook className="h-4 w-4" />,
  Instagram: <Instagram className="h-4 w-4" />,
  Music: <Music className="h-4 w-4" />,
  Image: <Image className="h-4 w-4" />,
  MessageCircle: <MessageCircle className="h-4 w-4" />,
  Globe: <Globe className="h-4 w-4" />,
  Camera: <Camera className="h-4 w-4" />,
};

const MARKETPLACE_CONFIG: Record<string, { label: string }> = {
  bol_com: { label: 'Bol.com' },
  amazon: { label: 'Amazon' },
  shopify: { label: 'Shopify' },
  woocommerce: { label: 'WooCommerce' },
  odoo: { label: 'Odoo' },
};

export function BulkChannelsTab({ state, onChange, enabledFields, onToggleField }: BulkEditTabProps) {
  const { connections, isLoading } = useSocialChannels();

  const connectedSocialChannels = connections.filter(c => c.is_active);
  const socialChannelState = state.social_channels || {};
  const marketplaceState = state.sync_marketplaces || [];

  const toggleSocialChannel = (channelType: SocialChannelType) => {
    const newState = { ...socialChannelState };
    newState[channelType] = !newState[channelType];
    onChange({ social_channels: newState });
  };

  const toggleMarketplace = (marketplace: string) => {
    const newList = marketplaceState.includes(marketplace)
      ? marketplaceState.filter(m => m !== marketplace)
      : [...marketplaceState, marketplace];
    onChange({ sync_marketplaces: newList });
  };

  return (
    <div className="space-y-6">
      {/* Social Commerce kanalen */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-social-channels"
            checked={enabledFields.has('social_channels')}
            onCheckedChange={() => onToggleField('social_channels')}
          />
          <Label htmlFor="enable-social-channels" className="font-medium cursor-pointer">
            Social Commerce kanalen
          </Label>
        </div>
        {enabledFields.has('social_channels') && (
          <div className="pl-6 space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Laden...</p>
            ) : connectedSocialChannels.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                <p>Geen social channels verbonden.</p>
                <Button variant="link" asChild className="p-0 h-auto">
                  <Link to="/admin/connect?tab=social">
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Verbind kanalen in SellQo Connect
                  </Link>
                </Button>
              </div>
            ) : (
              connectedSocialChannels.map((channel) => {
                const info = SOCIAL_CHANNEL_INFO[channel.channel_type];
                const icon = info ? ICON_MAP[info.icon] : null;
                return (
                  <div key={channel.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`social-${channel.id}`}
                      checked={socialChannelState[channel.channel_type] || false}
                      onCheckedChange={() => toggleSocialChannel(channel.channel_type)}
                    />
                    <Label htmlFor={`social-${channel.id}`} className="flex items-center gap-2 cursor-pointer">
                      {icon}
                      {info?.name || channel.channel_type}
                    </Label>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Marketplace sync */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-marketplaces"
            checked={enabledFields.has('sync_marketplaces')}
            onCheckedChange={() => onToggleField('sync_marketplaces')}
          />
          <Label htmlFor="enable-marketplaces" className="font-medium cursor-pointer">
            Marketplace sync activeren
          </Label>
        </div>
        {enabledFields.has('sync_marketplaces') && (
          <div className="pl-6 space-y-2">
            {Object.entries(MARKETPLACE_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`marketplace-${key}`}
                  checked={marketplaceState.includes(key)}
                  onCheckedChange={() => toggleMarketplace(key)}
                />
                <Label htmlFor={`marketplace-${key}`} className="cursor-pointer">
                  {config.label}
                </Label>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">
              Geselecteerde producten worden klaargezet voor sync naar deze marketplaces.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
