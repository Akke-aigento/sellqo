import { useState } from 'react';
import { SocialChannelCard } from './SocialChannelCard';
import { ConnectSocialChannelDialog } from './ConnectSocialChannelDialog';
import { SocialChannelSettingsDialog } from './SocialChannelSettingsDialog';
import { MetaShopWizard } from './MetaShopWizard';
import { WhatsAppConnectWizard } from './WhatsAppConnectWizard';
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
  'instagram_shop',
  'tiktok_shop',
  'pinterest_catalog',
  'whatsapp_business',
  'microsoft_shopping',
];

// Channels that use Meta Commerce API (direct sync, not feed-based)
const META_COMMERCE_CHANNELS: SocialChannelType[] = [
  'facebook_shop',
  'instagram_shop',
];

export function SocialChannelList() {
  const {
    connections,
    deleteConnection,
    getConnectionByType,
  } = useSocialChannels();

  const [connectingType, setConnectingType] = useState<SocialChannelType | null>(null);
  const [metaWizardType, setMetaWizardType] = useState<SocialChannelType | null>(null);
  const [whatsappWizardOpen, setWhatsappWizardOpen] = useState(false);
  const [settingsType, setSettingsType] = useState<SocialChannelType | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const handleConnect = (type: SocialChannelType) => {
    if (type === 'whatsapp_business') {
      setWhatsappWizardOpen(true);
    } else if (META_COMMERCE_CHANNELS.includes(type)) {
      setMetaWizardType(type);
    } else {
      setConnectingType(type);
    }
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

      {/* Connect Dialog (for feed-based channels) */}
      {connectingType && (
        <ConnectSocialChannelDialog
          open={!!connectingType}
          onOpenChange={(open) => !open && setConnectingType(null)}
          channelType={connectingType}
        />
      )}

      {/* Meta Commerce Wizard (for Facebook/Instagram) */}
      {metaWizardType && (
        <MetaShopWizard
          open={!!metaWizardType}
          onOpenChange={(open) => !open && setMetaWizardType(null)}
          channelType={metaWizardType}
          onSuccess={() => setMetaWizardType(null)}
        />
      )}

      {/* WhatsApp Connect Wizard */}
      <WhatsAppConnectWizard
        open={whatsappWizardOpen}
        onOpenChange={setWhatsappWizardOpen}
        onSuccess={() => setWhatsappWizardOpen(false)}
      />

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
