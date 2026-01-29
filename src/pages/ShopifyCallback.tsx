import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ShopifyCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Shopify koppeling wordt verwerkt...');
  const [shopName, setShopName] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const shop = searchParams.get('shop');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle errors from Shopify
      if (error) {
        setStatus('error');
        setMessage(errorDescription || error || 'Shopify autorisatie geweigerd');
        return;
      }

      // Validate required params
      if (!code || !state || !shop) {
        setStatus('error');
        setMessage('Ontbrekende parameters in Shopify callback');
        return;
      }

      try {
        // Call the edge function to exchange code for token
        const { data, error: fnError } = await supabase.functions.invoke('shopify-oauth-callback', {
          body: { code, state, shop },
        });

        if (fnError) {
          console.error('Edge function error:', fnError);
          setStatus('error');
          setMessage(fnError.message || 'Fout bij verwerken van Shopify koppeling');
          return;
        }

        if (data?.error) {
          setStatus('error');
          setMessage(data.error);
          return;
        }

        setShopName(data?.shopName || shop);
        setStatus('success');
        setMessage('Shopify succesvol gekoppeld!');

        // Auto-redirect after 2 seconds
        setTimeout(() => {
          navigate('/admin/connect?success=shopify_connected');
        }, 2000);
      } catch (err: any) {
        console.error('Callback processing error:', err);
        setStatus('error');
        setMessage(err.message || 'Onbekende fout opgetreden');
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {status === 'loading' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <h2 className="text-xl font-semibold">Even geduld...</h2>
                <p className="text-muted-foreground">{message}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="h-12 w-12 text-green-500" />
                <h2 className="text-xl font-semibold text-green-700">{message}</h2>
                {shopName && (
                  <p className="text-muted-foreground">
                    Winkel: <strong>{shopName}</strong>
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Je wordt doorgestuurd naar SellQo Connect...
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 text-destructive" />
                <h2 className="text-xl font-semibold text-destructive">Koppeling mislukt</h2>
                <p className="text-muted-foreground">{message}</p>
                <Button onClick={() => navigate('/admin/connect')} className="mt-4">
                  Terug naar SellQo Connect
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
