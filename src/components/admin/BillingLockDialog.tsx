import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBillingState } from '@/hooks/useBillingState';
import { useTenant } from '@/hooks/useTenant';
import { BILLING_LOCK_OPEN_EVENT } from '@/lib/billingLock';

const seenKey = (tenantId?: string | null) => `billing_lock_seen_${tenantId ?? 'unknown'}`;

/**
 * BILL-LOCK-1 — popup bij het openen van een winkel in leesmodus.
 *
 * De banner (BillingStateBanner) blijft het permanente signaal; deze dialog zegt
 * het één keer per sessie per winkel luid: je winkel staat op slot, zo betaal je.
 * Sluiten mag altijd — de winkel blijft leesbaar en de betaalpagina bereikbaar.
 * Een klik op de banner opent hem opnieuw (openBillingLockDialog).
 * Platform-admins, demo- en vrijgestelde winkels zien hem nooit: useBillingState
 * geeft voor hen altijd 'active'.
 */
export function BillingLockDialog() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { state, openAmount, payUrl, isLoading } = useBillingState();
  const locked = state === 'restricted' || state === 'suspended';

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || !locked || !currentTenant?.id) {
      setOpen(false);
      return;
    }
    let seen = false;
    try {
      seen = sessionStorage.getItem(seenKey(currentTenant.id)) === '1';
    } catch {
      seen = false;
    }
    setOpen(!seen);
  }, [isLoading, locked, currentTenant?.id]);

  useEffect(() => {
    const reopen = () => { if (locked) setOpen(true); };
    window.addEventListener(BILLING_LOCK_OPEN_EVENT, reopen);
    return () => window.removeEventListener(BILLING_LOCK_OPEN_EVENT, reopen);
  }, [locked]);

  const close = () => {
    try {
      sessionStorage.setItem(seenKey(currentTenant?.id), '1');
    } catch {
      // geen storage (privévenster, app-preview): dan sluit hij alleen voor nu
    }
    setOpen(false);
  };

  if (!locked) return null;

  const amount = openAmount > 0
    ? new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(openAmount)
    : '';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Lock className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center">{t(`billing.state.${state}.title`)}</DialogTitle>
          <DialogDescription className="text-center">
            {t(`billing.state.${state}.body`, { amount })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {payUrl && (
            <Button asChild className="w-full">
              <a href={payUrl} rel="noopener noreferrer" onClick={close}>{t('billing.state.payNow')}</a>
            </Button>
          )}
          <Button asChild variant={payUrl ? 'outline' : 'default'} className="w-full">
            <Link to="/admin/billing" onClick={close}>{t('billing.state.toBilling')}</Link>
          </Button>
          <Button variant="ghost" className="w-full" onClick={close}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
