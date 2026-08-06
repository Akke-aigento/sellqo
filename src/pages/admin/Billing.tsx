import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { nl, enUS, fr, de } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Download,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  CalendarClock,
  CreditCard,
} from 'lucide-react';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { usePricingPlans } from '@/hooks/usePricingPlans';
import { usePlatformBillingDocuments } from '@/hooks/usePlatformBillingDocuments';
import { useDocumentDownload } from '@/hooks/useDocumentDownload';
import {
  usePlatformBillingStatus,
  useCreatePlatformMandateLink,
  useSetPlatformPaymentMode,
  useSyncTenantPlan,
  useCancelPendingUpgrade,
  type PlatformPaymentMode,
} from '@/hooks/usePlatformBillingStatus';
import { DowngradeWarningDialog } from '@/components/admin/billing/DowngradeWarningDialog';
import { PlanComparisonCards } from '@/components/admin/billing/PlanComparisonCards';
import { PaymentMethodCard } from '@/components/admin/billing/PaymentMethodCard';
import { PlanActivationWizard } from '@/components/admin/billing/PlanActivationWizard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PricingPlan, PricingPlanFeatures } from '@/types/billing';

const SUPPORT_EMAIL = 'info@sellqo.app';
const INVOICE_PAGE_SIZE = 10;

export default function BillingPage() {
  const { t, i18n } = useTranslation();
  const {
    subscription,
    usage,
    isLoading,
    usageLoading,
  } = useTenantSubscription();
  const { plans } = usePricingPlans();
  /** PAY-UX-1 — polling is enabled as long as an open payment request exists. */
  const [shouldPoll, setShouldPoll] = useState(false);
  const {
    data: documents,
    isLoading: documentsLoading,
    refetch: refetchDocuments,
  } = usePlatformBillingDocuments({ poll: shouldPoll });
  const { openDocument, isDownloading } = useDocumentDownload();
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const allInvoices = documents?.invoices ?? [];
  const visibleInvoices = showAllInvoices ? allInvoices : allInvoices.slice(0, INVOICE_PAGE_SIZE);

  const {
    data: billingStatus,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = usePlatformBillingStatus({ poll: shouldPoll });
  const createMandateLink = useCreatePlatformMandateLink();
  const setPaymentMode = useSetPlatformPaymentMode();
  const syncPlan = useSyncTenantPlan();
  const cancelUpgrade = useCancelPendingUpgrade();

  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [confirmPlan, setConfirmPlan] = useState<{ plan: PricingPlan; isUpgrade: boolean } | null>(null);
  const [downgradeCandidate, setDowngradeCandidate] = useState<PricingPlan | null>(null);
  /** Half-state resume: only plan id + interval are persisted. */
  const [resumeSelection, setResumeSelection] = useState<{
    plan_id: string;
    interval: 'monthly' | 'yearly';
  } | null>(null);
  /** Chosen before there is a billing subscription; applied right after activate. */
  const [pendingMode, setPendingMode] = useState<PlatformPaymentMode | null>(null);

  const dateLocale =
    i18n.language === 'nl' ? nl : i18n.language === 'fr' ? fr : i18n.language === 'de' ? de : enUS;

  // Determine current plan
  const currentPlan = subscription?.pricing_plan || plans.find(p => p.id === 'free');

  const mandate = billingStatus?.mandate ?? null;
  const hasUsableMandate = !!mandate && mandate.status !== 'failed';
  const effectiveMode: PlatformPaymentMode | null = billingStatus?.payment_mode ?? pendingMode;
  const hasPaymentPath = hasUsableMandate || effectiveMode === 'manual';
  const pendingPlanId =
    (subscription as unknown as { pending_plan_id?: string | null } | null)?.pending_plan_id ?? null;
  const pendingPlan = useMemo(
    () => plans.find(p => p.id === pendingPlanId) ?? null,
    [plans, pendingPlanId],
  );

  /**
   * UPGRADE-PF-1 — an unpaid pro-rata upgrade blocks new plan changes; the
   * tenant either pays it or cancels it.
   */
  const pendingUpgrade = billingStatus?.pending_upgrade ?? null;
  const pendingUpgradePlan = useMemo(
    () => plans.find(p => p.id === pendingUpgrade?.target_plan_id) ?? null,
    [plans, pendingUpgrade],
  );
  const showPendingDowngrade = !!pendingPlan && !pendingUpgrade;

  /**
   * PAY-UX-1 (deel A) — the page detects payment completion itself, for every
   * return path (same tab, separate tab from the payment-request mail, slow
   * webhook). Read-only: polling + refetch, never a mutation.
   */
  const openPaymentRequests = useMemo(
    () =>
      (documents?.payment_requests ?? []).filter(pr =>
        ['awaiting_payment', 'processing', 'open', 'pending'].includes(pr.status),
      ),
    [documents],
  );
  const hasOpenPayment = openPaymentRequests.length > 0 || !!pendingUpgrade;

  const [paidReference, setPaidReference] = useState<string | null>(null);
  const [paidTimedOut, setPaidTimedOut] = useState(false);
  const paidToastShownRef = useRef(false);
  const hadOpenPaymentRef = useRef(false);

  // ?paid=<pr> from the public success page: show a "processing" status and
  // strip the param so a refresh does not repeat it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get('paid') ?? params.get('paid_invoice');
    if (!paid) return;
    setPaidReference(paid);
    params.delete('paid');
    params.delete('paid_invoice');
    const query = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
    const timer = window.setTimeout(() => setPaidTimedOut(true), 30000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (documentsLoading || statusLoading) return;
    setShouldPoll(hasOpenPayment);

    if (hasOpenPayment) {
      hadOpenPaymentRef.current = true;
      return;
    }

    // Settled: either we saw an open request earlier, or we returned with ?paid.
    if ((hadOpenPaymentRef.current || paidReference) && !paidToastShownRef.current) {
      paidToastShownRef.current = true;
      hadOpenPaymentRef.current = false;
      setPaidReference(null);
      toast.success(t('billing.payment_return.received'));
    }
  }, [hasOpenPayment, documentsLoading, statusLoading, paidReference, t]);

  // Refetch when the tab regains focus (returning from the payment page).
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void refetchDocuments();
      void refetchStatus();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refetchDocuments, refetchStatus]);

  const handleCancelPendingUpgrade = async () => {
    try {
      await cancelUpgrade.mutateAsync();
      toast.success(t('billing.pending_upgrade.cancelled'));
    } catch (err) {
      toast.error(t('billing.pending_upgrade.cancel_error'), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const isEnterprise = (plan?: PricingPlan | null) =>
    !!plan && (plan.slug === 'enterprise' || plan.name.toLowerCase().includes('enterprise'));

  const hasBillingSubscription = !!billingStatus?.billing_subscription_id;
  const isFreePlan = (plan?: PricingPlan | null) =>
    !!plan && (plan.slug === 'free' || Number(plan.monthly_price) === 0);

  // UX-UNIFY-1 — half state: mandate set but plan never activated.
  const PENDING_KEY = 'sellqo.pending_plan_selection';
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) setResumeSelection(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const clearResume = () => {
    setResumeSelection(null);
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  };

  const resumePlan = useMemo(
    () => (resumeSelection ? plans.find(p => p.id === resumeSelection.plan_id) ?? null : null),
    [plans, resumeSelection],
  );
  const showResumeAlert = !!resumePlan && hasPaymentPath && !hasBillingSubscription;

  const lostFeatureKeys = (target: PricingPlan | null): string[] => {
    if (!target || !currentPlan?.features || !target.features) return [];
    const cur = currentPlan.features as PricingPlanFeatures;
    const tgt = target.features as PricingPlanFeatures;
    return (Object.keys(cur) as (keyof PricingPlanFeatures)[])
      .filter(k => cur[k] && !tgt[k])
      .map(String);
  };

  /** UX-UNIFY-2 — management card: redirect straight to the mandate page. */
  const handleSetupMandate = async () => {
    try {
      const res = await createMandateLink.mutateAsync({ interval: selectedInterval });
      window.location.assign(res.url);
    } catch (err) {
      toast.error(t('billing.payment.mandate_error'), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleChooseManual = async () => {
    if (!billingStatus?.billing_subscription_id) {
      // No billing subscription yet — remember the choice and apply after activate.
      setPendingMode('manual');
      toast.success(t('billing.payment.manual_selected'));
      return;
    }
    try {
      await setPaymentMode.mutateAsync('manual');
      setPendingMode(null);
      toast.success(t('billing.payment.manual_selected'));
    } catch (err) {
      toast.error(t('billing.payment.mode_error'), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleSelectPlan = (planId: string, isUpgrade: boolean) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    // UPGRADE-PF-1: one open pro-rata upgrade at a time (the backend returns 409).
    if (pendingUpgrade) {
      toast.warning(t('billing.pending_upgrade.blocked'));
      return;
    }

    if (isEnterprise(plan)) {
      toast.info(t('billing.enterprise_contact'));
      return;
    }

    if (!isUpgrade && lostFeatureKeys(plan).length > 0) {
      setDowngradeCandidate(plan);
      return;
    }
    setConfirmPlan({ plan, isUpgrade });
  };

  const handleConfirmPlanChange = async (modeOverride?: PlatformPaymentMode) => {
    if (!confirmPlan) return;
    const { plan, isUpgrade } = confirmPlan;
    // The UI decides activate vs switch — sync-tenant-plan returns 400 for a
    // switch without a live billing subscription, which must never surface.
    const action = billingStatus?.billing_subscription_id ? 'switch' : 'activate';
    try {
      const res = await syncPlan.mutateAsync({
        planId: plan.id,
        interval: selectedInterval,
        action,
      });

      if ((modeOverride ?? pendingMode) === 'manual') {
        try {
          await setPaymentMode.mutateAsync('manual');
          setPendingMode(null);
        } catch {
          toast.warning(t('billing.payment.mode_error'));
        }
      }

      setConfirmPlan(null);
      clearResume();
      if (res.downgrade) {
        toast.success(t('billing.plan_change.success_downgrade', { plan: plan.name }));
      } else if (res.awaiting_payment) {
        // Pay-first upgrade without a usable mandate: a payment request was sent.
        toast.info(t('billing.pending_upgrade.created', { plan: plan.name }));
      } else {
        toast.success(t('billing.plan_change.success_upgrade', { plan: plan.name }));
      }
    } catch (err) {
      toast.error(t('billing.plan_change.error'), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  /**
   * UX-UNIFY-2 — wizard direct-debit choice: persist the half state FIRST, then
   * redirect to the mandate page in the same tab.
   */
  const handleWizardCreateMandate = async () => {
    if (!confirmPlan) return;
    const payload = { plan_id: confirmPlan.plan.id, interval: selectedInterval };
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    setResumeSelection(payload);
    try {
      const res = await createMandateLink.mutateAsync({
        planId: confirmPlan.plan.id,
        interval: selectedInterval,
      });
      window.location.assign(res.url);
    } catch (err) {
      toast.error(t('billing.payment.mandate_error'), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleWizardManual = async () => {
    setPendingMode('manual');
    await handleConfirmPlanChange('manual');
  };

  /**
   * UX-UNIFY-2 — auto-finish after returning from the mandate page. Only fires
   * when the selection came from sessionStorage (an explicit earlier choice).
   */
  const autoActivatedRef = useRef(false);
  useEffect(() => {
    if (autoActivatedRef.current) return;
    if (statusLoading || !resumeSelection || !resumePlan) return;
    if (!hasUsableMandate || hasBillingSubscription) return;
    autoActivatedRef.current = true;
    (async () => {
      const action = 'activate' as const;
      try {
        const res = await syncPlan.mutateAsync({
          planId: resumePlan.id,
          interval: resumeSelection.interval,
          action,
        });
        clearResume();
        if (res.downgrade) {
          toast.success(t('billing.plan_change.success_downgrade', { plan: resumePlan.name }));
        } else {
          toast.success(t('billing.plan_change.success_upgrade', { plan: resumePlan.name }));
        }
      } catch (err) {
        toast.error(t('billing.plan_change.error'), {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusLoading, resumeSelection, resumePlan, hasUsableMandate, hasBillingSubscription]);

  // Find the best upgrade target based on current usage overages
  const findUpgradeTarget = (): string | null => {
    if (!usage || !plans.length) return null;
    
    // Sort plans by monthly price ascending (cheapest first)
    const sortedPlans = [...plans]
      .filter(p => p.id !== 'free' && p.id !== currentPlan?.id)
      .sort((a, b) => (a.monthly_price || 0) - (b.monthly_price || 0));

    for (const plan of sortedPlans) {
      const fits =
        (!plan.limit_products || (usage.products?.current || 0) <= plan.limit_products) &&
        (!plan.limit_orders || (usage.orders?.current || 0) <= plan.limit_orders) &&
        (!plan.limit_customers || (usage.customers?.current || 0) <= plan.limit_customers) &&
        (!plan.limit_users || (usage.users?.current || 0) <= plan.limit_users);
      if (fits) return plan.id;
    }
    // Nothing fits → enterprise (last plan)
    return sortedPlans[sortedPlans.length - 1]?.id || null;
  };

  const handleUpgradeClick = () => {
    // Scroll to plan comparison section instead of direct checkout
    const planSection = document.getElementById('plan-comparison-section');
    if (planSection) {
      planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // dateLocale already declared above

  const formatPrice = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trialing: 'secondary',
      past_due: 'destructive',
      canceled: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {t(`billing.status.${status}`, { defaultValue: status })}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('billing.title')}</h1>
        <p className="text-muted-foreground">
          {t('billing.subtitle')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {t('billing.current_plan')}
              {subscription && getStatusBadge(subscription.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{currentPlan?.name}</span>
              <span className="text-xl text-muted-foreground">
                {formatPrice(
                  subscription?.billing_interval === 'yearly' 
                    ? (currentPlan?.yearly_price || 0) / 12 
                    : currentPlan?.monthly_price || 0
                )}/mnd
              </span>
            </div>

            {subscription?.current_period_end && (
              <p className="text-sm text-muted-foreground">
                {t('billing.next_billing_date')}: {' '}
                {format(new Date(subscription.current_period_end), 'PPP', { locale: dateLocale })}
              </p>
            )}

            {subscription?.cancel_at_period_end && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  {t('billing.subscription_canceled')} {' '}
                  {subscription.current_period_end && format(new Date(subscription.current_period_end), 'PPP', { locale: dateLocale })}
                </span>
              </div>
            )}

            {billingStatus?.next_invoice_date && (
              <p className="text-sm text-muted-foreground">
                {t('billing.next_invoice')}:{' '}
                {format(new Date(billingStatus.next_invoice_date), 'PPP', { locale: dateLocale })}
              </p>
            )}

            {pendingUpgrade && (
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription className="space-y-3">
                  <p>
                    {t('billing.pending_upgrade.banner', {
                      plan: pendingUpgradePlan?.name ?? pendingUpgrade.target_plan_id ?? '',
                      amount: new Intl.NumberFormat(i18n.language, {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(pendingUpgrade.total),
                    })}
                  </p>
                  {pendingUpgrade.description && (
                    <p className="text-xs text-muted-foreground">{pendingUpgrade.description}</p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {pendingUpgrade.checkout_session_url && (
                      <Button
                        size="sm"
                        onClick={() => window.open(pendingUpgrade.checkout_session_url!, '_blank')}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t('billing.pending_upgrade.pay_now')}
                      </Button>
                    )}
                    {pendingUpgrade.cancellable && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cancelUpgrade.isPending}
                        onClick={handleCancelPendingUpgrade}
                      >
                        {t('billing.pending_upgrade.cancel')}
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {showPendingDowngrade && (
              <Alert>
                <CalendarClock className="h-4 w-4" />
                <AlertDescription>
                  {t('billing.pending_downgrade', {
                    plan: pendingPlan.name,
                    date: subscription?.current_period_end
                      ? format(new Date(subscription.current_period_end), 'PPP', { locale: dateLocale })
                      : '',
                  })}{' '}
                  {t('billing.pending_downgrade_cancel', { email: SUPPORT_EMAIL })}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle>{t('billing.usage')}</CardTitle>
            <CardDescription>{t('billing.usage_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usageLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : usage ? (
              <>
                {Object.entries(usage).map(([key, value]) => {
                  const label = t(`billing.usage_labels.${key}`, { defaultValue: key });
                  const isNearLimit = value.percentage >= 80 && value.percentage < 100;
                  const isOverLimit = value.percentage >= 100;
                  
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{label}</span>
                        <span className={cn(
                          isOverLimit && 'text-destructive font-medium',
                          isNearLimit && !isOverLimit && 'text-amber-500 font-medium'
                        )}>
                          {value.current.toLocaleString()} / {value.limit?.toLocaleString() || '∞'}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(value.percentage, 100)} 
                        className={cn(
                          isOverLimit && '[&>div]:bg-destructive',
                          isNearLimit && !isOverLimit && '[&>div]:bg-amber-500'
                        )}
                      />
                      {isOverLimit && (
                        <p className="text-xs text-destructive font-medium">
                          {t('billing.limit_exceeded')}
                        </p>
                      )}
                    </div>
                  );
                })}

                {Object.values(usage).some(v => v.percentage >= 100) && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {t('billing.limit_exceeded_title')}
                    </span>
                    <Button size="sm" variant="destructive" className="ml-auto" onClick={handleUpgradeClick}>
                      {t('billing.upgrade_now')}
                    </Button>
                  </div>
                )}

                {!Object.values(usage).some(v => v.percentage >= 100) && Object.values(usage).some(v => v.percentage >= 80) && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">
                      {t('billing.upgrade_needed')}
                    </span>
                    <Button size="sm" variant="outline" className="ml-auto" onClick={handleUpgradeClick}>
                      {t('billing.upgrade')}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{t('billing.no_data')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* UX-UNIFY-1: resume a half-finished activation (payment set, no plan) */}
      {showResumeAlert && (
        <Alert>
          <CalendarClock className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1">
              {t('billing.wizard.resume_alert', { plan: resumePlan?.name ?? '' })}
            </span>
            <Button
              size="sm"
              onClick={() => {
                if (!resumePlan || !resumeSelection) return;
                setSelectedInterval(resumeSelection.interval);
                setConfirmPlan({ plan: resumePlan, isUpgrade: true });
              }}
            >
              {t('billing.wizard.resume_action')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 2a·2 / UX-UNIFY-1: payment method management (hidden when nothing to manage) */}
      <div id="payment-method-section">
        <PaymentMethodCard
          status={billingStatus}
          isLoading={statusLoading}
          pendingMode={pendingMode}
          isMutating={createMandateLink.isPending || setPaymentMode.isPending}
          onSetupMandate={handleSetupMandate}
          onChooseManual={handleChooseManual}
          hasSubscription={hasBillingSubscription}
        />
      </div>

      {/* Plan Comparison Cards */}
      {plans.length > 0 && currentPlan && (
        <Card id="plan-comparison-section">
          <CardHeader>
            <CardTitle>{t('billing.switch_plan_title')}</CardTitle>
            <CardDescription>{t('billing.switch_plan_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanComparisonCards
              plans={plans}
              currentPlanId={currentPlan.id}
              currentInterval={subscription?.billing_interval || 'monthly'}
              selectedInterval={selectedInterval}
              isLoading={syncPlan.isPending}
              onIntervalChange={setSelectedInterval}
              onSelectPlan={handleSelectPlan}
            />
          </CardContent>
        </Card>
      )}


      {/* 2a·4 — open payment requests of the native billing engine */}
      {(documents?.payment_requests?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('billing.documents.payment_requests')}</CardTitle>
            <CardDescription>{t('billing.documents.payment_requests_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {documents!.payment_requests.map((pr) => (
              <div
                key={pr.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{pr.payment_request_number ?? '—'}</span>
                    <Badge variant="secondary">
                      {pr.cycle_type === 'proration'
                        ? t('billing.documents.upgrade_request')
                        : t('billing.documents.subscription_request')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground break-words">
                    {pr.description ?? ''}
                  </p>
                  {pr.due_date && (
                    <p className="text-xs text-muted-foreground">
                      {t('billing.documents.due_date', {
                        date: format(new Date(pr.due_date), 'dd/MM/yyyy', { locale: dateLocale }),
                      })}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{formatPrice(Number(pr.total))}</span>
                  {pr.checkout_session_url && (
                    <Button size="sm" asChild>
                      <a href={pr.checkout_session_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t('billing.documents.pay')}
                      </a>
                    </Button>
                  )}
                  {pr.has_pdf && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDownloading}
                      onClick={() => openDocument('payment_request', pr.id, 'pdf')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {t('billing.documents.pdf')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invoices (native billing engine) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('billing.invoices')}</CardTitle>
          <CardDescription>{t('billing.invoices_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          {documentsLoading ? (
            <Skeleton className="h-48" />
          ) : visibleInvoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t('billing.no_invoices')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billing.col_date')}</TableHead>
                  <TableHead>{t('billing.col_number')}</TableHead>
                  <TableHead>{t('billing.col_amount')}</TableHead>
                  <TableHead>{t('billing.col_status')}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {invoice.issue_date &&
                        format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: dateLocale })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                    <TableCell>{formatPrice(Number(invoice.total))}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant={
                            invoice.status === 'paid'
                              ? 'default'
                              : invoice.status === 'cancelled'
                                ? 'outline'
                                : 'secondary'
                          }
                        >
                          {invoice.status === 'paid'
                            ? `✓ ${t('billing.paid')}`
                            : t(`billing.status.${invoice.status}`, { defaultValue: invoice.status })}
                        </Badge>
                        {invoice.credited_by.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t('billing.documents.credited_via', {
                              numbers: invoice.credited_by.join(', '),
                            })}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {invoice.has_pdf && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={isDownloading}
                              onClick={() => openDocument('invoice', invoice.id, 'pdf')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('billing.download_pdf')}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {(documents?.invoices?.length ?? 0) > INVOICE_PAGE_SIZE && !showAllInvoices && (
            <Button variant="link" className="mt-4" onClick={() => setShowAllInvoices(true)}>
              {t('billing.documents.show_more', {
                count: (documents?.invoices?.length ?? 0) - INVOICE_PAGE_SIZE,
              })}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Credit notes */}
      {(documents?.credit_notes?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('billing.documents.credit_notes')}</CardTitle>
            <CardDescription>{t('billing.documents.credit_notes_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billing.col_date')}</TableHead>
                  <TableHead>{t('billing.col_number')}</TableHead>
                  <TableHead>{t('billing.documents.col_original')}</TableHead>
                  <TableHead>{t('billing.col_amount')}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents!.credit_notes.map((cn) => (
                  <TableRow key={cn.id}>
                    <TableCell>
                      {cn.issue_date &&
                        format(new Date(cn.issue_date), 'dd/MM/yyyy', { locale: dateLocale })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{cn.credit_note_number}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {cn.original_invoice_number ?? '—'}
                    </TableCell>
                    <TableCell>-{formatPrice(Number(cn.total))}</TableCell>
                    <TableCell>
                      {cn.has_pdf && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isDownloading}
                          onClick={() => openDocument('credit_note', cn.id, 'pdf')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* UX-UNIFY-1: plan-first wizard — the only entry point (and the gatekeeper) */}
      <PlanActivationWizard
        open={!!confirmPlan}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmPlan(null);
          }
        }}
        plan={confirmPlan?.plan ?? null}
        interval={selectedInterval}
        isUpgrade={confirmPlan?.isUpgrade ?? true}
        hasPaymentPath={hasPaymentPath}
        isFree={isFreePlan(confirmPlan?.plan)}
        isActivating={syncPlan.isPending || setPaymentMode.isPending}
        isCreatingMandate={createMandateLink.isPending}
        onCreateMandate={handleWizardCreateMandate}
        onChooseManual={handleWizardManual}
        onConfirm={() => handleConfirmPlanChange()}
      />

      {/* Downgrade warning (feature loss) — precedes the confirmation dialog */}
      {downgradeCandidate && (
        <DowngradeWarningDialog
          open={!!downgradeCandidate}
          onOpenChange={(open) => !open && setDowngradeCandidate(null)}
          featuresLost={lostFeatureKeys(downgradeCandidate)}
          currentPlanName={currentPlan?.name ?? ''}
          targetPlanName={downgradeCandidate.name}
          onConfirm={() => {
            const plan = downgradeCandidate;
            setDowngradeCandidate(null);
            setConfirmPlan({ plan, isUpgrade: false });
          }}
        />
      )}
    </div>
  );
}
