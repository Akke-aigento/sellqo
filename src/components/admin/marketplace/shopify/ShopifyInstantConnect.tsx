import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Store,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';
import { ShopifySetupGuide } from './ShopifySetupGuide';
import { supabase } from '@/integrations/supabase/client';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { toast } from 'sonner';

interface ShopifyInstantConnectProps {
  onSuccess?: () => void;
}

const REQUIRED_SCOPES = [
  'read_products',
  'write_products', 
  'read_orders',
  'write_orders',
  'read_inventory',
  'write_inventory',
  'read_customers',
  'read_fulfillments',
  'write_fulfillments',
];

export function ShopifyInstantConnect({ onSuccess }: ShopifyInstantConnectProps) {
  const [storeUrl, setStoreUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; shopName?: string; error?: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copiedScopes, setCopiedScopes] = useState(false);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);
  const [copiedRedirectUrl, setCopiedRedirectUrl] = useState(false);

  const { createConnection } = useMarketplaceConnections();

  const APP_URL = 'https://sellqo.app';
  const REDIRECT_URL = 'https://sellqo.app/api/shopify/callback';

  const normalizeStoreUrl = (url: string): string => {
    let normalized = url.toLowerCase().trim();
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/\/.*$/, '');
    if (!normalized.includes('.')) {
      normalized = `${normalized}.myshopify.com`;
    }
    return normalized;
  };

  const handleCopyScopes = () => {
    navigator.clipboard.writeText(REQUIRED_SCOPES.join(', '));
    setCopiedScopes(true);
    toast.success('Scopes gekopieerd!');
    setTimeout(() => setCopiedScopes(false), 2000);
  };

  const handleCopyAppUrl = () => {
    navigator.clipboard.writeText(APP_URL);
    setCopiedAppUrl(true);
    toast.success('App URL gekopieerd!');
    setTimeout(() => setCopiedAppUrl(false), 2000);
  };

  const handleCopyRedirectUrl = () => {
    navigator.clipboard.writeText(REDIRECT_URL);
    setCopiedRedirectUrl(true);
    toast.success('Redirect URL gekopieerd!');
    setTimeout(() => setCopiedRedirectUrl(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!storeUrl.trim() || !accessToken.trim()) return;
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-shopify-connection', {
        body: {
          credentials: {
            storeUrl: normalizeStoreUrl(storeUrl),
            accessToken: accessToken.trim(),
          },
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        setTestResult({ 
          success: true, 
          shopName: data.shopName,
        });
      } else {
        setTestResult({ 
          success: false, 
          error: data?.error || 'Verbinding mislukt',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verbinding mislukt';
      setTestResult({ success: false, error: message });
    }
    
    setTesting(false);
  };

  const handleConnect = async () => {
    if (!testResult?.success) return;
    
    setConnecting(true);
    
    try {
      await createConnection.mutateAsync({
        marketplace_type: 'shopify',
        marketplace_name: testResult.shopName || normalizeStoreUrl(storeUrl),
        credentials: {
          storeUrl: normalizeStoreUrl(storeUrl),
          accessToken: accessToken.trim(),
        },
        settings: {
          syncInterval: 15,
          autoImport: true,
          autoSyncInventory: true,
          safetyStock: 0,
          lowStockThreshold: 5,
        },
      });
      
      toast.success('Shopify verbonden!');
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
    
    setConnecting(false);
  };

  const normalizedUrl = storeUrl ? normalizeStoreUrl(storeUrl) : '';

  return (
    <div className="space-y-6">
      <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
        <Zap className="w-4 h-4 text-green-600" />
        <AlertTitle className="text-green-900 dark:text-green-100">Direct Verbinden</AlertTitle>
        <AlertDescription className="text-green-800 dark:text-green-200">
          Voor technisch onderlegde gebruikers. Maak zelf een Custom App aan in Shopify 
          en plak je Admin API access token hieronder.
        </AlertDescription>
      </Alert>

      {/* Step 1: Instructions */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <Badge variant="outline">Stap 1</Badge>
            Maak een Custom App in Shopify
          </h4>
          <ShopifySetupGuide />
        </div>
        <ol className="text-sm space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-primary font-medium">1.</span>
            <span>
              Ga naar{' '}
              <a 
                href={`https://admin.shopify.com/store/${normalizedUrl.replace('.myshopify.com', '')}/settings/apps/development`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Shopify Admin → Settings → Apps → Develop apps
                <ExternalLink className="w-3 h-3" />
              </a>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-medium">2.</span>
            <span>Klik op "Create an app" en noem het "SellQo Connector"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-medium">3.</span>
            <span>Ga naar "Configuration" → "Admin API integration"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-medium">4.</span>
            <span>Selecteer deze scopes (Admin API access scopes):</span>
          </li>
        </ol>
        
        {/* Scopes box */}
        <div className="bg-background border rounded-md p-3 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Vereiste scopes:</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleCopyScopes}
            >
              {copiedScopes ? (
                <Check className="w-3 h-3 mr-1" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              Kopieer
            </Button>
          </div>
          <code className="text-xs text-muted-foreground break-all">
            {REQUIRED_SCOPES.join(', ')}
          </code>
        </div>

        {/* URLs box */}
        <div className="bg-background border rounded-md p-3 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Vereiste URLs (Configuration tab):</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">App URL:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleCopyAppUrl}
                >
                  {copiedAppUrl ? (
                    <Check className="w-3 h-3 mr-1" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1" />
                  )}
                  Kopieer
                </Button>
              </div>
              <code className="text-xs text-muted-foreground block bg-muted/50 px-2 py-1 rounded">
                {APP_URL}
              </code>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Allowed redirection URL(s):</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleCopyRedirectUrl}
                >
                  {copiedRedirectUrl ? (
                    <Check className="w-3 h-3 mr-1" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1" />
                  )}
                  Kopieer
                </Button>
              </div>
              <code className="text-xs text-muted-foreground block bg-muted/50 px-2 py-1 rounded">
                {REDIRECT_URL}
              </code>
            </div>
          </div>
        </div>

        <ol className="text-sm space-y-2 ml-4" start={5}>
          <li className="flex items-start gap-2">
            <span className="text-primary font-medium">5.</span>
            <span>Klik "Save" en dan "Install app"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-medium">6.</span>
            <span>Kopieer de "Admin API access token" (wordt slechts 1x getoond!)</span>
          </li>
        </ol>
      </div>

      {/* Step 2: Enter credentials */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Badge variant="outline">Stap 2</Badge>
          Voer je gegevens in
        </h4>

        <div>
          <Label htmlFor="store-url">Shopify Store URL</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="store-url"
              type="text"
              placeholder="mijn-winkel"
              autoComplete="off"
              value={storeUrl}
              onChange={(e) => {
                setStoreUrl(e.target.value);
                setTestResult(null);
              }}
              className="flex-1"
            />
            <span className="flex items-center text-muted-foreground text-sm px-3 bg-muted rounded-md whitespace-nowrap">
              .myshopify.com
            </span>
          </div>
        </div>

        <div>
          <Label htmlFor="access-token">Admin API Access Token</Label>
          <div className="relative mt-1">
            <Input
              id="access-token"
              type={showToken ? 'text' : 'password'}
              placeholder="shpat_xxxxx..."
              autoComplete="off"
              value={accessToken}
              onChange={(e) => {
                setAccessToken(e.target.value);
                setTestResult(null);
              }}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Start meestal met "shpat_"
          </p>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <Alert variant={testResult.success ? 'default' : 'destructive'}>
          {testResult.success ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertTitle className="text-green-700">Verbinding succesvol!</AlertTitle>
              <AlertDescription className="text-green-600">
                Verbonden met: {testResult.shopName}
              </AlertDescription>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Verbinding mislukt</AlertTitle>
              <AlertDescription>{testResult.error}</AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={!storeUrl.trim() || !accessToken.trim() || testing}
          className="flex-1"
        >
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testen...
            </>
          ) : (
            'Test Verbinding'
          )}
        </Button>

        <Button
          onClick={handleConnect}
          disabled={!testResult?.success || connecting}
          className="flex-1 bg-[#96bf48] hover:bg-[#7ea83d]"
        >
          {connecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verbinden...
            </>
          ) : (
            <>
              <Store className="w-4 h-4 mr-2" />
              Verbind Shopify
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        <a 
          href="https://help.shopify.com/nl/manual/apps/custom-apps"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline inline-flex items-center gap-1"
        >
          Shopify Custom Apps documentatie
          <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}
