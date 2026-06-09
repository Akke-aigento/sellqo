import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, CheckCircle, XCircle, Mail, Lock, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { SellqoLogo } from '@/components/SellqoLogo';
import { useToast } from '@/hooks/use-toast';

type Role = 'tenant_admin' | 'staff' | 'accountant' | 'warehouse' | 'viewer' | 'marketing';

interface InviteData {
  email: string;
  role: Role;
  tenantName: string;
  tenantId: string;
  expiresAt: string;
  accountExists: boolean;
  alreadyMember: boolean;
  invitedByName: string | null;
}

type FlowState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'expired'; expiresAt?: string }
  | { kind: 'revoked' }
  | { kind: 'already_accepted' }
  | { kind: 'already_member'; tenantId: string; tenantName: string }
  | { kind: 'wrong_account'; currentEmail: string; invite: InviteData }
  | { kind: 'one_click_accept'; invite: InviteData }
  | { kind: 'login_required'; invite: InviteData }
  | { kind: 'otp_request'; invite: InviteData }
  | { kind: 'otp_verify'; invite: InviteData }
  | { kind: 'set_password'; invite: InviteData }
  | { kind: 'accepting'; invite: InviteData }
  | { kind: 'success'; tenantId: string; tenantName: string; role: Role }
  | { kind: 'error'; message: string };

const roleLabels: Record<string, string> = {
  tenant_admin: 'Admin',
  staff: 'Medewerker',
  accountant: 'Boekhouder',
  warehouse: 'Magazijn',
  viewer: 'Kijker',
  marketing: 'Marketing',
};

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <SellqoLogo variant="full" width={160} className="mx-auto mb-4" />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [state, setState] = useState<FlowState>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const acceptedRef = useRef(false);
  const resolvedTokenRef = useRef<string | null>(null);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const resolveFlow = useCallback(async () => {
    if (!token) {
      setState({ kind: 'not_found' });
      return;
    }
    if (authLoading) return;
    setState({ kind: 'loading' });
    try {
      const { data, error } = await supabase.functions.invoke('fetch-invitation', {
        body: { token },
      });
      if (error || !data || data.error) {
        setState({ kind: 'not_found' });
        return;
      }
      const invite: InviteData = {
        email: data.email,
        role: data.role,
        tenantName: data.tenantName ?? 'Onbekende winkel',
        tenantId: data.tenantId,
        expiresAt: data.expiresAt,
        accountExists: !!data.accountExists,
        alreadyMember: !!data.alreadyMember,
        invitedByName: data.invitedByName ?? null,
      };
      switch (data.status) {
        case 'accepted':
          setState({ kind: 'already_accepted' });
          return;
        case 'expired':
          setState({ kind: 'expired', expiresAt: invite.expiresAt });
          return;
        case 'revoked':
        case 'rejected':
          setState({ kind: 'revoked' });
          return;
      }
      if (invite.alreadyMember) {
        setState({ kind: 'already_member', tenantId: invite.tenantId, tenantName: invite.tenantName });
        return;
      }
      // status pending / valid
      if (!user) {
        setState(invite.accountExists
          ? { kind: 'login_required', invite }
          : { kind: 'otp_request', invite });
        return;
      }
      if (user.email?.toLowerCase() === invite.email.toLowerCase()) {
        setState({ kind: 'one_click_accept', invite });
      } else {
        setState({ kind: 'wrong_account', currentEmail: user.email || '', invite });
      }
    } catch (e: any) {
      setState({ kind: 'error', message: e?.message || 'Onbekende fout' });
    }
  }, [token, user, authLoading]);

  useEffect(() => {
    // Re-resolve when token or auth-user changes
    const key = `${token}:${user?.id ?? ''}`;
    if (resolvedTokenRef.current === key) return;
    resolvedTokenRef.current = key;
    resolveFlow();
  }, [token, user?.id, authLoading, resolveFlow]);

  // Auto-invoke accept once we're in "accepting"
  const doAccept = useCallback(async (invite: InviteData) => {
    if (acceptedRef.current) return;
    acceptedRef.current = true;
    try {
      const { data, error } = await supabase.functions.invoke('accept-team-invitation', {
        body: { token },
      });
      const apiError = data?.error || error?.message;
      const code = data?.code;
      if (apiError) {
        if (code === 'EMAIL_MISMATCH') {
          setState({ kind: 'wrong_account', currentEmail: user?.email || '', invite });
          acceptedRef.current = false;
          return;
        }
        const msg = (apiError as string).toLowerCase();
        if (msg.includes('reeds geaccepteerd') || msg.includes('al lid')) {
          setState({ kind: 'already_member', tenantId: invite.tenantId, tenantName: invite.tenantName });
          return;
        }
        if (msg.includes('verlopen')) {
          setState({ kind: 'expired', expiresAt: invite.expiresAt });
          return;
        }
        if (msg.includes('ingetrokken')) {
          setState({ kind: 'revoked' });
          return;
        }
        setState({ kind: 'error', message: apiError as string });
        return;
      }
      setState({
        kind: 'success',
        tenantId: data?.tenantId || invite.tenantId,
        tenantName: data?.tenantName || invite.tenantName,
        role: (data?.role as Role) || invite.role,
      });
    } catch (e: any) {
      acceptedRef.current = false;
      setState({ kind: 'error', message: e?.message || 'Kon uitnodiging niet accepteren' });
    }
  }, [token, user?.email]);

  useEffect(() => {
    if (state.kind === 'accepting') {
      doAccept(state.invite);
    }
  }, [state, doAccept]);

  // Auto-redirect after success
  useEffect(() => {
    if (state.kind !== 'success') return;
    const t = setTimeout(() => navigate('/admin'), 3000);
    return () => clearTimeout(t);
  }, [state, navigate]);

  // -------- Action handlers --------

  const handleLogin = async (invite: InviteData, e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password: loginPassword,
      });
      if (error) throw error;
      // useEffect re-resolves and we'll land in one_click_accept; auto-promote
      setState({ kind: 'accepting', invite });
    } catch (error: any) {
      const msg = error?.message || '';
      toast({
        title: 'Inloggen mislukt',
        description: /invalid login/i.test(msg)
          ? 'Wachtwoord onjuist. Probeer opnieuw of gebruik "Wachtwoord vergeten".'
          : msg,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (invite: InviteData) => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(invite.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Reset-mail verzonden', description: `Naar ${invite.email}` });
    } catch (e: any) {
      toast({ title: 'Reset-mail mislukte', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async (invite: InviteData) => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: invite.email,
        options: { shouldCreateUser: true, emailRedirectTo: window.location.href },
      });
      if (error) throw error;
      toast({ title: 'Code verzonden', description: `Naar ${maskEmail(invite.email)}` });
      setOtpCode('');
      setResendCooldown(30);
      setState({ kind: 'otp_verify', invite });
    } catch (e: any) {
      toast({ title: 'Versturen mislukt', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (invite: InviteData) => {
    if (otpCode.length !== 6) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: invite.email,
        token: otpCode,
        type: 'email',
      });
      if (error) throw error;
      setState({ kind: 'set_password', invite });
    } catch (e: any) {
      toast({ title: 'Onjuiste code', description: 'Probeer opnieuw.', variant: 'destructive' });
      setOtpCode('');
    } finally {
      setBusy(false);
    }
  };

  const handleSetPassword = async (invite: InviteData, e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Wachtwoord te kort', description: 'Minimum 8 tekens.', variant: 'destructive' });
      return;
    }
    if (password !== passwordConfirm) {
      toast({ title: 'Wachtwoorden komen niet overeen', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setState({ kind: 'accepting', invite });
    } catch (e: any) {
      toast({ title: 'Wachtwoord instellen mislukt', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchAccount = async (invite: InviteData) => {
    setBusy(true);
    await signOut();
    acceptedRef.current = false;
    resolvedTokenRef.current = null;
    setBusy(false);
    // resolveFlow will re-run via user?.id dependency
  };

  // ----------------- RENDER -----------------

  const roleLabel = useMemo(() => (s: FlowState): string | null => {
    if ('invite' in (s as any) && (s as any).invite) {
      return roleLabels[(s as any).invite.role] ?? (s as any).invite.role;
    }
    return null;
  }, []);

  if (state.kind === 'loading' || authLoading) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Uitnodiging laden...</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'not_found') {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Uitnodiging niet gevonden</CardTitle>
            <CardDescription>Deze uitnodiging bestaat niet of is verwijderd.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild><Link to="/">Naar homepage</Link></Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'expired') {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <CardTitle>Uitnodiging verlopen</CardTitle>
            <CardDescription>
              Deze uitnodiging is verlopen{state.expiresAt ? ` op ${new Date(state.expiresAt).toLocaleDateString('nl-NL')}` : ''}.
              Vraag de tenant-beheerder om een nieuwe uitnodiging.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild><Link to="/auth/login">Naar login</Link></Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'revoked') {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Uitnodiging ingetrokken</CardTitle>
            <CardDescription>
              Deze uitnodiging is ingetrokken. Neem contact op met de uitnodiger voor een nieuwe link.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild variant="outline"><Link to="/auth/login">Naar login</Link></Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'already_accepted') {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Al geaccepteerd</CardTitle>
            <CardDescription>Deze uitnodiging is al geaccepteerd.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild><Link to="/auth/login">Naar login</Link></Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'already_member') {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Je bent al lid van {state.tenantName}</CardTitle>
            <CardDescription>Geen actie nodig.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/admin')}>Naar dashboard</Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'wrong_account') {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Verkeerd account ingelogd</CardTitle>
            <CardDescription>
              Je bent ingelogd als <strong>{state.currentEmail}</strong>, maar deze uitnodiging is voor{' '}
              <strong>{state.invite.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={busy} onClick={() => handleSwitchAccount(state.invite)}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Uitloggen en doorgaan als {state.invite.email}
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'login_required') {
    const { invite } = state;
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welkom terug!</CardTitle>
            <CardDescription>
              Log in om <strong>{invite.tenantName}</strong> als <strong>{roleLabels[invite.role]}</strong> te accepteren.
              {invite.invitedByName ? <> Uitgenodigd door <strong>{invite.invitedByName}</strong>.</> : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleLogin(invite, e)} className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={invite.email} disabled className="pl-10 bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Wachtwoord</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pw"
                    type="password"
                    className="pl-10"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy || !loginPassword}>
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Inloggen...</> : 'Inloggen en accepteren'}
              </Button>
              <Button type="button" variant="link" className="w-full h-auto p-0 text-xs"
                onClick={() => handleForgotPassword(invite)} disabled={busy}>
                Wachtwoord vergeten?
              </Button>
            </form>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'otp_request') {
    const { invite } = state;
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle>Welkom bij {invite.tenantName}!</CardTitle>
            <CardDescription>
              We sturen je een 6-cijferige code per e-mail om je identiteit te bevestigen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={invite.email} disabled className="bg-muted" />
            </div>
            <Button className="w-full" disabled={busy} onClick={() => handleSendOtp(invite)}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Versturen...</> : 'Verstuur code'}
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'otp_verify') {
    const { invite } = state;
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <Mail className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle>Voer de code in</CardTitle>
            <CardDescription>
              We hebben een 6-cijferige code gestuurd naar <strong>{maskEmail(invite.email)}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button className="w-full" disabled={busy || otpCode.length !== 6}
              onClick={() => handleVerifyOtp(invite)}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Bevestigen...</> : 'Bevestigen'}
            </Button>
            <Button type="button" variant="link" className="w-full h-auto p-0 text-xs"
              disabled={busy || resendCooldown > 0}
              onClick={() => handleSendOtp(invite)}>
              {resendCooldown > 0
                ? `Code opnieuw versturen (${resendCooldown}s)`
                : 'Code opnieuw versturen'}
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'set_password') {
    const { invite } = state;
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>E-mail bevestigd!</CardTitle>
            <CardDescription>Kies een wachtwoord voor je account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSetPassword(invite, e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="np">Nieuw wachtwoord</Label>
                <Input id="np" type="password" minLength={8}
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np2">Wachtwoord bevestigen</Label>
                <Input id="np2" type="password" minLength={8}
                  value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opslaan...</> : 'Wachtwoord opslaan'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'one_click_accept') {
    const { invite } = state;
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Teamuitnodiging</CardTitle>
            <CardDescription>
              Welkom <strong>{user?.email}</strong>! Klik om <strong>{invite.tenantName}</strong> als{' '}
              <strong>{roleLabels[invite.role]}</strong> te accepteren.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setState({ kind: 'accepting', invite })}>
              Accepteer uitnodiging
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'accepting') {
    return (
      <Shell>
        <Card>
          <CardContent className="py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Uitnodiging accepteren...</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state.kind === 'success') {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Welkom bij {state.tenantName}!</CardTitle>
            <CardDescription>
              Je bent nu lid als <strong>{roleLabels[state.role] ?? state.role}</strong>.
              Je wordt automatisch doorgestuurd...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/admin')}>Ga naar dashboard</Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // error
  return (
    <Shell>
      <Card>
        <CardHeader className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <CardTitle>Er ging iets mis</CardTitle>
          <CardDescription>{state.kind === 'error' ? state.message : 'Onbekende fout'}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-2">
          <Button onClick={() => { acceptedRef.current = false; resolvedTokenRef.current = null; resolveFlow(); }}>
            Probeer opnieuw
          </Button>
          <Button asChild variant="link" className="text-xs">
            <Link to="/">Contact ondersteuning</Link>
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}