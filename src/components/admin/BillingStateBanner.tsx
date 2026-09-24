import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBillingState } from '@/hooks/useBillingState';

/**
 * BILLING-ENFORCE-1 — één regel die zegt wat er aan de hand is en hoe je het
 * oplost. Verschijnt bij een openstaande betaling (past_due) en in leesmodus
 * (restricted/suspended); de betaalpagina blijft in elke toestand bereikbaar.
 */
export function BillingStateBanner() {
  const { t } = useTranslation();
  const { state, openAmount, payUrl } = useBillingState();

  if (state === 'active' || state === 'trialing') return null;

  const isLocked = state === 'restricted' || state === 'suspended';
  const amount = openAmount > 0
    ? new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(openAmount)
    : null;

  return (
    <div
      role="status"
      className={cn(
        // Mobiel stapelt de knop onder de tekst; min-w-0 + truncate houdt een lang
        // bedrag binnen de rand (M4).
        'mx-3 mt-2 flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between',
        isLocked ? 'border-destructive/30 bg-destructive/10' : 'border-amber-500/30 bg-amber-500/10',
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {isLocked
          ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}
        <p className="min-w-0">
          <span className="font-medium">{t(`billing.state.${state}.title`)}</span>{' '}
          <span className="text-muted-foreground">
            {t(`billing.state.${state}.body`, { amount: amount ?? '' })}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {payUrl && (
          <Button asChild size="sm">
            <a href={payUrl} rel="noopener noreferrer">{t('billing.state.payNow')}</a>
          </Button>
        )}
        <Button asChild size="sm" variant={payUrl ? 'outline' : 'default'}>
          <Link to="/admin/billing">{t('billing.state.toBilling')}</Link>
        </Button>
      </div>
    </div>
  );
}
