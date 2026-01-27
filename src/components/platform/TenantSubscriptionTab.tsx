import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gift, Calendar, CreditCard, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { usePlatformBilling } from '@/hooks/usePlatformBilling';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TenantSubscriptionTabProps {
  tenantId: string;
}

export function TenantSubscriptionTab({ tenantId }: TenantSubscriptionTabProps) {
  const [giftMonths, setGiftMonths] = useState(1);
  const { useTenantSubscription, usePricingPlans, updateSubscription } = usePlatformAdmin();
  const { giftMonth } = usePlatformBilling();
  const { data: subscription, isLoading } = useTenantSubscription(tenantId);
  const { data: pricingPlans, isLoading: plansLoading } = usePricingPlans();

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedInterval, setSelectedInterval] = useState<string>('');

  const handleGiftMonth = async () => {
    await giftMonth.mutateAsync({ tenantId, months: giftMonths });
  };

  const handleUpdateSubscription = async () => {
    const updates: Record<string, unknown> = {};
    if (selectedPlanId && selectedPlanId !== subscription?.plan_id) {
      updates.plan_id = selectedPlanId;
    }
    if (selectedStatus && selectedStatus !== subscription?.status) {
      updates.status = selectedStatus;
    }
    if (selectedInterval && selectedInterval !== subscription?.billing_interval) {
      updates.billing_interval = selectedInterval;
    }
    
    if (Object.keys(updates).length > 0) {
      await updateSubscription.mutateAsync({ tenantId, updates });
    }
  };

  if (isLoading || plansLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const plan = subscription?.pricing_plans as { name?: string; monthly_price?: number } | null;
  const currentPlanId = subscription?.plan_id || '';
  const currentStatus = subscription?.status || '';
  const currentInterval = subscription?.billing_interval || 'monthly';

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'trialing':
        return 'secondary';
      case 'past_due':
        return 'destructive';
      case 'canceled':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const statusOptions = [
    { value: 'active', label: 'Actief' },
    { value: 'trialing', label: 'Trial' },
    { value: 'past_due', label: 'Achterstallig' },
    { value: 'canceled', label: 'Geannuleerd' },
    { value: 'paused', label: 'Gepauzeerd' },
  ];

  const hasChanges = 
    (selectedPlanId && selectedPlanId !== currentPlanId) ||
    (selectedStatus && selectedStatus !== currentStatus) ||
    (selectedInterval && selectedInterval !== currentInterval);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Huidig Abonnement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-semibold">{plan?.name || 'Onbekend'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={getStatusColor(subscription.status)}>
                  {subscription.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Interval</span>
                <span>{subscription.billing_interval === 'yearly' ? 'Jaarlijks' : 'Maandelijks'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Prijs</span>
                <span>€{plan?.monthly_price || 0}/maand</span>
              </div>
              {subscription.current_period_end && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Verlenging</span>
                  <span>
                    {format(new Date(subscription.current_period_end), 'dd MMM yyyy', { locale: nl })}
                  </span>
                </div>
              )}
              {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trial eindigt</span>
                  <span className="text-orange-600">
                    {format(new Date(subscription.trial_end), 'dd MMM yyyy', { locale: nl })}
                  </span>
                </div>
              )}
              {subscription.stripe_subscription_id && (
                <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                  <a
                    href={`https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Bekijk in Stripe
                  </a>
                </Button>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Geen actief abonnement</p>
          )}
        </CardContent>
      </Card>

      {/* Subscription Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Abonnement Wijzigen
          </CardTitle>
          <CardDescription>
            Pas het plan, status of facturatie-interval aan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <Select
              value={selectedPlanId || currentPlanId}
              onValueChange={setSelectedPlanId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer plan" />
              </SelectTrigger>
              <SelectContent>
                {pricingPlans?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} - €{p.monthly_price}/maand
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={selectedStatus || currentStatus}
              onValueChange={setSelectedStatus}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">Facturatie-interval</Label>
            <Select
              value={selectedInterval || currentInterval}
              onValueChange={setSelectedInterval}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Maandelijks</SelectItem>
                <SelectItem value="yearly">Jaarlijks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasChanges && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Je hebt onopgeslagen wijzigingen. Klik op "Wijzigingen opslaan" om door te voeren.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleUpdateSubscription}
            disabled={!hasChanges || updateSubscription.isPending}
            className="w-full"
          >
            {updateSubscription.isPending ? 'Bezig...' : 'Wijzigingen opslaan'}
          </Button>
        </CardContent>
      </Card>

      {/* Gift Months */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Gratis Maanden Geven
          </CardTitle>
          <CardDescription>
            Geef deze tenant gratis maanden toegang
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="months">Aantal maanden</Label>
              <Input
                id="months"
                type="number"
                min={1}
                max={12}
                value={giftMonths}
                onChange={(e) => setGiftMonths(parseInt(e.target.value) || 1)}
              />
            </div>
            <Button
              onClick={handleGiftMonth}
              disabled={giftMonth.isPending}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {giftMonth.isPending ? 'Bezig...' : `${giftMonths} maand(en) cadeau geven`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
