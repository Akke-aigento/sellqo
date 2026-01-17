import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Zap,
  CheckCircle,
  ShoppingCart,
  Package,
  Bell,
} from 'lucide-react';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import type { MarketplaceType, MarketplaceSettings } from '@/types/marketplace';
import { MARKETPLACE_INFO } from '@/types/marketplace';

interface ConnectMarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketplaceType: MarketplaceType;
  onSuccess?: () => void;
}

type Step = 'intro' | 'credentials' | 'settings' | 'success';

export function ConnectMarketplaceDialog({
  open,
  onOpenChange,
  marketplaceType,
  onSuccess,
}: ConnectMarketplaceDialogProps) {
  const [step, setStep] = useState<Step>('intro');
  const [connectionName, setConnectionName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  
  // Settings
  const [autoImport, setAutoImport] = useState(true);
  const [syncInterval, setSyncInterval] = useState('15');
  const [importHistorical, setImportHistorical] = useState(true);
  const [autoSyncInventory, setAutoSyncInventory] = useState(true);
  const [safetyStock, setSafetyStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [emailNotifyNewOrders, setEmailNotifyNewOrders] = useState(false);
  const [emailNotifySyncErrors, setEmailNotifySyncErrors] = useState(true);
  const [emailNotifyLowStock, setEmailNotifyLowStock] = useState(false);
  
  // Sync progress
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSteps, setSyncSteps] = useState({ orders: false, products: false, inventory: false });
  const [ordersImported, setOrdersImported] = useState(0);
  const [productsMatched, setProductsMatched] = useState(0);

  const { createConnection } = useMarketplaceConnections();
  const info = MARKETPLACE_INFO[marketplaceType];

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    // Simulate API test - in real implementation this would call your edge function
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For demo purposes, we'll just check if credentials are filled
    if (clientId.length > 10 && clientSecret.length > 10) {
      setTestResult({ success: true });
    } else {
      setTestResult({ success: false, error: 'Ongeldige credentials. Controleer je Client ID en Secret.' });
    }
    
    setTesting(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    
    try {
      await createConnection.mutateAsync({
        marketplace_type: marketplaceType,
        marketplace_name: connectionName || undefined,
        credentials: {
          clientId,
          clientSecret,
        },
        settings: {
          syncInterval: parseInt(syncInterval),
          autoImport,
          autoSyncInventory,
          safetyStock: parseInt(safetyStock),
          lowStockThreshold: parseInt(lowStockThreshold),
          emailNotifyNewOrders,
          emailNotifySyncErrors,
          emailNotifyLowStock,
          importHistorical,
        },
      });
      
      setStep('success');
      
      // Simulate first sync progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setSyncProgress(i);
        
        if (i >= 30) {
          setSyncSteps(prev => ({ ...prev, orders: true }));
          setOrdersImported(Math.floor(Math.random() * 50) + 10);
        }
        if (i >= 60) {
          setSyncSteps(prev => ({ ...prev, products: true }));
          setProductsMatched(Math.floor(Math.random() * 30) + 5);
        }
        if (i >= 90) {
          setSyncSteps(prev => ({ ...prev, inventory: true }));
        }
      }
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setConnecting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setStep('intro');
      setConnectionName('');
      setClientId('');
      setClientSecret('');
      setTestResult(null);
      setSyncProgress(0);
      setSyncSteps({ orders: false, products: false, inventory: false });
    }, 200);
  };

  const handleFinish = () => {
    handleClose();
    onSuccess?.();
  };

  const getInstructions = () => {
    switch (marketplaceType) {
      case 'bol_com':
        return {
          title: 'Bol.com Partner Plaza',
          url: 'https://partnerplatform.bol.com',
          steps: [
            'Log in op Bol.com Partner Plaza',
            'Ga naar Instellingen → API → Nieuwe API key aanmaken',
            'Kopieer je Client ID en Client Secret',
            'Plak deze hieronder en klik op "Verbind"',
          ],
        };
      case 'amazon':
        return {
          title: 'Amazon Seller Central',
          url: 'https://sellercentral.amazon.nl',
          steps: [
            'Log in op Amazon Seller Central',
            'Ga naar Apps and Services → Develop Apps',
            'Registreer een nieuwe applicatie',
            'Kopieer je credentials',
          ],
        };
      default:
        return {
          title: 'Platform Dashboard',
          url: '#',
          steps: ['Volg de instructies van het platform'],
        };
    }
  };

  const instructions = getInstructions();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {step === 'intro' && (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verbind je {info.name} account</DialogTitle>
            <DialogDescription>
              Volg deze stappen om je {info.name} account te koppelen
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Je hebt nodig:</AlertTitle>
              <AlertDescription>
                Een actief {info.name} account met API toegang
              </AlertDescription>
            </Alert>

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold mb-3">Stap-voor-stap:</h4>
              <ol className="space-y-2 text-sm">
                {instructions.steps.map((step, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="font-semibold text-primary">{idx + 1}.</span>
                    <span>
                      {step}
                      {idx === 0 && (
                        <a
                          href={instructions.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline ml-1"
                        >
                          {instructions.title}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex gap-4">
              <a
                href="#"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Waar vind ik mijn API credentials?
              </a>
              <a
                href={instructions.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Open {instructions.title}
              </a>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Annuleer
            </Button>
            <Button onClick={() => setStep('credentials')}>Volgende</Button>
          </DialogFooter>
        </DialogContent>
      )}

      {step === 'credentials' && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Voer je {info.name} API gegevens in</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Connectie naam (optioneel)</Label>
              <Input
                placeholder={`Bijv: ${info.name} België`}
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Handig als je meerdere accounts hebt
              </p>
            </div>

            <div>
              <Label>Client ID *</Label>
              <Input
                type="text"
                required
                placeholder="Bijv: 1234567890abcdef"
                className="mt-1 font-mono text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>

            <div>
              <Label>Client Secret *</Label>
              <div className="relative mt-1">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••••••"
                  className="pr-10 font-mono text-sm"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={!clientId || !clientSecret || testing}
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verbinding testen...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Test Verbinding
                </>
              )}
            </Button>

            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <AlertDescription>Verbinding succesvol! Je kunt doorgaan.</AlertDescription>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{testResult.error}</AlertDescription>
                  </>
                )}
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep('intro')}>
              Terug
            </Button>
            <Button
              onClick={() => setStep('settings')}
              disabled={!clientId || !clientSecret}
            >
              Volgende
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {step === 'settings' && (
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Synchronisatie instellingen</DialogTitle>
            <DialogDescription>
              Configureer hoe SellQo met {info.name} synchroniseert
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            {/* Order Sync Settings */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Bestellingen
              </h4>
              <div className="space-y-4 ml-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Automatisch importeren</p>
                    <p className="text-sm text-muted-foreground">
                      Nieuwe orders worden automatisch opgehaald
                    </p>
                  </div>
                  <Switch checked={autoImport} onCheckedChange={setAutoImport} />
                </div>

                {autoImport && (
                  <div>
                    <Label>Sync interval</Label>
                    <Select value={syncInterval} onValueChange={setSyncInterval}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">Elke 5 minuten (Business plan)</SelectItem>
                        <SelectItem value="15">Elke 15 minuten (Pro plan)</SelectItem>
                        <SelectItem value="30">Elke 30 minuten</SelectItem>
                        <SelectItem value="60">Elk uur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Historische orders importeren</p>
                    <p className="text-sm text-muted-foreground">
                      Importeer bestellingen van de afgelopen 30 dagen
                    </p>
                  </div>
                  <Switch checked={importHistorical} onCheckedChange={setImportHistorical} />
                </div>
              </div>
            </div>

            {/* Inventory Sync Settings */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Voorraad
              </h4>
              <div className="space-y-4 ml-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Automatisch synchroniseren</p>
                    <p className="text-sm text-muted-foreground">
                      Voorraad wordt automatisch bijgewerkt op {info.name}
                    </p>
                  </div>
                  <Switch checked={autoSyncInventory} onCheckedChange={setAutoSyncInventory} />
                </div>

                {autoSyncInventory && (
                  <div>
                    <Label>Veiligheidsvoorraad (optioneel)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      className="mt-1"
                      value={safetyStock}
                      onChange={(e) => setSafetyStock(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Trek dit aantal af van je werkelijke voorraad. Bijv: Je hebt 10 stuks, safety stock = 2, {info.name} ziet 8 stuks.
                    </p>
                  </div>
                )}

                <div>
                  <Label>Waarschuwing bij lage voorraad</Label>
                  <Input
                    type="number"
                    placeholder="5"
                    className="mt-1"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Ontvang een melding als voorraad onder dit aantal komt
                  </p>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notificaties
              </h4>
              <div className="space-y-3 ml-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm">Email bij nieuwe orders</p>
                  <Switch checked={emailNotifyNewOrders} onCheckedChange={setEmailNotifyNewOrders} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Email bij sync fouten</p>
                  <Switch checked={emailNotifySyncErrors} onCheckedChange={setEmailNotifySyncErrors} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Email bij lage voorraad</p>
                  <Switch checked={emailNotifyLowStock} onCheckedChange={setEmailNotifyLowStock} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep('credentials')}>
              Terug
            </Button>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verbinden...
                </>
              ) : (
                'Opslaan & Activeren'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {step === 'success' && (
        <DialogContent className="max-w-md text-center">
          <div className="py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-2xl mb-2">{info.name} Verbonden! 🎉</DialogTitle>
            <DialogDescription className="mb-6">
              Je account is succesvol gekoppeld. We starten nu de eerste synchronisatie.
            </DialogDescription>

            {/* Sync Progress */}
            <div className="bg-muted rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Eerste sync wordt uitgevoerd...</span>
                <span className="text-sm text-muted-foreground">{syncProgress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {syncSteps.orders ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>
                    Bestellingen ophalen
                    {syncSteps.orders && ` (${ordersImported} gevonden)`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {syncSteps.products ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  <span>
                    Product mappings aanmaken
                    {syncSteps.products && ` (${productsMatched} gekoppeld)`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {syncSteps.inventory ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  <span>Voorraad synchroniseren</span>
                </div>
              </div>
            </div>

            <Button onClick={handleFinish} className="w-full">
              Bekijk Geïmporteerde Orders
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
