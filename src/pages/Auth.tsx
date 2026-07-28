import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { SellqoLogo } from '@/components/SellqoLogo';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens zijn'),
});

const resetSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Naam moet minimaal 2 tekens zijn'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Wachtwoorden komen niet overeen',
  path: ['confirmPassword'],
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp, signOut, resetPassword } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAccountSwitch, setShowAccountSwitch] = useState(false);

  // Forgot-password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');

  const handleSwitchAccount = async () => {
    await signOut();
    setShowAccountSwitch(true);
  };

  const openReset = () => {
    setResetError(null);
    setResetEmail(loginEmail || '');
    setResetOpen(true);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    try {
      resetSchema.parse({ email: resetEmail });
    } catch (err) {
      if (err instanceof z.ZodError) {
        setResetError(err.errors[0]?.message ?? 'Ongeldig e-mailadres');
        return;
      }
    }

    setResetSubmitting(true);
    // Bewust GEEN onderscheid maken tussen bestaand/onbestaand adres
    // of tussen success/error, om account-enumeratie te vermijden.
    const { error } = await resetPassword(resetEmail);
    if (error) {
      console.error('[Auth] resetPassword error:', error);
    }
    setResetSubmitting(false);
    setResetOpen(false);
    setCooldown(60);
    toast({
      title: 'Controleer je inbox',
      description:
        'Als er een account bestaat op dit adres, is er een e-mail met een reset-link verstuurd. Het kan enkele minuten duren.',
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            fieldErrors[`login_${error.path[0]}`] = error.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);

    if (!error) {
      navigate('/admin');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      signupSchema.parse({
        email: signupEmail,
        password: signupPassword,
        confirmPassword: signupConfirmPassword,
        fullName: signupFullName,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            fieldErrors[`signup_${error.path[0]}`] = error.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword, signupFullName);
    setIsSubmitting(false);

    if (!error) {
      // Auto login after signup since email is auto-confirmed
      await signIn(signupEmail, signupPassword);
      navigate('/admin');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show choice screen for logged-in users
  if (user && !showAccountSwitch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <SellqoLogo variant="tagline" width={220} className="max-w-[80vw]" />
          </div>

          <Card>
            <CardHeader className="text-center">
              <h2 className="text-xl font-semibold">Welkom terug!</h2>
              <CardDescription>
                Je bent ingelogd als {user.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={() => navigate('/admin')}>
                Naar mijn dashboard
              </Button>
              <Button variant="outline" className="w-full" onClick={handleSwitchAccount}>
                Wissel van account
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Jouw webshop. Simpel online.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        {/* Sellqo Logo with Tagline */}
        <div className="flex justify-center mb-8">
          <SellqoLogo variant="tagline" width={220} className="max-w-[80vw]" />
        </div>

        <Card>
          <Tabs defaultValue="login">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Inloggen</TabsTrigger>
                <TabsTrigger value="signup">Registreren</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <CardDescription className="text-center">
                    Log in met je e-mail en wachtwoord
                  </CardDescription>

                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="naam@voorbeeld.nl"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.login_email && (
                      <p className="text-sm text-destructive">{errors.login_email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Wachtwoord</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.login_password && (
                      <p className="text-sm text-destructive">{errors.login_password}</p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex-col gap-2">
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Bezig met inloggen...
                      </>
                    ) : (
                      'Inloggen'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={openReset}
                    disabled={cooldown > 0}
                  >
                    {cooldown > 0
                      ? `Opnieuw mogelijk over ${cooldown}s`
                      : 'Wachtwoord vergeten?'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  <CardDescription className="text-center">
                    Maak een nieuw account aan
                  </CardDescription>

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Volledige naam</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Jan Jansen"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.signup_fullName && (
                      <p className="text-sm text-destructive">{errors.signup_fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="naam@voorbeeld.nl"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.signup_email && (
                      <p className="text-sm text-destructive">{errors.signup_email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Wachtwoord</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.signup_password && (
                      <p className="text-sm text-destructive">{errors.signup_password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Bevestig wachtwoord</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.signup_confirmPassword && (
                      <p className="text-sm text-destructive">{errors.signup_confirmPassword}</p>
                    )}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Bezig met registreren...
                      </>
                    ) : (
                      'Registreren'
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Jouw webshop. Simpel online.
        </p>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wachtwoord opnieuw instellen</DialogTitle>
            <DialogDescription>
              Vul je e-mailadres in. We sturen je een link om een nieuw wachtwoord
              in te stellen. Controleer ook je spam-map als je niets ontvangt.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-mail</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="naam@voorbeeld.nl"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={resetSubmitting}
                autoFocus
              />
              {resetError && (
                <p className="text-sm text-destructive">{resetError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetOpen(false)}
                disabled={resetSubmitting}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={resetSubmitting}>
                {resetSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Versturen...
                  </>
                ) : (
                  'Reset-link versturen'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
