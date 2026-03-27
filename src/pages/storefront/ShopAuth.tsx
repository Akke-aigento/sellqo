import { useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { useStorefrontAuth } from '@/context/StorefrontAuthContext';
import { useStorefrontCustomerApi } from '@/hooks/useStorefrontCustomerApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
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
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { invoke } = useStorefrontCustomerApi();

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
      const errMsg = result.error || 'Inloggen mislukt';
      if (errMsg.startsWith('EMAIL_NOT_VERIFIED:')) {
        setUnverifiedEmail(loginEmail);
        toast.error(errMsg.replace('EMAIL_NOT_VERIFIED:', ''));
      } else {
        toast.error(errMsg);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regFirstName || !regLastName) { toast.error('Vul alle velden in'); return; }
    if (regPassword !== regConfirm) { toast.error('Wachtwoorden komen niet overeen'); return; }
    if (regPassword.length < 8) { toast.error('Wachtwoord moet minimaal 8 tekens bevatten'); return; }
    if (regIsB2b && !regCompanyName) { toast.error('Vul een bedrijfsnaam in'); return; }
    setProcessing(true);
    const result = await register({
      email: regEmail,
      password: regPassword,
      first_name: regFirstName,
      last_name: regLastName,
      newsletter_opt_in: regNewsletter,
      company_name: regIsB2b ? regCompanyName : undefined,
      vat_number: regIsB2b && regVatNumber ? regVatNumber : undefined,
    } as any);
    setProcessing(false);
    if (result.success) {
      // New flow: check if requires_verification
      setRegistrationSuccess(true);
      toast.success('Controleer je e-mail om je account te bevestigen');
    } else {
      toast.error(result.error || 'Registratie mislukt');
    }
  };

  const handleResendVerification = async (email: string) => {
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
                   {unverifiedEmail && (
                     <div className="p-3 rounded-lg bg-muted text-center space-y-2">
                       <p className="text-sm text-muted-foreground">Je e-mailadres is nog niet bevestigd.</p>
                       <Button variant="outline" size="sm" onClick={() => handleResendVerification(unverifiedEmail)} disabled={resending}>
                         {resending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                         Verificatiemail opnieuw versturen
                       </Button>
                     </div>
                   )}
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
                <CardTitle>{registrationSuccess ? 'Controleer je e-mail' : 'Account aanmaken'}</CardTitle>
                <CardDescription>{registrationSuccess ? 'We hebben een verificatiemail verstuurd' : 'Maak een account aan om je bestellingen te volgen'}</CardDescription>
              </CardHeader>
              <CardContent>
                {registrationSuccess ? (
                  <div className="text-center space-y-4 py-4">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                    <p className="text-muted-foreground">
                      We hebben een verificatiemail verstuurd naar <strong>{regEmail}</strong>. Klik op de link in de e-mail om je account te bevestigen.
                    </p>
                    <p className="text-sm text-muted-foreground">Geen e-mail ontvangen? Controleer je spam-map of</p>
                    <Button variant="outline" onClick={() => handleResendVerification(regEmail)} disabled={resending}>
                      {resending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                      Verificatiemail opnieuw versturen
                    </Button>
                    <div>
                      <Button variant="ghost" onClick={() => { setRegistrationSuccess(false); setActiveTab('login'); }}>
                        Ga naar inloggen
                      </Button>
                    </div>
                  </div>
                ) : (
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
                  <div className="flex items-center space-x-2">
                    <Checkbox id="reg-newsletter" checked={regNewsletter} onCheckedChange={(c) => setRegNewsletter(!!c)} />
                    <Label htmlFor="reg-newsletter" className="text-sm cursor-pointer">Aanmelden voor nieuwsbrief</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="reg-b2b" checked={regIsB2b} onCheckedChange={(c) => setRegIsB2b(!!c)} />
                    <Label htmlFor="reg-b2b" className="text-sm cursor-pointer">Ik bestel namens een bedrijf</Label>
                  </div>
                  {regIsB2b && (
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                      <div className="space-y-2">
                        <Label htmlFor="reg-company">Bedrijfsnaam *</Label>
                        <Input id="reg-company" value={regCompanyName} onChange={e => setRegCompanyName(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-vat">BTW-nummer (optioneel)</Label>
                        <Input id="reg-vat" value={regVatNumber} onChange={e => setRegVatNumber(e.target.value.toUpperCase())} placeholder="BE0123456789" />
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={processing}>
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Account aanmaken
                  </Button>
                </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ShopLayout>
  );
}
