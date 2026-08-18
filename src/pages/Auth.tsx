import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft } from 'lucide-react';
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

/**
 * De schema's worden per render opgebouwd omdat de foutmeldingen door i18n
 * gaan; op moduleniveau is `t` niet beschikbaar. `useMemo` houdt ze stabiel
 * zolang de taal niet wisselt.
 */
type TFunc = (key: string) => string;

const buildLoginSchema = (t: TFunc) =>
  z.object({
    email: z.string().email(t('auth.validation.invalidEmail')),
    password: z.string().min(6, t('auth.validation.passwordMin')),
  });

const buildResetSchema = (t: TFunc) =>
  z.object({
    email: z.string().email(t('auth.validation.invalidEmail')),
  });

const buildSignupSchema = (t: TFunc) =>
  buildLoginSchema(t)
    .extend({
      fullName: z.string().min(2, t('auth.validation.nameMin')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.validation.passwordMismatch'),
      path: ['confirmPassword'],
    });

export default function Auth() {
  const { t } = useTranslation();
  const loginSchema = useMemo(() => buildLoginSchema(t), [t]);
  const resetSchema = useMemo(() => buildResetSchema(t), [t]);
  const signupSchema = useMemo(() => buildSignupSchema(t), [t]);
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
        setResetError(err.errors[0]?.message ?? t('auth.validation.invalidEmail'));
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
      title: t('auth.reset.toastTitle'),
      description: t('auth.reset.toastBody'),
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
          <Button
            variant="link"
            size="sm"
            onClick={() => navigate('/')}
            className="px-0 mb-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('auth.backToSite')}
          </Button>
          <div className="flex justify-center mb-8">
            <SellqoLogo variant="tagline" width={220} className="max-w-[80vw]" />
          </div>

          <Card>
            <CardHeader className="text-center">
              <h2 className="text-xl font-semibold">{t('auth.welcomeBack')}</h2>
              <CardDescription>
                {t('auth.loggedInAs', { email: user.email })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={() => navigate('/admin')}>
                {t('auth.toDashboard')}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleSwitchAccount}>
                {t('auth.switchAccount')}
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {t('auth.tagline')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <Button
          variant="link"
          size="sm"
          onClick={() => navigate('/')}
          className="px-0 mb-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('auth.backToSite')}
        </Button>
        {/* Sellqo Logo with Tagline */}
        <div className="flex justify-center mb-8">
          <SellqoLogo variant="tagline" width={220} className="max-w-[80vw]" />
        </div>

        <Card>
          <Tabs defaultValue="login">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
                <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <CardDescription className="text-center">
                    {t('auth.loginSubtitle')}
                  </CardDescription>

                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t('auth.email')}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.login_email && (
                      <p className="text-sm text-destructive">{errors.login_email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t('auth.password')}</Label>
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
                        {t('auth.loggingIn')}
                      </>
                    ) : (
                      t('auth.login')
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
                      ? t('auth.resetCooldown', { seconds: cooldown })
                      : t('auth.forgotPassword')}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  <CardDescription className="text-center">
                    {t('auth.signupSubtitle')}
                  </CardDescription>

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t('auth.fullName')}</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder={t('auth.fullNamePlaceholder')}
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.signup_fullName && (
                      <p className="text-sm text-destructive">{errors.signup_fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t('auth.email')}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {errors.signup_email && (
                      <p className="text-sm text-destructive">{errors.signup_email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t('auth.password')}</Label>
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
                    <Label htmlFor="signup-confirm">{t('auth.confirmPassword')}</Label>
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
                        {t('auth.signingUp')}
                      </>
                    ) : (
                      t('auth.signUp')
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {t('auth.tagline')}
        </p>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('auth.resetPassword')}</DialogTitle>
            <DialogDescription>
              {t('auth.reset.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t('auth.email')}</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
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
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={resetSubmitting}>
                {resetSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.reset.sending')}
                  </>
                ) : (
                  t('auth.reset.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
