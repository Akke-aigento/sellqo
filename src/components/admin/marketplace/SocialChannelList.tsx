import { useState } from 'react';
import { SocialChannelCard } from './SocialChannelCard';
import { ConnectSocialChannelDialog } from './ConnectSocialChannelDialog';
import { SocialChannelSettingsDialog } from './SocialChannelSettingsDialog';
import { useSocialChannels } from '@/hooks/useSocialChannels';
import { SOCIAL_CHANNEL_INFO, type SocialChannelType } from '@/types/socialChannels';
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

const CHANNEL_ORDER: SocialChannelType[] = [
  'google_shopping',
  'facebook_shop',
  'tiktok_shop',
  'pinterest_catalog',
  'whatsapp_business',
  'microsoft_shopping',
];

export function SocialChannelList() {
  const {
    connections,
    deleteConnection,
    getConnectionByType,
  } = useSocialChannels();

  const [connectingType, setConnectingType] = useState<SocialChannelType | null>(null);
  const [settingsType, setSettingsType] = useState<SocialChannelType | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const handleConnect = (type: SocialChannelType) => {
    setConnectingType(type);
  };

  const handleSettings = (type: SocialChannelType) => {
    setSettingsType(type);
  };

  const handleDisconnect = async () => {
    if (!disconnectingId) return;
    
    try {
      await deleteConnection.mutateAsync(disconnectingId);
      setDisconnectingId(null);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CHANNEL_ORDER.map((type) => {
          const info = SOCIAL_CHANNEL_INFO[type];
          const connection = getConnectionByType(type);
          
          return (
            <SocialChannelCard
              key={type}
              info={info}
              connection={connection}
              onConnect={() => handleConnect(type)}
              onSettings={() => handleSettings(type)}
              onDisconnect={() => connection && setDisconnectingId(connection.id)}
            />
          );
        })}
      </div>

      {/* Connect Dialog */}
      {connectingType && (
        <ConnectSocialChannelDialog
          open={!!connectingType}
          onOpenChange={(open) => !open && setConnectingType(null)}
          channelType={connectingType}
        />
      )}

      {/* Settings Dialog */}
      {settingsType && (
        <SocialChannelSettingsDialog
          open={!!settingsType}
          onOpenChange={(open) => !open && setSettingsType(null)}
          channelType={settingsType}
          connection={getConnectionByType(settingsType)}
        />
      )}

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectingId} onOpenChange={(open) => !open && setDisconnectingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kanaal verbreken?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert de connectie. Je product feeds worden niet meer gegenereerd en producten worden niet meer gesynchroniseerd naar dit kanaal.
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
