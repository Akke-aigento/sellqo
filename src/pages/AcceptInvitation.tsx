import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Mail, Lock, User } from 'lucide-react';
import { SellqoLogo } from '@/components/SellqoLogo';
import { useToast } from '@/hooks/use-toast';

type InvitationStatus = 'loading' | 'valid' | 'expired' | 'accepted' | 'not_found' | 'error';

interface InvitationData {
  email: string;
  role: string;
  tenantName: string;
  expiresAt: string;
}

const roleLabels: Record<string, string> = {
  tenant_admin: 'Admin',
  staff: 'Medewerker',
  accountant: 'Boekhouder',
  warehouse: 'Magazijn',
  viewer: 'Kijker',
};

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<InvitationStatus>('loading');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

  // Registration form state — default to register for new users
  const [showRegister, setShowRegister] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setStatus('not_found');
        return;
      }

      try {
        const response = await supabase.functions.invoke('fetch-invitation', {
          body: { token },
        });

        if (response.error) {
          setStatus('not_found');
          return;
        }

        const data = response.data;

        if (!data || data.error) {
          setStatus('not_found');
          return;
        }

        if (data.status === 'accepted') {
          setStatus('accepted');
          return;
        }

        if (data.status === 'expired') {
          setStatus('expired');
          return;
        }

        setInvitation({
          email: data.email,
          role: data.role,
          tenantName: data.tenantName,
          expiresAt: data.expiresAt,
        });
        setEmail(data.email);
        setStatus('valid');
      } catch (error) {
        console.error('Error fetching invitation:', error);
        setStatus('error');
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    setIsAccepting(true);
    try {
      const response = await supabase.functions.invoke('accept-team-invitation', {
        body: { token },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message);
      }

      toast({
        title: 'Uitnodiging geaccepteerd!',
        description: `Je bent nu lid van ${response.data.tenantName}`,
      });

      navigate('/admin');
    } catch (error: any) {
      toast({
        title: 'Fout bij accepteren',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          emailRedirectTo: window.location.href,
          data: { full_name: fullName },
        },
      });

      if (error) throw error;

      // Try auto sign-in (works if email confirmation is disabled)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password,
      });

      if (signInError) {
        // Email confirmation required — show confirmation message
        setEmailConfirmationSent(true);
      }
      // If sign-in succeeded, the auth state change will trigger handleAccept
    } catch (error: any) {
      toast({
        title: 'Registratie mislukt',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      // Auth state change will handle the rest
    } catch (error: any) {
      toast({
        title: 'Inloggen mislukt',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-accept when user logs in
  useEffect(() => {
    if (user && status === 'valid' && invitation) {
      if (user.email?.toLowerCase() === invitation.email.toLowerCase()) {
        handleAccept();
      }
    }
  }, [user, status, invitation]);

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Uitnodiging laden...</p>
        </div>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Uitnodiging niet gevonden</CardTitle>
            <CardDescription>
              Deze uitnodiging bestaat niet of is verwijderd.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/">Naar homepage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Uitnodiging verlopen</CardTitle>
            <CardDescription>
              Deze uitnodiging is niet meer geldig. Vraag de beheerder om een nieuwe uitnodiging te versturen.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/">Naar homepage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Al geaccepteerd</CardTitle>
            <CardDescription>
              Deze uitnodiging is al geaccepteerd.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/admin">Naar dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Email confirmation sent — show waiting screen
  if (emailConfirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <SellqoLogo variant="full" width={160} className="mx-auto mb-4" />
          </div>
          <Card>
            <CardHeader className="text-center">
              <Mail className="h-12 w-12 text-primary mx-auto mb-2" />
              <CardTitle>Bevestig je e-mailadres</CardTitle>
              <CardDescription>
                Je account is aangemaakt! We hebben een bevestigingsmail gestuurd naar <strong>{invitation?.email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Klik op de link in de e-mail om je account te bevestigen. Daarna word je automatisch gekoppeld aan <strong>{invitation?.tenantName}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Geen e-mail ontvangen? Controleer je spamfolder.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <SellqoLogo variant="full" width={160} className="mx-auto mb-4" />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Teamuitnodiging</CardTitle>
            <CardDescription>
              Je bent uitgenodigd voor <strong>{invitation?.tenantName}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-center">
              <p className="text-sm text-muted-foreground mb-1">Jouw rol:</p>
              <p className="font-semibold text-lg">
                {roleLabels[invitation?.role || ''] || invitation?.role}
              </p>
            </div>

            {user ? (
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  Ingelogd als <strong>{user.email}</strong>
                </p>
                <Button
                  className="w-full"
                  onClick={handleAccept}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Accepteren...
                    </>
                  ) : (
                    'Uitnodiging accepteren'
                  )}
                </Button>
              </div>
            ) : showRegister ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Naam</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Je volledige naam"
                      className="pl-10"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={invitation?.email || ''}
                      disabled
                      className="pl-10 bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Nieuw wachtwoord</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Kies een wachtwoord"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Account aanmaken...
                    </>
                  ) : (
                    'Account aanmaken en accepteren'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowRegister(false)}
                >
                  Ik heb al een account
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Wachtwoord</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Je wachtwoord"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Inloggen...
                    </>
                  ) : (
                    'Inloggen en accepteren'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowRegister(true)}
                >
                  Nog geen account? Registreren
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
