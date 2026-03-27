import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Star } from 'lucide-react';
import { usePricingPlans } from '@/hooks/usePricingPlans';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SellqoLogo } from '@/components/SellqoLogo';
import { Link } from 'react-router-dom';
import { ForcedLightMode } from '@/components/ForcedLightMode';

const featureLabels: Record<string, { nl: string; en: string }> = {
  customDomain: { nl: 'Eigen domein', en: 'Custom domain' },
  removeWatermark: { nl: 'Geen watermerk', en: 'No watermark' },
  prioritySupport: { nl: 'Prioriteit support', en: 'Priority support' },
  apiAccess: { nl: 'API toegang', en: 'API access' },
  webhooks: { nl: 'Webhooks', en: 'Webhooks' },
  advancedAnalytics: { nl: 'Geavanceerde analytics', en: 'Advanced analytics' },
  whiteLabel: { nl: 'White-label', en: 'White-label' },
  multiCurrency: { nl: 'Multi-valuta', en: 'Multi-currency' },
  facturX: { nl: 'Factur-X', en: 'Factur-X' },
  peppol: { nl: 'Peppol', en: 'Peppol' },
};

export default function PricingPage() {
  const { t, i18n } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);
  const { plans, isLoading } = usePricingPlans();
  const { subscription, createCheckout } = useTenantSubscription();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatLimit = (limit: number | null) => {
    if (limit === null) return t('pricing.unlimited');
    return limit.toLocaleString();
  };

  const handleSelectPlan = (planId: string) => {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@sellqo.app?subject=Enterprise%20Plan';
      return;
    }
    
    createCheckout.mutate({ 
      planId, 
      interval: isYearly ? 'yearly' : 'monthly' 
    });
  };

  if (isLoading) {
    return (
      <ForcedLightMode>
        <div className="min-h-screen bg-background">
          <div className="container py-16">
            <div className="grid gap-6 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-[600px]" />
              ))}
            </div>
          </div>
        </div>
      </ForcedLightMode>
    );
  }

  return (
    <ForcedLightMode>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
          <Link to="/">
            <SellqoLogo variant="full" width={120} />
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/auth">{t('auth.login')}</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">{t('pricing.start_free')}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Pricing content */}
      <div className="container py-16">
        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {t('pricing.subtitle')}
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3">
            <Label htmlFor="billing-toggle" className={cn(!isYearly && 'font-semibold')}>
              {t('pricing.monthly')}
            </Label>
            <Switch
              id="billing-toggle"
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <Label htmlFor="billing-toggle" className={cn(isYearly && 'font-semibold')}>
              {t('pricing.yearly')}
              <Badge variant="secondary" className="ml-2">
                {t('pricing.yearly_discount')}
              </Badge>
            </Label>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan_id === plan.id;
            const price = isYearly ? plan.yearly_price : plan.monthly_price;
            const monthlyEquivalent = isYearly ? plan.yearly_price / 12 : plan.monthly_price;

            return (
              <Card 
                key={plan.id}
                className={cn(
                  'relative flex flex-col',
                  plan.highlighted && 'border-primary shadow-lg scale-[1.02]',
                  isCurrentPlan && 'ring-2 ring-primary'
                )}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Star className="h-3 w-3 mr-1" />
                    {t('pricing.most_popular')}
                  </Badge>
                )}
                
                {isCurrentPlan && (
                  <Badge variant="outline" className="absolute -top-3 right-4">
                    Huidig plan
                  </Badge>
                )}

                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">
                      {formatPrice(monthlyEquivalent)}
                    </span>
                    <span className="text-muted-foreground">{t('pricing.per_month')}</span>
                    {isYearly && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatPrice(price)} / jaar
                      </div>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  {/* Limits */}
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-sm">
                      <span>{t('pricing.features.products')}</span>
                      <span className="font-medium">{formatLimit(plan.limit_products)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('pricing.features.orders_per_month')}</span>
                      <span className="font-medium">{formatLimit(plan.limit_orders)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('pricing.features.customers')}</span>
                      <span className="font-medium">{formatLimit(plan.limit_customers)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('pricing.features.team_members')}</span>
                      <span className="font-medium">{plan.limit_users}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('pricing.features.storage')}</span>
                      <span className="font-medium">{plan.limit_storage_gb} GB</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-2">
                    {Object.entries(plan.features).map(([key, enabled]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {enabled ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={cn(!enabled && 'text-muted-foreground')}>
                          {featureLabels[key]?.[i18n.language as 'nl' | 'en'] || key}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={plan.highlighted ? 'default' : 'outline'}
                    disabled={isCurrentPlan || createCheckout.isPending}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {isCurrentPlan 
                      ? 'Huidig plan'
                      : plan.id === 'free' 
                        ? t('pricing.start_free')
                        : plan.id === 'enterprise'
                          ? t('pricing.contact_sales')
                          : t('pricing.choose_plan')
                    }
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* All plans include */}
        <div className="mt-16 text-center">
          <h3 className="text-lg font-semibold mb-4">{t('pricing.all_plans_include')}</h3>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              SSL
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              Backups
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              Support
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              GDPR compliant
            </div>
          </div>
          <p className="mt-6 text-sm text-muted-foreground font-medium">
            Alle prijzen zijn exclusief BTW
          </p>
        </div>
      </div>
    </div>
    </ForcedLightMode>
  );
}
