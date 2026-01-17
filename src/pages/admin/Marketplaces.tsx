import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Link2, ShoppingCart, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marktplaats Integraties</h1>
        <p className="text-muted-foreground mt-2">
          Verbind je verkoopkanalen en synchroniseer automatisch bestellingen en voorraad
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actieve Connecties</p>
                <p className="text-2xl font-bold">{activeConnections.length}</p>
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
                <p className="text-sm text-muted-foreground">Totaal Orders</p>
                <p className="text-2xl font-bold text-orange-600">{todayOrders}</p>
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

      {/* Marketplace Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(['bol_com', 'amazon', 'shopify', 'woocommerce'] as MarketplaceType[]).map((type) => {
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
