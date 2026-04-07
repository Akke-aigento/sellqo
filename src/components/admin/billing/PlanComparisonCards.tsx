import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Star, ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PlanFeatureDetailDialog } from './PlanFeatureDetailDialog';
import type { PricingPlan, PricingPlanFeatures, BillingInterval } from '@/types/billing';

interface PlanComparisonCardsProps {
  plans: PricingPlan[];
  currentPlanId: string;
  currentInterval: BillingInterval;
  isLoading?: boolean;
  onSelectPlan: (planId: string, isUpgrade: boolean) => void;
}

const featureLabels: Record<keyof PricingPlanFeatures, string> = {
  customDomain: 'Eigen domein',
  removeWatermark: 'Geen watermerk',
  prioritySupport: 'Prioriteit support',
  whiteLabel: 'White-label',
  apiAccess: 'API toegang',
  webhooks: 'Webhooks',
  advancedAnalytics: 'Geavanceerde analytics',
  facturX: 'Factur-X e-facturen',
  peppol: 'Peppol e-invoicing',
  multiCurrency: 'Multi-valuta',
  pos: 'POS Kassa',
  webshop_builder: 'Webshop Builder',
  visual_editor: 'Visual Editor',
  ai_marketing: 'AI Marketing',
  ai_copywriting: 'AI Copywriting',
  ai_images: 'AI Afbeeldingen',
  ai_seo: 'AI SEO',
  ai_coach: 'AI Business Coach',
  ai_chatbot: 'AI Chatbot',
  ai_ab_testing: 'AI A/B Testing',
  bol_com: 'Bol.com integratie',
  bol_vvb_labels: 'Bol.com VVB Labels',
  amazon: 'Amazon integratie',
  ebay: 'eBay integratie',
  social_commerce: 'Social Commerce',
  whatsapp: 'WhatsApp berichten',
  shop_health: 'Shop Health Score',
  gamification: 'Gamification & Badges',
  live_activity: 'Live Activity Feed',
  loyalty_program: 'Loyaliteitsprogramma',
  recurring_subscriptions: 'Abonnementen',
  multi_warehouse: 'Multi-warehouse',
  promo_bundles: 'Bundel aanbiedingen',
  promo_bogo: 'Buy One Get One',
  promo_volume: 'Volume kortingen',
  promo_giftcards: 'Cadeaubonnen',
};

function compareFeatures(
  currentFeatures: PricingPlanFeatures,
  targetFeatures: PricingPlanFeatures
): { gained: string[]; lost: string[] } {
  const gained: string[] = [];
  const lost: string[] = [];

  for (const key of Object.keys(currentFeatures) as (keyof PricingPlanFeatures)[]) {
    const currentHas = currentFeatures[key];
    const targetHas = targetFeatures[key];
    if (!currentHas && targetHas) gained.push(featureLabels[key] || key);
    else if (currentHas && !targetHas) lost.push(featureLabels[key] || key);
  }

  return { gained, lost };
}

export function PlanComparisonCards({
  plans,
  currentPlanId,
  currentInterval,
  isLoading,
  onSelectPlan,
}: PlanComparisonCardsProps) {
  const { i18n } = useTranslation();
  const [detailPlan, setDetailPlan] = useState<PricingPlan | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatLimit = (limit: number | null) => {
    if (limit === null) return 'Onbeperkt';
    return limit.toLocaleString();
  };

  const sortedPlans = [...plans].sort((a, b) => a.monthly_price - b.monthly_price);
  const currentPlanIndex = sortedPlans.findIndex(p => p.id === currentPlanId);
  const currentPlan = sortedPlans[currentPlanIndex];

  return (
    <>
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Vergelijk plannen en bekijk wat je krijgt of verliest bij een wijziging
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sortedPlans.map((plan, index) => {
            const isCurrent = plan.id === currentPlanId;
            const isUpgrade = index > currentPlanIndex;
            const price = currentInterval === 'yearly' ? plan.yearly_price : plan.monthly_price;
            const monthlyEquivalent = currentInterval === 'yearly' ? plan.yearly_price / 12 : plan.monthly_price;

            const { gained, lost } = currentPlan
              ? compareFeatures(currentPlan.features, plan.features)
              : { gained: [], lost: [] };

            const limitChanges: { label: string; current: number | null; target: number | null; isIncrease: boolean }[] = [];
            if (currentPlan) {
              if (plan.limit_products !== currentPlan.limit_products) {
                limitChanges.push({ label: 'Producten', current: currentPlan.limit_products, target: plan.limit_products, isIncrease: (plan.limit_products || Infinity) > (currentPlan.limit_products || Infinity) });
              }
              if (plan.limit_orders !== currentPlan.limit_orders) {
                limitChanges.push({ label: 'Orders/mnd', current: currentPlan.limit_orders, target: plan.limit_orders, isIncrease: (plan.limit_orders || Infinity) > (currentPlan.limit_orders || Infinity) });
              }
              if (plan.limit_customers !== currentPlan.limit_customers) {
                limitChanges.push({ label: 'Klanten', current: currentPlan.limit_customers, target: plan.limit_customers, isIncrease: (plan.limit_customers || Infinity) > (currentPlan.limit_customers || Infinity) });
              }
              if (plan.limit_users !== currentPlan.limit_users) {
                limitChanges.push({ label: 'Teamleden', current: currentPlan.limit_users, target: plan.limit_users, isIncrease: plan.limit_users > currentPlan.limit_users });
              }
            }

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
                  plan.highlighted && !isCurrent && 'border-primary shadow-md',
                  isCurrent && 'ring-2 ring-primary bg-primary/5'
                )}
              >
                {/* Status badges */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {isCurrent && (
                    <Badge className="bg-primary text-primary-foreground shadow-sm">
                      Huidig plan
                    </Badge>
                  )}
                  {plan.highlighted && !isCurrent && (
                    <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm border-0">
                      <Star className="h-3 w-3 mr-1" />
                      Populair
                    </Badge>
                  )}
                </div>

                <CardHeader className="pt-6">
                  <CardTitle className="text-center">
                    <span className="text-lg font-bold">{plan.name}</span>
                  </CardTitle>
                  <div className="text-center">
                    <span className="text-3xl font-bold tracking-tight text-primary">
                      {formatPrice(monthlyEquivalent)}
                    </span>
                    <span className="text-muted-foreground">/mnd</span>
                    {currentInterval === 'yearly' && price > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatPrice(price)}/jaar
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  {/* Limits */}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Producten</span>
                      <span className="font-medium">{formatLimit(plan.limit_products)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Orders/mnd</span>
                      <span className="font-medium">{formatLimit(plan.limit_orders)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Klanten</span>
                      <span className="font-medium">{formatLimit(plan.limit_customers)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Teamleden</span>
                      <span className="font-medium">{plan.limit_users}</span>
                    </div>
                  </div>

                  {/* Feature changes */}
                  {!isCurrent && (gained.length > 0 || lost.length > 0 || limitChanges.length > 0) && (
                    <div className="space-y-3 pt-3 border-t">
                      {gained.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-xs font-medium text-green-600 mb-1">
                            <ArrowUp className="h-3 w-3" />
                            Je krijgt erbij:
                          </div>
                          <ul className="space-y-1">
                            {gained.slice(0, 4).map((feature, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-xs text-green-600">
                                <Check className="h-3 w-3" />
                                {feature}
                              </li>
                            ))}
                            {gained.length > 4 && (
                              <li>
                                <button
                                  type="button"
                                  onClick={() => setDetailPlan(plan)}
                                  className="text-xs text-green-600 hover:text-green-700 hover:underline pl-4 cursor-pointer flex items-center gap-1"
                                >
                                  <Info className="h-3 w-3" />
                                  +{gained.length - 4} meer...
                                </button>
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {lost.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-xs font-medium text-red-600 mb-1">
                            <ArrowDown className="h-3 w-3" />
                            Je verliest:
                          </div>
                          <ul className="space-y-1">
                            {lost.slice(0, 4).map((feature, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-xs text-red-600">
                                <X className="h-3 w-3" />
                                {feature}
                              </li>
                            ))}
                            {lost.length > 4 && (
                              <li>
                                <button
                                  type="button"
                                  onClick={() => setDetailPlan(plan)}
                                  className="text-xs text-red-600 hover:text-red-700 hover:underline pl-4 cursor-pointer flex items-center gap-1"
                                >
                                  <Info className="h-3 w-3" />
                                  +{lost.length - 4} meer...
                                </button>
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {limitChanges.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                            <Minus className="h-3 w-3" />
                            Limieten wijzigen:
                          </div>
                          <ul className="space-y-1">
                            {limitChanges.map((change, i) => (
                              <li
                                key={i}
                                className={cn(
                                  'text-xs flex items-center gap-1.5',
                                  change.isIncrease ? 'text-green-600' : 'text-red-600'
                                )}
                              >
                                {change.isIncrease ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                {change.label}: {formatLimit(change.current)} → {formatLimit(change.target)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* View all features button */}
                  <button
                    type="button"
                    onClick={() => setDetailPlan(plan)}
                    className="text-xs text-primary hover:text-primary/80 hover:underline cursor-pointer flex items-center gap-1 pt-1"
                  >
                    <Info className="h-3 w-3" />
                    Bekijk alle features
                  </button>
                </CardContent>

                <CardFooter className="pt-4">
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Huidig plan
                    </Button>
                  ) : plan.id === 'free' ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => onSelectPlan(plan.id, false)}
                      disabled={isLoading}
                    >
                      <ArrowDown className="h-4 w-4 mr-1" />
                      Downgrade
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => onSelectPlan(plan.id, true)}
                      disabled={isLoading}
                    >
                      <ArrowUp className="h-4 w-4 mr-1" />
                      Upgrade
                      {gained.length > 0 && (
                        <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                          +{gained.length}
                        </Badge>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => onSelectPlan(plan.id, false)}
                      disabled={isLoading}
                    >
                      <ArrowDown className="h-4 w-4 mr-1" />
                      Downgrade
                      {lost.length > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          -{lost.length}
                        </Badge>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Alle prijzen zijn exclusief BTW
        </p>
      </div>

      {/* Feature Detail Dialog */}
      <PlanFeatureDetailDialog
        plan={detailPlan}
        currentPlanId={currentPlanId}
        open={!!detailPlan}
        onOpenChange={(open) => { if (!open) setDetailPlan(null); }}
        onSelectPlan={onSelectPlan}
        currentPlanSortOrder={currentPlan?.sort_order ?? 0}
        isLoading={isLoading}
      />
    </>
  );
}
