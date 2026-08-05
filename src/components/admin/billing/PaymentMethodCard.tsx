import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlatformBillingStatus, PlatformPaymentMode } from '@/hooks/usePlatformBillingStatus';

interface PaymentMethodCardProps {
  status: PlatformBillingStatus | null | undefined;
  isLoading: boolean;
  /** Locally chosen mode while there is no billing subscription yet. */
  pendingMode: PlatformPaymentMode | null;
  isMutating: boolean;
  onSetupMandate: () => void;
  onChooseManual: () => void;
  /** UX-UNIFY-1: there is a live (paid) platform subscription. */
  hasSubscription: boolean;
}

export function PaymentMethodCard({
  status,
  isLoading,
  pendingMode,
  isMutating,
  onSetupMandate,
  onChooseManual,
  hasSubscription,
}: PaymentMethodCardProps) {
  const { t } = useTranslation();

  const mandate = status?.mandate ?? null;
  const mandateActive = mandate?.status === 'active';
  const mandatePending = mandate?.status === 'pending';
  const mandateFailed = mandate?.status === 'failed';
  const effectiveMode: PlatformPaymentMode | null = status?.payment_mode ?? pendingMode;
  const isManual = effectiveMode === 'manual';

  // UX-UNIFY-1: the card is management-only. Without a subscription AND without
  // a payment method there is nothing to manage — the plan picker is the CTA.
  if (!isLoading && !hasSubscription && !mandate && !isManual) return null;

  const methodLabel =
    mandate?.method_type === 'card'
      ? t('billing.payment.method_card')
      : t('billing.payment.method_sepa');

  const showHalfStateHint = !hasSubscription && (!!mandate || isManual) && !mandateFailed;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t('billing.payment.title')}
        </CardTitle>
        <CardDescription>{t('billing.payment.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : mandate && !mandateFailed ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="font-medium">{methodLabel}</span>
              <Badge variant={mandateActive ? 'default' : 'secondary'}>
                {mandateActive
                  ? t('billing.payment.mandate_active')
                  : t('billing.payment.mandate_processing')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t('billing.payment.mandate_desc')}</p>
            {showHalfStateHint && (
              <p className="text-sm font-medium">{t('billing.payment.half_hint')}</p>
            )}
            <Button variant="outline" size="sm" onClick={onSetupMandate} disabled={isMutating}>
              {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('billing.payment.replace')}
            </Button>
          </div>
        ) : isManual ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{t('billing.payment.manual_title')}</span>
              <Badge variant="secondary">{t('billing.payment.manual_badge')}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t('billing.payment.manual_desc')}</p>
            {showHalfStateHint && (
              <p className="text-sm font-medium">{t('billing.payment.half_hint')}</p>
            )}
            <Button variant="outline" size="sm" onClick={onSetupMandate} disabled={isMutating}>
              {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('billing.payment.switch_to_mandate')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-medium">{t('billing.payment.none_title')}</p>
              <p className="text-sm text-muted-foreground">{t('billing.payment.none_desc')}</p>
              {mandateFailed && (
                <p className="text-sm text-destructive mt-2">
                  {t('billing.payment.mandate_failed')}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={onSetupMandate} disabled={isMutating}>
                {isMutating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Banknote className="h-4 w-4 mr-2" />
                )}
                {t('billing.payment.setup_mandate')}
              </Button>
              <Button variant="outline" onClick={onChooseManual} disabled={isMutating}>
                <FileText className="h-4 w-4 mr-2" />
                {t('billing.payment.choose_manual')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}