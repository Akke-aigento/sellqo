import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { 
  CreditCard, 
  Download, 
  ExternalLink, 
  AlertTriangle,
  TrendingUp,
  Settings,
  ArrowUpDown
} from 'lucide-react';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { usePricingPlans } from '@/hooks/usePricingPlans';
import { useCalculatePlanSwitch, useExecutePlanSwitch, type PlanSwitchPreview } from '@/hooks/usePlanSwitch';
import { PlanSwitchPreviewCard } from '@/components/admin/billing/PlanSwitchPreview';
import { DowngradeWarningDialog } from '@/components/admin/billing/DowngradeWarningDialog';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export default function BillingPage() {
  const { t, i18n } = useTranslation();
  const { 
    subscription, 
    invoices, 
    usage, 
    isLoading, 
    invoicesLoading,
    usageLoading,
    createCheckout,
    openCustomerPortal 
  } = useTenantSubscription();
  const { plans } = usePricingPlans();
  const calculatePlanSwitch = useCalculatePlanSwitch();
  const executePlanSwitch = useExecutePlanSwitch();
  
  // Plan switch state
  const [showPlanSwitchDialog, setShowPlanSwitchDialog] = useState(false);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [planSwitchPreview, setPlanSwitchPreview] = useState<PlanSwitchPreview | null>(null);
  const [selectedTargetPlanId, setSelectedTargetPlanId] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'yearly'>('monthly');

  const dateLocale = i18n.language === 'nl' ? nl : enUS;

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
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  // Plan switch handlers
  const handlePreviewPlanSwitch = async (targetPlanId: string) => {
    setSelectedTargetPlanId(targetPlanId);
    
    const preview = await calculatePlanSwitch.mutateAsync({
      target_plan_id: targetPlanId,
      target_interval: selectedInterval,
    });
    
    setPlanSwitchPreview(preview);
    
    // Show downgrade warning first if features will be lost
    if (!preview.is_upgrade && preview.features.lost.length > 0) {
      setShowDowngradeWarning(true);
    } else {
      setShowPlanSwitchDialog(true);
    }
  };

  const handleConfirmDowngrade = () => {
    setShowDowngradeWarning(false);
    setShowPlanSwitchDialog(true);
  };

  const handleExecutePlanSwitch = async () => {
    if (!selectedTargetPlanId) return;
    
    await executePlanSwitch.mutateAsync({
      target_plan_id: selectedTargetPlanId,
      target_interval: selectedInterval,
      proration_behavior: 'create_prorations',
    });
    
    setShowPlanSwitchDialog(false);
    setPlanSwitchPreview(null);
    setSelectedTargetPlanId(null);
    // Refresh page to show new subscription
    window.location.reload();
  };

  const handleCancelPlanSwitch = () => {
    setShowPlanSwitchDialog(false);
    setShowDowngradeWarning(false);
    setPlanSwitchPreview(null);
    setSelectedTargetPlanId(null);
  };

  // Filter plans that can be switched to (exclude current plan)
  const switchablePlans = plans.filter(p => p.id !== currentPlan?.id && p.id !== 'free');

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

  const currentPlan = subscription?.pricing_plan || plans.find(p => p.id === 'free');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('billing.title')}</h1>
        <p className="text-muted-foreground">
          Beheer je abonnement, bekijk facturen en wijzig je betaalmethode.
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

            {/* Plan Switch Section */}
            {subscription?.stripe_subscription_id && switchablePlans.length > 0 && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ArrowUpDown className="h-4 w-4" />
                  Wissel van plan
                </div>
                <div className="flex gap-2">
                  <Select 
                    value={selectedTargetPlanId || ''} 
                    onValueChange={setSelectedTargetPlanId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecteer een plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {switchablePlans.map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - {formatPrice(plan.monthly_price)}/mnd
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => selectedTargetPlanId && handlePreviewPlanSwitch(selectedTargetPlanId)}
                    disabled={!selectedTargetPlanId || calculatePlanSwitch.isPending}
                  >
                    {calculatePlanSwitch.isPending ? 'Laden...' : 'Bekijk wijziging'}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => window.location.href = '/pricing'}>
                {t('billing.change_plan')}
              </Button>
              {subscription?.stripe_subscription_id && (
                <Button 
                  variant="ghost" 
                  onClick={() => openCustomerPortal.mutate()}
                  disabled={openCustomerPortal.isPending}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Beheer abonnement
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle>{t('billing.usage')}</CardTitle>
            <CardDescription>Jouw verbruik deze maand</CardDescription>
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
                  const labels: Record<string, string> = {
                    products: 'Producten',
                    orders: 'Orders',
                    customers: 'Klanten',
                    storage: 'Opslag (GB)',
                    users: 'Team',
                  };
                  const isNearLimit = value.percentage >= 80;
                  
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{labels[key] || key}</span>
                        <span className={cn(isNearLimit && 'text-amber-500 font-medium')}>
                          {value.current.toLocaleString()} / {value.limit?.toLocaleString() || '∞'}
                        </span>
                      </div>
                      <Progress 
                        value={value.percentage} 
                        className={cn(isNearLimit && '[&>div]:bg-amber-500')}
                      />
                    </div>
                  );
                })}

                {Object.values(usage).some(v => v.percentage >= 80) && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">
                      {t('billing.upgrade_needed')}
                    </span>
                    <Button size="sm" variant="outline" className="ml-auto">
                      Upgrade
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Geen gegevens beschikbaar</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Method */}
      {subscription?.stripe_payment_method_id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('billing.payment_method')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-16 bg-muted rounded flex items-center justify-center text-xs font-medium">
                  VISA
                </div>
                <div>
                  <p className="font-medium">•••• •••• •••• 4242</p>
                  <p className="text-sm text-muted-foreground">Vervalt 12/26</p>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={() => openCustomerPortal.mutate()}
                disabled={openCustomerPortal.isPending}
              >
                {t('billing.update_payment_method')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>{t('billing.invoices')}</CardTitle>
          <CardDescription>Bekijk en download je facturen</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <Skeleton className="h-48" />
          ) : invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nog geen facturen
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Bedrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.slice(0, 10).map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {invoice.invoice_date && format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell>{formatPrice(invoice.amount, invoice.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                        {invoice.status === 'paid' ? '✓ Betaald' : invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {invoice.invoice_pdf_url && (
                          <Button size="icon" variant="ghost" asChild>
                            <a href={invoice.invoice_pdf_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {invoice.hosted_invoice_url && (
                          <Button size="icon" variant="ghost" asChild>
                            <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {invoices.length > 10 && (
            <Button variant="link" className="mt-4">
              {t('billing.view_all_invoices')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Plan Switch Preview Dialog */}
      <Dialog open={showPlanSwitchDialog} onOpenChange={setShowPlanSwitchDialog}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {planSwitchPreview && (
            <PlanSwitchPreviewCard
              preview={planSwitchPreview}
              isLoading={executePlanSwitch.isPending}
              onConfirm={handleExecutePlanSwitch}
              onCancel={handleCancelPlanSwitch}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Downgrade Warning Dialog */}
      {planSwitchPreview && (
        <DowngradeWarningDialog
          open={showDowngradeWarning}
          onOpenChange={setShowDowngradeWarning}
          featuresLost={planSwitchPreview.features.lost}
          currentPlanName={planSwitchPreview.current_plan.name}
          targetPlanName={planSwitchPreview.target_plan.name}
          onConfirm={handleConfirmDowngrade}
        />
      )}
    </div>
  );
}
