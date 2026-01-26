import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Link2, ShoppingCart, Clock, AlertCircle, Store, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { MarketplaceCard } from '@/components/admin/marketplace/MarketplaceCard';
import { ConnectMarketplaceDialog } from '@/components/admin/marketplace/ConnectMarketplaceDialog';
import { SocialChannelList } from '@/components/admin/marketplace/SocialChannelList';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useSocialChannels } from '@/hooks/useSocialChannels';
import { MARKETPLACE_INFO, type MarketplaceType } from '@/types/marketplace';
import { toast } from 'sonner';

export default function MarketplacesPage() {
  const navigate = useNavigate();
  const {
    connections,
    activeConnections,
    todayOrders,
    lastSync,
    isLoading,
    deleteConnection,
    getConnectionByType,
  } = useMarketplaceConnections();

  const {
    activeConnections: activeSocialConnections,
    totalProductsSynced,
  } = useSocialChannels();

  const [connectingType, setConnectingType] = useState<MarketplaceType | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const handleConnect = (type: MarketplaceType) => {
    setConnectingType(type);
  };

  const handleSettings = (type: MarketplaceType) => {
    const connection = getConnectionByType(type);
    if (connection) {
      navigate(`/admin/settings/marketplaces/${connection.id}`);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectingId) return;
    
    try {
      await deleteConnection.mutateAsync(disconnectingId);
      setDisconnectingId(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleRequestIntegration = () => {
    toast.info('Neem contact met ons op voor een nieuwe integratie!');
  };

  const formattedLastSync = lastSync
    ? formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: nl })
    : 'Nog niet';

  const totalActiveConnections = activeConnections.length + activeSocialConnections.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SellQo Connect</h1>
        <p className="text-muted-foreground mt-2">
          Verbind je verkoopkanalen en synchroniseer automatisch bestellingen en voorraad
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actieve Connecties</p>
                <p className="text-2xl font-bold">{totalActiveConnections}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marketplace Orders</p>
                <p className="text-2xl font-bold text-orange-600">{todayOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Share2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Social Producten</p>
                <p className="text-2xl font-bold text-purple-600">{totalProductsSynced}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Laatste Sync</p>
                <p className="text-2xl font-bold">{formattedLastSync}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert if any connection has errors */}
      {connections.some(c => c.last_error) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Synchronisatie problemen</AlertTitle>
          <AlertDescription>
            Er zijn problemen met een of meer marketplace connecties. Controleer de instellingen.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs for Marketplaces and Social Commerce */}
      <Tabs defaultValue="marketplaces" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="marketplaces" className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            E-commerce
          </TabsTrigger>
          <TabsTrigger value="social" className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Social Commerce
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplaces" className="mt-6">
          {/* Marketplace Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(['bol_com', 'amazon', 'shopify', 'woocommerce', 'odoo'] as MarketplaceType[]).map((type) => {
              const info = MARKETPLACE_INFO[type];
              const connection = getConnectionByType(type);
              
              return (
                <MarketplaceCard
                  key={type}
                  info={info}
                  connection={connection}
                  onConnect={() => handleConnect(type)}
                  onSettings={() => handleSettings(type)}
                  onDisconnect={() => connection && setDisconnectingId(connection.id)}
                />
              );
            })}

            {/* Request Integration Card */}
            <MarketplaceCard
              info={MARKETPLACE_INFO.request as any}
              onConnect={handleRequestIntegration}
              onSettings={() => {}}
              onDisconnect={() => {}}
            />
          </div>
        </TabsContent>

        <TabsContent value="social" className="mt-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Social Commerce Kanalen</h2>
            <p className="text-muted-foreground">
              Verbind je producten met sociale media en shopping platforms om je bereik te vergroten.
            </p>
          </div>
          <SocialChannelList />
        </TabsContent>
      </Tabs>

      {/* Connect Dialog */}
      {connectingType && (
        <ConnectMarketplaceDialog
          open={!!connectingType}
          onOpenChange={(open) => !open && setConnectingType(null)}
          marketplaceType={connectingType}
          onSuccess={() => navigate('/admin/orders')}
        />
      )}

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectingId} onOpenChange={(open) => !open && setDisconnectingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marketplace verbreken?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert de connectie. Je orders en producten blijven bewaard in SellQo, maar nieuwe orders worden niet meer geïmporteerd en voorraad wordt niet meer gesynchroniseerd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verbreek Integratie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
