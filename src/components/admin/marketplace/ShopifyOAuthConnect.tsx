import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, Store, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface ShopifyOAuthConnectProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ShopifyOAuthConnect({ onSuccess, onCancel }: ShopifyOAuthConnectProps) {
  const { currentTenant } = useTenant();
  const [shopUrl, setShopUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth callback results
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const shopName = urlParams.get('shop');
    const errorParam = urlParams.get('error');

    if (success === 'shopify_connected' && shopName) {
      toast.success(`Shopify verbonden: ${decodeURIComponent(shopName)}`);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      onSuccess?.();
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam));
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onSuccess]);

  const handleConnect = async () => {
    if (!currentTenant?.id) {
      setError('Geen tenant geselecteerd');
      return;
    }

    if (!shopUrl.trim()) {
      setError('Vul je Shopify store URL in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('shopify-oauth-init', {
        body: {
          tenantId: currentTenant.id,
          shopUrl: shopUrl.trim(),
          redirectUrl: '/admin/connect',
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'OAuth initialisatie mislukt');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.authUrl) {
        // Open Shopify authorization in a new window/tab
        window.location.href = data.authUrl;
      } else {
        throw new Error('Geen autorisatie URL ontvangen');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verbinding mislukt';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-[#96bf48] rounded-xl flex items-center justify-center">
          <Store className="w-8 h-8 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Verbind met Shopify</h3>
          <p className="text-muted-foreground">Log in met je Shopify account</p>
        </div>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <CheckCircle className="w-4 h-4 text-primary" />
        <AlertTitle>Eenvoudige OAuth koppeling</AlertTitle>
        <AlertDescription>
          Je wordt doorgestuurd naar Shopify om in te loggen en toegang te geven. 
          Er is geen handmatige setup of API key nodig.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div>
          <Label htmlFor="shop-url">Je Shopify winkel URL</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="shop-url"
              type="text"
              placeholder="mijn-winkel"
              value={shopUrl}
              onChange={(e) => setShopUrl(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
            <span className="flex items-center text-muted-foreground text-sm px-2 bg-muted rounded-md">
              .myshopify.com
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Voer alleen de naam in (niet de volledige URL)
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Annuleer
          </Button>
        )}
        <Button 
          onClick={handleConnect} 
          disabled={loading || !shopUrl.trim()}
          className="flex-1 bg-[#96bf48] hover:bg-[#7ea83d] text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Doorsturen naar Shopify...
            </>
          ) : (
            <>
              <Store className="w-4 h-4 mr-2" />
              Verbind met Shopify
            </>
          )}
        </Button>
      </div>

      <div className="text-center">
        <a 
          href="https://help.shopify.com/nl/manual/your-account/log-in" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          Hulp nodig met inloggen?
        </a>
      </div>
    </div>
  );
}
