import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Facebook, Instagram, Twitter, Linkedin, MessageCircle,
  Send, MessageSquare, Search, Image, Globe, Music, Camera,
  Settings, Unlink, Loader2, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MetaConnectWizard } from './MetaConnectWizard';
import { WhatsAppConnectWizard } from './WhatsAppConnectWizard';
import { ConnectSocialChannelDialog } from './ConnectSocialChannelDialog';
import { SocialChannelSettingsDialog } from './SocialChannelSettingsDialog';
import { useSocialChannels } from '@/hooks/useSocialChannels';
import { useSocialConnections } from '@/hooks/useSocialConnections';
import { useMetaMessagingConnections } from '@/hooks/useMetaMessagingConnections';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SocialChannelType } from '@/types/socialChannels';

interface ChannelConfig {
  id: string;
  name: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  status: 'available' | 'coming_soon';
  // Which wizard/dialog to use
  wizardType: 'meta' | 'whatsapp' | 'feed' | 'autopost' | 'none';
  feedChannelType?: SocialChannelType;
}

const CHANNELS: ChannelConfig[] = [
  {
    id: 'meta',
    name: 'Meta',
    subtitle: 'Facebook & Instagram',
    icon: Facebook,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    status: 'available',
    wizardType: 'meta',
  },
  {
    id: 'google_shopping',
    name: 'Google Shopping',
    icon: Search,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    status: 'available',
    wizardType: 'feed',
    feedChannelType: 'google_shopping',
  },
  {
    id: 'whatsapp_business',
    name: 'WhatsApp Business',
    icon: MessageCircle,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    status: 'available',
    wizardType: 'whatsapp',
  },
  {
    id: 'twitter',
    name: 'X / Twitter',
    icon: Twitter,
    iconColor: 'text-foreground',
    iconBg: 'bg-muted',
    status: 'available',
    wizardType: 'autopost',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: Image,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    status: 'available',
    wizardType: 'feed',
    feedChannelType: 'pinterest_catalog',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    iconColor: 'text-blue-700',
    iconBg: 'bg-blue-100',
    status: 'available',
    wizardType: 'autopost',
  },
  {
    id: 'microsoft_shopping',
    name: 'Microsoft Shopping',
    icon: Globe,
    iconColor: 'text-cyan-600',
    iconBg: 'bg-cyan-100',
    status: 'available',
    wizardType: 'feed',
    feedChannelType: 'microsoft_shopping',
  },
  {
    id: 'tiktok',
    name: 'TikTok Shop',
    icon: Music,
    iconColor: 'text-foreground',
    iconBg: 'bg-muted',
    status: 'coming_soon',
    wizardType: 'none',
  },
  {
    id: 'telegram',
    name: 'Telegram Business',
    icon: Send,
    iconColor: 'text-sky-600',
    iconBg: 'bg-sky-100',
    status: 'coming_soon',
    wizardType: 'none',
  },
  {
    id: 'live_chat',
    name: 'Live Chat Widget',
    icon: MessageSquare,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-100',
    status: 'coming_soon',
    wizardType: 'none',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    icon: Camera,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-100',
    status: 'coming_soon',
    wizardType: 'none',
  },
];

interface ActiveFeature {
  label: string;
  source: 'social_channel' | 'social_connection' | 'meta_messaging';
  connectionId: string;
}

export function UnifiedChannelList() {
  const { currentTenant } = useTenant();
  const { connections: socialChannels, deleteConnection: deleteSocialChannel, getConnectionByType } = useSocialChannels();
  const { connections: socialConnections, deleteConnection: deleteSocialConnection, getConnectionByPlatform: getAutopostConnection } = useSocialConnections();
  const { connections: metaConnections, deleteConnection: deleteMetaConnection, getConnectionByPlatform: getMetaConnection } = useMetaMessagingConnections();

  const [metaWizardOpen, setMetaWizardOpen] = useState(false);
  const [whatsappWizardOpen, setWhatsappWizardOpen] = useState(false);
  const [feedConnectType, setFeedConnectType] = useState<SocialChannelType | null>(null);
  const [settingsType, setSettingsType] = useState<SocialChannelType | null>(null);
  const [connectingAutopost, setConnectingAutopost] = useState<string | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<{
    channelId: string;
    features: ActiveFeature[];
  } | null>(null);

  // Get active features for a channel
  const getActiveFeatures = (channelId: string): ActiveFeature[] => {
    const features: ActiveFeature[] = [];

    switch (channelId) {
      case 'meta': {
        // Facebook/Instagram Shop
        const fbShop = getConnectionByType('facebook_shop');
        if (fbShop) features.push({ label: 'Facebook Shop', source: 'social_channel', connectionId: fbShop.id });
        const igShop = getConnectionByType('instagram_shop');
        if (igShop) features.push({ label: 'Instagram Shop', source: 'social_channel', connectionId: igShop.id });
        // Messenger / IG DMs
        const fbMsg = getMetaConnection('facebook');
        if (fbMsg) features.push({ label: 'Facebook Messenger', source: 'meta_messaging', connectionId: fbMsg.id });
        const igMsg = getMetaConnection('instagram');
        if (igMsg) features.push({ label: 'Instagram DM\'s', source: 'meta_messaging', connectionId: igMsg.id });
        // Autopost
        const autopost = getAutopostConnection('facebook');
        if (autopost) features.push({ label: 'Autopost', source: 'social_connection', connectionId: autopost.id });
        break;
      }
      case 'google_shopping': {
        const conn = getConnectionByType('google_shopping');
        if (conn) features.push({ label: 'Product feed', source: 'social_channel', connectionId: conn.id });
        break;
      }
      case 'whatsapp_business': {
        const conn = getConnectionByType('whatsapp_business');
        if (conn) features.push({ label: 'Inbox berichten', source: 'social_channel', connectionId: conn.id });
        break;
      }
      case 'twitter': {
        const conn = getAutopostConnection('twitter');
        if (conn) features.push({ label: 'Autopost', source: 'social_connection', connectionId: conn.id });
        break;
      }
      case 'pinterest': {
        const conn = getConnectionByType('pinterest_catalog');
        if (conn) features.push({ label: 'Product Pins', source: 'social_channel', connectionId: conn.id });
        break;
      }
      case 'linkedin': {
        const conn = getAutopostConnection('linkedin');
        if (conn) features.push({ label: 'Autopost', source: 'social_connection', connectionId: conn.id });
        break;
      }
      case 'microsoft_shopping': {
        const conn = getConnectionByType('microsoft_shopping');
        if (conn) features.push({ label: 'Product feed', source: 'social_channel', connectionId: conn.id });
        break;
      }
    }

    return features;
  };

  const handleConnect = async (channel: ChannelConfig) => {
    if (channel.status === 'coming_soon') return;

    switch (channel.wizardType) {
      case 'meta':
        setMetaWizardOpen(true);
        break;
      case 'whatsapp':
        setWhatsappWizardOpen(true);
        break;
      case 'feed':
        if (channel.feedChannelType) setFeedConnectType(channel.feedChannelType);
        break;
      case 'autopost':
        handleAutopostConnect(channel.id);
        break;
    }
  };

  const handleAutopostConnect = async (platform: string) => {
    if (!currentTenant?.id) return;
    setConnectingAutopost(platform);
    try {
      const { data, error } = await supabase.functions.invoke('social-oauth-init', {
        body: {
          platform,
          tenantId: currentTenant.id,
          redirectUrl: window.location.origin + '/admin/connect?tab=channels',
        },
      });
      if (error) {
        try {
          const errorBody = await error.context?.json?.();
          if (errorBody?.missingConfig) {
            toast.error(`${platform} API credentials niet geconfigureerd. Configureer eerst je credentials.`, { duration: 6000 });
            return;
          }
        } catch {}
        throw error;
      }
      if (data?.authUrl) {
        sessionStorage.setItem('social_oauth_state', data.state);
        sessionStorage.setItem('social_oauth_platform', platform);
        window.location.href = data.authUrl;
      }
    } catch (err: any) {
      toast.error('Kon niet verbinden: ' + (err.message || 'Onbekende fout'));
    } finally {
      setConnectingAutopost(null);
    }
  };

  const handleDisconnectAll = async () => {
    if (!disconnectDialog) return;
    try {
      for (const feature of disconnectDialog.features) {
        switch (feature.source) {
          case 'social_channel':
            await deleteSocialChannel.mutateAsync(feature.connectionId);
            break;
          case 'social_connection':
            await deleteSocialConnection.mutateAsync(feature.connectionId);
            break;
          case 'meta_messaging':
            await deleteMetaConnection.mutateAsync(feature.connectionId);
            break;
        }
      }
      setDisconnectDialog(null);
    } catch {
      // Errors handled by mutations
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const features = getActiveFeatures(channel.id);
          const isConnected = features.length > 0;
          const isComingSoon = channel.status === 'coming_soon';
          const isLoading = connectingAutopost === channel.id;

          return (
            <Card key={channel.id} className={cn('relative', isComingSoon && 'opacity-60')}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', channel.iconBg)}>
                    <Icon className={cn('w-5 h-5', channel.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{channel.name}</h3>
                      {isComingSoon && (
                        <Badge variant="secondary" className="text-xs">Binnenkort</Badge>
                      )}
                      {isConnected && (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Actief
                        </Badge>
                      )}
                    </div>
                    {channel.subtitle && (
                      <p className="text-xs text-muted-foreground">{channel.subtitle}</p>
                    )}
                  </div>
                </div>

                {/* Active features list */}
                {isConnected && (
                  <div className="mb-3 space-y-1">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                        <span>{f.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {isComingSoon ? (
                    <Button variant="outline" size="sm" disabled className="w-full">
                      Binnenkort beschikbaar
                    </Button>
                  ) : isConnected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleConnect(channel)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Instellingen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDisconnectDialog({ channelId: channel.id, features })}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleConnect(channel)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Verbinden...
                        </>
                      ) : (
                        'Verbinden'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Meta Connect Wizard */}
      <MetaConnectWizard
        open={metaWizardOpen}
        onOpenChange={setMetaWizardOpen}
      />

      {/* WhatsApp Connect Wizard */}
      <WhatsAppConnectWizard
        open={whatsappWizardOpen}
        onOpenChange={setWhatsappWizardOpen}
        onSuccess={() => setWhatsappWizardOpen(false)}
      />

      {/* Feed-based channel dialog */}
      {feedConnectType && (
        <ConnectSocialChannelDialog
          open={!!feedConnectType}
          onOpenChange={(open) => !open && setFeedConnectType(null)}
          channelType={feedConnectType}
        />
      )}

      {/* Settings dialog for feed channels */}
      {settingsType && (
        <SocialChannelSettingsDialog
          open={!!settingsType}
          onOpenChange={(open) => !open && setSettingsType(null)}
          channelType={settingsType}
          connection={getConnectionByType(settingsType)}
        />
      )}

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectDialog} onOpenChange={(open) => !open && setDisconnectDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kanaal verbreken?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert alle verbindingen voor dit kanaal. De volgende functies worden uitgeschakeld:
              <ul className="mt-2 space-y-1">
                {disconnectDialog?.features.map((f, i) => (
                  <li key={i} className="text-sm">• {f.label}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnectAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verbreek kanaal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
