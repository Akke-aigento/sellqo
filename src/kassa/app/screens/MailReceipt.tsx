// PRINT-2 — knop "Mail bon" na afrekenen (enkel als de zaak hem aanzette in Kassa › Bon & printers).
// De kassa vraagt nooit zelf naar een e-mailadres: pas na een tik op de knop verschijnt het veld.
// Het betaalbewijs wordt door de server opgemaakt uit de betaling (horeca-receipt-mail); het adres
// wordt niet bewaard.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type State = 'closed' | 'open' | 'sending' | 'sent';

export function MailReceipt({ paymentId }: { paymentId: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>('closed');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const to = email.trim();
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i.test(to)) { setError(t('kassa.pay.mailInvalid')); return; }
    setState('sending');
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('horeca-receipt-mail', { body: { source: 'kassa', payment_id: paymentId, email: to } });
      const code = (data as { error?: string } | null)?.error;
      if (err || code) {
        setState('open');
        const status = (err as { context?: { status?: number } } | null)?.context?.status;
        setError(status === 429 || code === 'limit' ? t('kassa.pay.mailLimit') : t('kassa.pay.mailFailed'));
        return;
      }
      setState('sent');
    } catch {
      setState('open');
      setError(t('kassa.pay.mailFailed'));
    }
  };

  if (state === 'sent') {
    return <p role="status" className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"><Check className="h-4 w-4" /> {t('kassa.pay.mailSent', { email: email.trim() })}</p>;
  }
  if (state === 'closed') {
    return (
      <button type="button" onClick={() => setState('open')} className="flex h-11 w-full items-center justify-center gap-2 rounded-md border font-semibold">
        <Mail className="h-4 w-4" /> {t('kassa.pay.mailButton')}
      </button>
    );
  }
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <label htmlFor="mail-receipt" className="text-sm font-medium">{t('kassa.pay.mailLabel')}</label>
      <div className="flex gap-2">
        <input id="mail-receipt" type="email" inputMode="email" autoComplete="off" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-base" placeholder={t('kassa.pay.mailPlaceholder')} />
        <button type="submit" disabled={state === 'sending' || !email.trim()} className="flex h-11 shrink-0 items-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
          {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t('kassa.pay.mailSend')}
        </button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
