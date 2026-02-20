import { useState } from 'react';
import { Facebook, Instagram, MessageCircle, Send, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { WhatsAppConnectWizard } from './WhatsAppConnectWizard';
import { useMetaMessagingConnections } from '@/hooks/useMetaMessagingConnections';
import { useSocialChannels } from '@/hooks/useSocialChannels';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MessagingChannel {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  status: 'available' | 'coming_soon';
}

const CHANNELS: MessagingChannel[] = [
  {
    id: 'facebook_messenger',
    name: 'Facebook Messenger',
    description: 'Ontvang en beantwoord Facebook berichten in je centrale inbox',
    icon: Facebook,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    status: 'available',
  },
  {
    id: 'instagram_dm',
    name: 'Instagram DM\'s',
    description: 'Ontvang en beantwoord Instagram Direct Messages in je inbox',
    icon: Instagram,
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-100',
    status: 'available',
  },
  {
    id: 'whatsapp_business',
    name: 'WhatsApp Business',
    description: 'Berichten en notificaties via WhatsApp Business',
    icon: MessageCircle,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    status: 'available',
  },
  {
    id: 'telegram',
    name: 'Telegram Business',
    description: 'Ontvang Telegram berichten in je inbox',
    icon: Send,
    iconColor: 'text-sky-600',
    iconBg: 'bg-sky-100',
    status: 'coming_soon',
  },
  {
    id: 'live_chat',
    name: 'Live Chat Widget',
    description: 'Chat widget voor je webshop',
    icon: MessageSquare,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-100',
    status: 'coming_soon',
  },
];

export function MessagingChannelList() {
  const { currentTenant } = useTenant();
  const { connections: metaConnections, deleteConnection: deleteMetaConnection, getConnectionByPlatform } = useMetaMessagingConnections();
  const { getConnectionByType: getSocialConnectionByType, deleteConnection: deleteSocialConnection } = useSocialChannels();

  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [whatsappWizardOpen, setWhatsappWizardOpen] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<{ id: string; source: 'meta' | 'social' } | null>(null);

  const getChannelConnection = (channelId: string) => {
    switch (channelId) {
      case 'facebook_messenger':
        return getConnectionByPlatform('facebook');
      case 'instagram_dm':
        return getConnectionByPlatform('instagram');
      case 'whatsapp_business':
        return getSocialConnectionByType('whatsapp_business');
      default:
        return undefined;
    }
  };

  const handleConnect = async (channelId: string) => {
    if (channelId === 'whatsapp_business') {
      setWhatsappWizardOpen(true);
      return;
    }

    if (channelId === 'facebook_messenger' || channelId === 'instagram_dm') {
      if (!currentTenant?.id) return;

      setConnectingPlatform(channelId);
      try {
        const { data, error } = await supabase.functions.invoke('social-oauth-init', {
          body: {
            platform: 'facebook',
            tenantId: currentTenant.id,
            redirectUrl: window.location.href,
          },
        });

        if (error) {
          const errorData = data || {};
          if (errorData?.missingConfig) {
            toast.error(
              'Meta App credentials niet geconfigureerd. Ga naar Instellingen → API Credentials om je Meta App ID en Secret in te voeren.',
              { duration: 8000 }
            );
            return;
          }
          throw error;
        }

        if (data?.authUrl) {
          window.location.href = data.authUrl;
        }
      } catch (err: any) {
        toast.error('Kon OAuth niet starten: ' + (err.message || 'Onbekende fout'));
      } finally {
        setConnectingPlatform(null);
      }
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectingId) return;

    try {
      if (disconnectingId.source === 'meta') {
        await deleteMetaConnection.mutateAsync(disconnectingId.id);
      } else {
        await deleteSocialConnection.mutateAsync(disconnectingId.id);
      }
      setDisconnectingId(null);
    } catch {
      // Error handled by mutation
    }
  };

  const getDisconnectInfo = (channelId: string): { id: string; source: 'meta' | 'social' } | null => {
    switch (channelId) {
      case 'facebook_messenger': {
        const conn = getConnectionByPlatform('facebook');
        return conn ? { id: conn.id, source: 'meta' } : null;
      }
      case 'instagram_dm': {
        const conn = getConnectionByPlatform('instagram');
        return conn ? { id: conn.id, source: 'meta' } : null;
      }
      case 'whatsapp_business': {
        const conn = getSocialConnectionByType('whatsapp_business');
        return conn ? { id: conn.id, source: 'social' } : null;
      }
      default:
        return null;
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const connection = getChannelConnection(channel.id);
          const isConnected = !!connection;
          const isComingSoon = channel.status === 'coming_soon';
          const isLoading = connectingPlatform === channel.id;

          return (
            <Card key={channel.id} className={cn('relative', isComingSoon && 'opacity-60')}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', channel.iconBg)}>
                    <Icon className={cn('w-5 h-5', channel.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{channel.name}</h3>
                      {isComingSoon && (
                        <Badge variant="secondary" className="text-xs">Binnenkort</Badge>
                      )}
                      {isConnected && (
                        <Badge className="bg-green-100 text-green-700 text-xs">Verbonden</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{channel.description}</p>
                  </div>
                </div>

                {isConnected && (
                  <div className="text-xs text-muted-foreground mb-3 px-1">
                    {channel.id === 'facebook_messenger' && connection && 'page_name' in connection && (
                      <span>Pagina: {(connection as any).page_name || 'Onbekend'}</span>
                    )}
                    {channel.id === 'instagram_dm' && connection && 'page_name' in connection && (
                      <span>Account: {(connection as any).page_name || 'Onbekend'}</span>
                    )}
                    {channel.id === 'whatsapp_business' && connection && 'channel_name' in connection && (
                      <span>Nummer: {(connection as any).channel_name || 'Verbonden'}</span>
                    )}
                  </div>
                )}

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
                        onClick={() => {
                          const info = getDisconnectInfo(channel.id);
                          if (info) setDisconnectingId(info);
                        }}
                      >
                        Verbreken
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleConnect(channel.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Verbinden...' : 'Verbinden'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* WhatsApp Connect Wizard */}
      <WhatsAppConnectWizard
        open={whatsappWizardOpen}
        onOpenChange={setWhatsappWizardOpen}
        onSuccess={() => setWhatsappWizardOpen(false)}
      />

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectingId} onOpenChange={(open) => !open && setDisconnectingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Messaging kanaal verbreken?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert de verbinding. Nieuwe berichten via dit kanaal worden niet meer ontvangen in je inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verbreek Kanaal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
