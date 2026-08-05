import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  CalendarClock,
  FileText,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PricingPlan } from '@/types/billing';

type Step = 'plan' | 'method';

interface PlanActivationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PricingPlan | null;
  interval: 'monthly' | 'yearly';
  isUpgrade: boolean;
  /** Tenant already has a mandate (active/processing) or chose manual. */
  hasPaymentPath: boolean;
  /** Plan is free — no payment path required. */
  isFree: boolean;
  isActivating: boolean;
  isCreatingMandate: boolean;
  /** UX-UNIFY-2 — persists the half state and redirects to the mandate page. */
  onCreateMandate: () => Promise<void>;
  onChooseManual: () => Promise<void>;
  onConfirm: () => Promise<void>;
}

/**
 * UX-UNIFY-1 — plan-first wizard. Step 1 carries the former
 * PlanChangeConfirmDialog content (the two laws, period price only, never a
 * pro-rata promise). Step 2 only appears when there is no payment path yet.
 * UX-UNIFY-2 — choosing direct debit redirects straight to the mandate page.
 */
export function PlanActivationWizard({
  open,
  onOpenChange,
  plan,
  interval,
  isUpgrade,
  hasPaymentPath,
  isFree,
  isActivating,
  isCreatingMandate,
  onCreateMandate,
  onChooseManual,
  onConfirm,
}: PlanActivationWizardProps) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<Step>('plan');

  useEffect(() => {
    if (open) setStep('plan');
  }, [open]);

  const price = plan ? Number(interval === 'yearly' ? plan.yearly_price : plan.monthly_price) : 0;
  const formatted = new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
  const periodLabel =
    interval === 'yearly'
      ? t('billing.plan_change.per_year')
      : t('billing.plan_change.per_month');

  const skipMethodStep = hasPaymentPath || isFree;

  const handleOpenChange = (next: boolean) => onOpenChange(next);

  const priceBlock = (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span>{periodLabel}</span>
        <span className="font-semibold">{formatted}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{t('billing.plan_change.vat_note')}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        {step === 'plan' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isUpgrade ? (
                  <ArrowUp className="h-5 w-5 text-primary" />
                ) : (
                  <ArrowDown className="h-5 w-5 text-muted-foreground" />
                )}
                {t('billing.plan_change.title', { plan: plan?.name ?? '' })}
              </DialogTitle>
              <DialogDescription>
                {isUpgrade
                  ? t('billing.plan_change.upgrade_body')
                  : t('billing.plan_change.downgrade_body')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {priceBlock}
              {!isUpgrade && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-4 w-4 shrink-0 mt-0.5" />
                  {t('billing.plan_change.downgrade_note')}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isActivating}>
                {t('billing.plan_change.cancel')}
              </Button>
              {skipMethodStep ? (
                <Button onClick={() => onConfirm()} disabled={isActivating}>
                  {isActivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('billing.plan_change.confirm')}
                </Button>
              ) : (
                <Button onClick={() => setStep('method')}>
                  {t('billing.wizard.next_payment')}
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {step === 'method' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('billing.wizard.method_title')}</DialogTitle>
              <DialogDescription>
                {t('billing.wizard.method_subtitle', { plan: plan?.name ?? '' })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {priceBlock}
              <button
                type="button"
                onClick={() => onCreateMandate()}
                disabled={isCreatingMandate}
                className="w-full text-left rounded-lg border p-3 hover:bg-accent transition-colors disabled:opacity-60"
              >
                <div className="flex items-center gap-2 font-medium">
                  {isCreatingMandate ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Banknote className="h-4 w-4" />
                  )}
                  {t('billing.wizard.option_mandate_title')}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('billing.wizard.option_mandate_desc')}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onChooseManual()}
                disabled={isActivating}
                className="w-full text-left rounded-lg border p-3 hover:bg-accent transition-colors disabled:opacity-60"
              >
                <div className="flex items-center gap-2 font-medium">
                  {isActivating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {t('billing.wizard.option_manual_title')}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('billing.wizard.option_manual_desc')}
                </p>
              </button>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep('plan')} disabled={isActivating}>
                {t('billing.wizard.back')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
