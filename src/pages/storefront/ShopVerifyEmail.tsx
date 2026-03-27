import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { useStorefrontAuth } from '@/context/StorefrontAuthContext';
import { useStorefrontCustomerApi } from '@/hooks/useStorefrontCustomerApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';

export default function ShopVerifyEmail() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = usePublicStorefront(tenantSlug || '');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const { invoke } = useStorefrontCustomerApi();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setStatus('error');
      setErrorMessage('Ongeldige verificatielink. Controleer de link in je e-mail.');
      return;
    }

    (async () => {
      try {
        await invoke('verify_email', { email, token });
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'Verificatie mislukt');
      }
    })();
  }, [token, email]);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await invoke('resend_verification', { email });
      toast.success('Nieuwe verificatiemail verstuurd!');
    } catch {
      toast.error('Kon geen nieuwe mail versturen');
    } finally {
      setResending(false);
    }
  };

  return (
    <ShopLayout>
      <Helmet>
        <title>E-mail bevestigen | {tenant?.name || 'Shop'}</title>
      </Helmet>
      <div className="container mx-auto px-4 py-12 max-w-md">
        <Card>
          <CardHeader className="text-center">
            {status === 'loading' && <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />}
            {status === 'success' && <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />}
            {status === 'error' && <XCircle className="h-12 w-12 mx-auto text-destructive" />}
            <CardTitle className="mt-4">
              {status === 'loading' && 'E-mailadres bevestigen...'}
              {status === 'success' && 'E-mailadres bevestigd!'}
              {status === 'error' && 'Verificatie mislukt'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {status === 'success' && (
              <>
                <p className="text-muted-foreground">Je e-mailadres is succesvol bevestigd. Je kunt nu inloggen.</p>
                <Button asChild className="w-full">
                  <Link to={`/shop/${tenantSlug}/login`}>Inloggen</Link>
                </Button>
              </>
            )}
            {status === 'error' && (
              <>
                <p className="text-muted-foreground">{errorMessage}</p>
                {email && (
                  <Button variant="outline" onClick={handleResend} disabled={resending} className="w-full">
                    {resending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    Nieuwe verificatiemail versturen
                  </Button>
                )}
                <Button asChild variant="ghost" className="w-full">
                  <Link to={`/shop/${tenantSlug}/login`}>Terug naar inloggen</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ShopLayout>
  );
}
