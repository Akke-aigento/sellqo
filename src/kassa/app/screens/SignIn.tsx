// PERSONEEL-1 — het toestel meldt zich aan met een SellQo-account van de zaak (beheerder of
// medewerker). Daarna werkt het personeel met een PIN; dit scherm komt pas terug na afmelden.
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function SignIn() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(true);
  };

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-3 p-6">
      <h1 className="text-xl font-bold">{t('kassa.signIn.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('kassa.signIn.intro')}</p>
      <label className="space-y-1 text-sm">
        <span className="font-medium">{t('kassa.signIn.email')}</span>
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-md border bg-background px-3" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">{t('kassa.signIn.password')}</span>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-md border bg-background px-3" />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{t('kassa.signIn.error')}</p>}
      <button type="submit" disabled={busy} className="flex h-11 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t('kassa.signIn.submit')}
      </button>
    </form>
  );
}
