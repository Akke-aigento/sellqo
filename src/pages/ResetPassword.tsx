import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Lock } from 'lucide-react';
import { SellqoLogo } from '@/components/SellqoLogo';
import { useToast } from '@/hooks/use-toast';

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

type Status = 'checking' | 'ready' | 'invalid' | 'success';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase v2 places the recovery session in the URL hash. The client
    // auto-parses it and fires PASSWORD_RECOVERY. If we already have a
    // session at mount, we can proceed too.
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') setStatus('ready');
    });

    (async () => {
      // Give Supabase a tick to consume the URL hash.
      await new Promise((r) => setTimeout(r, 250));
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setStatus('ready');
      } else {
        // Poll briefly for hash consumption on slow devices.
        setTimeout(async () => {
          if (!mounted) return;
          const { data: retry } = await supabase.auth.getSession();
          setStatus(retry.session ? 'ready' : 'invalid');
        }, 800);
      }
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Wachtwoord te kort', description: 'Minimum 8 tekens.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Wachtwoorden komen niet overeen', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus('success');
      toast({ title: 'Wachtwoord bijgewerkt' });
      setTimeout(() => navigate('/admin', { replace: true }), 1200);
    } catch (err: any) {
      console.error('[ResetPassword]', err);
      toast({ title: 'Wijzigen mislukt', description: err?.message ?? 'Onbekende fout', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (status === 'checking') {
    return (
      <Shell>
        <Card>
          <CardContent className="py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Reset-link controleren…</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (status === 'invalid') {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Link ongeldig of verlopen</CardTitle>
            <CardDescription>
              Deze reset-link is niet meer geldig. Vraag een nieuwe reset-mail aan via het loginscherm.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild><Link to="/auth">Naar login</Link></Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (status === 'success') {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Wachtwoord bijgewerkt</CardTitle>
            <CardDescription>Je wordt doorgestuurd…</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <CardHeader className="text-center">
          <Lock className="h-12 w-12 text-primary mx-auto mb-2" />
          <CardTitle>Kies een nieuw wachtwoord</CardTitle>
          <CardDescription>Minimaal 8 tekens.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np">Nieuw wachtwoord</Label>
              <Input id="np" type="password" minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np2">Wachtwoord bevestigen</Label>
              <Input id="np2" type="password" minLength={8} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opslaan…</> : 'Wachtwoord instellen'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}