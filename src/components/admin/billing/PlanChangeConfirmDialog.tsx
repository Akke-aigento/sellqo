import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, CalendarClock, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PricingPlan } from '@/types/billing';

interface PlanChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PricingPlan | null;
  interval: 'monthly' | 'yearly';
  isUpgrade: boolean;
  isPending: boolean;
  onConfirm: () => void;
}

/**
 * sync-tenant-plan has no preview action, so this dialog explains the two laws
 * (upgrade = immediate with pro-rata settlement on the next invoice, downgrade
 * = effective at the period boundary) and shows the new period price only —
 * never a pro-rata amount we cannot compute client-side.
 */
export function PlanChangeConfirmDialog({
  open,
  onOpenChange,
  plan,
  interval,
  isUpgrade,
  isPending,
  onConfirm,
}: PlanChangeConfirmDialogProps) {
  const { t, i18n } = useTranslation();

  const price = plan
    ? Number(interval === 'yearly' ? plan.yearly_price : plan.monthly_price)
    : 0;
  const formatted = new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: 'EUR',
  }).format(price);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isUpgrade ? (
              <ArrowUp className="h-5 w-5 text-primary" />
            ) : (
              <ArrowDown className="h-5 w-5 text-muted-foreground" />
            )}
            {t('billing.plan_change.title', { plan: plan?.name ?? '' })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                {isUpgrade
                  ? t('billing.plan_change.upgrade_body')
                  : t('billing.plan_change.downgrade_body')}
              </p>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    {interval === 'yearly'
                      ? t('billing.plan_change.per_year')
                      : t('billing.plan_change.per_month')}
                  </span>
                  <span className="font-semibold">{formatted}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('billing.plan_change.vat_note')}
                </p>
              </div>
              {!isUpgrade && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-4 w-4 shrink-0 mt-0.5" />
                  {t('billing.plan_change.downgrade_note')}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t('billing.plan_change.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('billing.plan_change.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}