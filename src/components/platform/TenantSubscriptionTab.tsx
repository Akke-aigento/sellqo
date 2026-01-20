import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Gift, Calendar, CreditCard, ExternalLink } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { usePlatformBilling } from '@/hooks/usePlatformBilling';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface TenantSubscriptionTabProps {
  tenantId: string;
}

export function TenantSubscriptionTab({ tenantId }: TenantSubscriptionTabProps) {
  const [giftMonths, setGiftMonths] = useState(1);
  const { useTenantSubscription } = usePlatformAdmin();
  const { giftMonth } = usePlatformBilling();
  const { data: subscription, isLoading } = useTenantSubscription(tenantId);

  const handleGiftMonth = async () => {
    await giftMonth.mutateAsync({ tenantId, months: giftMonths });
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const plan = subscription?.pricing_plans as { name?: string; monthly_price?: number } | null;

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

      {/* Gift Months */}
      <Card>
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
          <div className="space-y-2">
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
            className="w-full"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {giftMonth.isPending ? 'Bezig...' : `${giftMonths} maand(en) cadeau geven`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
