// KASSA-ACCOUNT-1 — wat de kassa toont als de sessie geen (actief) gekoppeld toestel is:
//  - owner:   een gewone SellQo-account opent /kassa → geen kassa met eigenaarsrechten, wel uitleg + link naar beheer;
//  - revoked: dit toestel werd ontkoppeld (in beheer of op het toestel) → opnieuw koppelen;
//  - error:   de toestelgegevens konden niet geladen worden (en er is niets bewaard) → opnieuw proberen.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Loader2, Unplug } from 'lucide-react';
import { PUBLIC_SITE_URL } from '@/lib/siteUrl';
import { adminHref } from '../horeca/quickTap';

export function NotADevice({ variant, onSignOut, onRetry }: { variant: 'owner' | 'revoked' | 'error'; onSignOut: () => Promise<void> | void; onRetry?: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const admin = adminHref(window.location.pathname, PUBLIC_SITE_URL);
  const posHref = `${admin.href}/pos`;
  const signOut = async () => { setBusy(true); try { await onSignOut(); } finally { setBusy(false); } };
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6" style={{ paddingTop: 'max(1.5rem, var(--safe-top))' }}>
      <Unplug className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-bold">{t(`kassa.notDevice.${variant}.title`)}</h1>
      <p className="text-sm text-muted-foreground">{t(`kassa.notDevice.${variant}.body`)}</p>
      {variant === 'owner' && (
        <a href={posHref} {...(admin.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground">
          <ExternalLink className="h-4 w-4" />{t('kassa.notDevice.toPos')}
        </a>
      )}
      {variant === 'error' && onRetry && (
        <button type="button" onClick={onRetry} className="flex h-12 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground">
          {t('kassa.notDevice.retry')}
        </button>
      )}
      <button type="button" onClick={signOut} disabled={busy}
        className="flex h-12 items-center justify-center gap-2 rounded-md border px-4 font-semibold disabled:opacity-50">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : t(variant === 'owner' ? 'kassa.notDevice.signOutAndPair' : 'kassa.notDevice.pairAgain')}
      </button>
    </div>
  );
}
