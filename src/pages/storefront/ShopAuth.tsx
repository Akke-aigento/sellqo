import { useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { useStorefrontAuth } from '@/context/StorefrontAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';

export default function ShopAuth() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = usePublicStorefront(tenantSlug || '');
  const { login, register, isAuthenticated } = useStorefrontAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || `/shop/${tenantSlug}/account`;

  const [activeTab, setActiveTab] = useState('login');
  const [processing, setProcessing] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regNewsletter, setRegNewsletter] = useState(false);
  const [regIsB2b, setRegIsB2b] = useState(false);
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regVatNumber, setRegVatNumber] = useState('');

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate(redirectTo, { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) { toast.error('Vul alle velden in'); return; }
    setProcessing(true);
    const result = await login(loginEmail, loginPassword);
    setProcessing(false);
    if (result.success) {
      toast.success('Succesvol ingelogd');
      navigate(redirectTo, { replace: true });
    } else {
      toast.error(result.error || 'Inloggen mislukt');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regFirstName || !regLastName) { toast.error('Vul alle velden in'); return; }
    if (regPassword !== regConfirm) { toast.error('Wachtwoorden komen niet overeen'); return; }
    if (regPassword.length < 8) { toast.error('Wachtwoord moet minimaal 8 tekens bevatten'); return; }
    setProcessing(true);
    const result = await register({ email: regEmail, password: regPassword, first_name: regFirstName, last_name: regLastName });
    setProcessing(false);
    if (result.success) {
      toast.success('Account aangemaakt!');
      navigate(redirectTo, { replace: true });
    } else {
      toast.error(result.error || 'Registratie mislukt');
    }
  };

  return (
    <ShopLayout>
      <Helmet>
        <title>Inloggen | {tenant?.name || 'Shop'}</title>
      </Helmet>
      <div className="container mx-auto px-4 py-12 max-w-md">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Inloggen</TabsTrigger>
            <TabsTrigger value="register">Registreren</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Inloggen</CardTitle>
                <CardDescription>Log in op je account</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mailadres</Label>
                    <Input id="login-email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Wachtwoord</Label>
                    <Input id="login-password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={processing}>
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Inloggen
                  </Button>
                  <div className="text-center">
                    <Link to={`/shop/${tenantSlug}/reset-password`} className="text-sm text-muted-foreground hover:text-foreground underline">
                      Wachtwoord vergeten?
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Account aanmaken</CardTitle>
                <CardDescription>Maak een account aan om je bestellingen te volgen</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-first">Voornaam</Label>
                      <Input id="reg-first" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-last">Achternaam</Label>
                      <Input id="reg-last" value={regLastName} onChange={e => setRegLastName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">E-mailadres</Label>
                    <Input id="reg-email" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Wachtwoord</Label>
                    <Input id="reg-password" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Minimaal 8 tekens" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Bevestig wachtwoord</Label>
                    <Input id="reg-confirm" type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={processing}>
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Account aanmaken
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ShopLayout>
  );
}
