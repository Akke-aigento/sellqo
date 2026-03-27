import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';

export default function ShopResetPassword() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = usePublicStorefront(tenantSlug || '');
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');
  const resetEmail = searchParams.get('email');

  const isResetMode = !!resetToken && !!resetEmail;

  // Request mode state
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Reset mode state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !tenant?.id) return;
    setProcessing(true);
    try {
      await supabase.functions.invoke('storefront-customer-api', {
        body: { action: 'request_password_reset', tenant_id: tenant.id, params: { email } },
      });
      setRequestSent(true);
    } catch {
      toast.error('Er ging iets mis. Probeer het later opnieuw.');
    } finally {
      setProcessing(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword || !tenant?.id) return;
    if (newPassword !== confirmPassword) { toast.error('Wachtwoorden komen niet overeen'); return; }
    if (newPassword.length < 8) { toast.error('Wachtwoord moet minimaal 8 tekens bevatten'); return; }
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('storefront-customer-api', {
        body: { action: 'reset_password', tenant_id: tenant.id, params: { email: resetEmail, reset_token: resetToken, new_password: newPassword } },
      });
      if (error || !data?.success) throw new Error(data?.error || 'Reset mislukt');
      setResetDone(true);
      toast.success('Wachtwoord succesvol gewijzigd');
    } catch (err: any) {
      toast.error(err.message || 'Reset mislukt. De link is mogelijk verlopen.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ShopLayout>
      <Helmet>
        <title>Wachtwoord herstellen | {tenant?.name || 'Shop'}</title>
      </Helmet>
      <div className="container mx-auto px-4 py-12 max-w-md">
        {isResetMode ? (
          resetDone ? (
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
                <h2 className="text-xl font-bold">Wachtwoord gewijzigd</h2>
                <p className="text-muted-foreground">Je kunt nu inloggen met je nieuwe wachtwoord.</p>
                <Button asChild className="w-full">
                  <Link to={`/shop/${tenantSlug}/login`}>Naar inloggen</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Nieuw wachtwoord instellen</CardTitle>
                <CardDescription>Kies een nieuw wachtwoord voor je account</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nieuw wachtwoord</Label>
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimaal 8 tekens" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Bevestig wachtwoord</Label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={processing}>
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Wachtwoord wijzigen
                  </Button>
                </form>
              </CardContent>
            </Card>
          )
        ) : (
          requestSent ? (
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
                <h2 className="text-xl font-bold">E-mail verzonden</h2>
                <p className="text-muted-foreground">Als er een account bestaat met dit e-mailadres, ontvang je een link om je wachtwoord te herstellen.</p>
                <Button variant="outline" asChild className="w-full">
                  <Link to={`/shop/${tenantSlug}/login`}>Terug naar inloggen</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Wachtwoord vergeten?</CardTitle>
                <CardDescription>Vul je e-mailadres in om een herstelLink te ontvangen</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label>E-mailadres</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={processing}>
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Herstelmail verzenden
                  </Button>
                  <div className="text-center">
                    <Link to={`/shop/${tenantSlug}/login`} className="text-sm text-muted-foreground hover:text-foreground underline">
                      Terug naar inloggen
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </ShopLayout>
  );
}
