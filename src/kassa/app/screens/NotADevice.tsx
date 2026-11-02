// KASSA-ACCOUNT-1 — wat de kassa toont als de kassa-sessie geen (actief) gekoppeld toestel is:
//  - revoked: dit toestel werd ontkoppeld (in beheer of op het toestel) → opnieuw koppelen;
//  - error:   de toestelgegevens konden niet geladen worden (en er is niets bewaard) → opnieuw proberen.
// KASSA-MOBIEL-1: geen variant 'owner' meer (een eigenaar-sessie komt nooit in de kassa-client) en een terugknop
// naar beheer, behalve in de aparte Kassa-app (daar is geen beheer). "Opnieuw koppelen" meldt enkel de kassa af.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Unplug } from 'lucide-react';
import { BackToAdmin } from './BackToAdmin';

export function NotADevice({ variant, onSignOut, onRetry, hasAdmin }: {
  variant: 'revoked' | 'error';
  onSignOut: () => Promise<void> | void;
  onRetry?: () => void;
  hasAdmin: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const signOut = async () => { setBusy(true); try { await onSignOut(); } finally { setBusy(false); } };
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6" style={{ paddingTop: 'max(1.5rem, var(--safe-top))' }}>
      {hasAdmin && <BackToAdmin />}
      <Unplug className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-bold">{t(`kassa.notDevice.${variant}.title`)}</h1>
      <p className="text-sm text-muted-foreground">{t(`kassa.notDevice.${variant}.body`)}</p>
      {variant === 'error' && onRetry && (
        <button type="button" onClick={onRetry} className="flex h-12 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground">
          {t('kassa.notDevice.retry')}
        </button>
      )}
      <button type="button" onClick={signOut} disabled={busy}
        className="flex h-12 items-center justify-center gap-2 rounded-md border px-4 font-semibold disabled:opacity-50">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : t('kassa.notDevice.pairAgain')}
      </button>
    </div>
  );
}
