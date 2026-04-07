import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Star, ArrowUp, ArrowDown, Minus, Info, Crown, Sparkles, Package, ShoppingCart, Users, UserPlus } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { PlanFeatureDetailDialog } from './PlanFeatureDetailDialog';
import type { PricingPlan, PricingPlanFeatures, BillingInterval } from '@/types/billing';

interface PlanComparisonCardsProps {
  plans: PricingPlan[];
  currentPlanId: string;
  currentInterval: BillingInterval;
  selectedInterval: BillingInterval;
  isLoading?: boolean;
  onSelectPlan: (planId: string, isUpgrade: boolean) => void;
  onIntervalChange: (interval: BillingInterval) => void;
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

const tierConfig: Record<string, {
  stripColor: string;
  icon: React.ReactNode;
}> = {
  free: {
    stripColor: 'from-slate-300 to-slate-200',
    icon: <Package className="h-5 w-5" />,
  },
  starter: {
    stripColor: 'from-blue-400 to-indigo-300',
    icon: <Sparkles className="h-5 w-5" />,
  },
  pro: {
    stripColor: 'from-teal-400 to-emerald-300',
    icon: <Crown className="h-5 w-5" />,
  },
  enterprise: {
    stripColor: 'from-amber-400 to-orange-300',
    icon: <Star className="h-5 w-5" />,
  },
};

function getTierKey(planName: string): string {
  const lower = planName.toLowerCase();
  if (lower.includes('free') || lower.includes('gratis')) return 'free';
  if (lower.includes('starter')) return 'starter';
  if (lower.includes('pro')) return 'pro';
  if (lower.includes('enterprise') || lower.includes('zakelijk')) return 'enterprise';
  return 'starter';
}

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
  selectedInterval,
  isLoading,
  onSelectPlan,
  onIntervalChange,
}: PlanComparisonCardsProps) {
  const { i18n } = useTranslation();
  const [detailPlan, setDetailPlan] = useState<PricingPlan | null>(null);

  const isYearly = selectedInterval === 'yearly';

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(price);

  const formatLimit = (limit: number | null) => {
    if (limit === null) return 'Onbeperkt';
    return limit.toLocaleString();
  };

  const sortedPlans = [...plans].sort((a, b) => a.monthly_price - b.monthly_price);
  const currentPlanIndex = sortedPlans.findIndex(p => p.id === currentPlanId);
  const currentPlan = sortedPlans[currentPlanIndex];

  return (
    <>
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold">Kies het plan dat bij je past</h3>
          <p className="text-sm text-muted-foreground">
            Vergelijk plannen en bekijk wat je krijgt of verliest bij een wijziging
          </p>

          {/* Billing interval toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={cn('text-sm font-medium transition-colors', !isYearly ? 'text-foreground' : 'text-muted-foreground')}>
              Maandelijks
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={(checked) => onIntervalChange(checked ? 'yearly' : 'monthly')}
            />
            <span className={cn('text-sm font-medium transition-colors', isYearly ? 'text-foreground' : 'text-muted-foreground')}>
              Jaarlijks
            </span>
            {isYearly && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs font-medium">
                Bespaar 2 maanden
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {sortedPlans.map((plan, index) => {
            const isCurrent = plan.id === currentPlanId;
            const isUpgrade = index > currentPlanIndex;
            const price = isYearly ? plan.yearly_price : plan.monthly_price;
            const monthlyEquivalent = isYearly ? plan.yearly_price / 12 : plan.monthly_price;
            const tier = tierConfig[getTierKey(plan.name)] || tierConfig.starter;

            const { gained, lost } = currentPlan
              ? compareFeatures(currentPlan.features, plan.features)
              : { gained: [], lost: [] };

            const limitChanges: { label: string; current: number | null; target: number | null; isIncrease: boolean }[] = [];
            if (currentPlan) {
              if (plan.limit_products !== currentPlan.limit_products)
                limitChanges.push({ label: 'Producten', current: currentPlan.limit_products, target: plan.limit_products, isIncrease: (plan.limit_products || Infinity) > (currentPlan.limit_products || Infinity) });
              if (plan.limit_orders !== currentPlan.limit_orders)
                limitChanges.push({ label: 'Orders/mnd', current: currentPlan.limit_orders, target: plan.limit_orders, isIncrease: (plan.limit_orders || Infinity) > (currentPlan.limit_orders || Infinity) });
              if (plan.limit_customers !== currentPlan.limit_customers)
                limitChanges.push({ label: 'Klanten', current: currentPlan.limit_customers, target: plan.limit_customers, isIncrease: (plan.limit_customers || Infinity) > (currentPlan.limit_customers || Infinity) });
              if (plan.limit_users !== currentPlan.limit_users)
                limitChanges.push({ label: 'Teamleden', current: currentPlan.limit_users, target: plan.limit_users, isIncrease: plan.limit_users > currentPlan.limit_users });
            }

            const enabledCount = plan.features ? Object.values(plan.features).filter(Boolean).length : 0;
            const totalCount = plan.features ? Object.keys(plan.features).length : 0;

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col overflow-hidden transition-all duration-300',
                  'hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02]',
                  'bg-card',
                  plan.highlighted && !isCurrent && 'border-2 border-amber-400 shadow-lg',
                  isCurrent && 'ring-2 ring-primary shadow-lg',
                  !plan.highlighted && !isCurrent && 'border'
                )}
              >
                {/* Top gradient strip */}
                <div className={cn('h-1 w-full bg-gradient-to-r', tier.stripColor)} />

                {/* Status badges */}
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 flex gap-1 mt-4">
                  {isCurrent && (
                    <Badge className="bg-primary text-primary-foreground shadow-md animate-pulse">
                      ✓ Huidig plan
                    </Badge>
                  )}
                  {plan.highlighted && !isCurrent && (
                    <Badge className="bg-white text-amber-700 border-2 border-amber-400 shadow-md">
                      <Crown className="h-3 w-3 mr-1 text-amber-500" />
                      Meest gekozen
                    </Badge>
                  )}
                </div>

                <CardHeader className={cn('pt-10 pb-4 text-center', !isCurrent && !plan.highlighted && 'pt-6')}>
                  {/* Plan icon */}
                  <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-muted/60 border">
                    <span className="text-foreground">{tier.icon}</span>
                  </div>

                  <span className="text-base font-bold tracking-wide uppercase text-muted-foreground">{plan.name}</span>

                  <div className="mt-2">
                    <span className="text-4xl font-extrabold tracking-tight text-foreground">
                      {formatPrice(monthlyEquivalent)}
                    </span>
                    <span className="text-muted-foreground text-sm">/mnd</span>
                    {currentInterval === 'yearly' && price > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatPrice(price)}/jaar
                      </p>
                    )}
                  </div>

                  {/* Feature count indicator */}
                  <div className="mt-3 mx-auto max-w-[180px]">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{enabledCount} features</span>
                      <span>{totalCount} totaal</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-primary"
                        style={{ width: `${totalCount > 0 ? (enabledCount / totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4 px-5">
                  {/* Limits grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: <Package className="h-3.5 w-3.5" />, label: 'Producten', value: formatLimit(plan.limit_products) },
                      { icon: <ShoppingCart className="h-3.5 w-3.5" />, label: 'Orders', value: formatLimit(plan.limit_orders) },
                      { icon: <Users className="h-3.5 w-3.5" />, label: 'Klanten', value: formatLimit(plan.limit_customers) },
                      { icon: <UserPlus className="h-3.5 w-3.5" />, label: 'Team', value: String(plan.limit_users) },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-1.5 text-xs p-2 rounded-lg bg-muted/40">
                        <span className="text-muted-foreground">{item.icon}</span>
                        <div>
                          <div className="font-semibold leading-tight">{item.value}</div>
                          <div className="text-muted-foreground text-[10px]">{item.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Feature changes as pill badges */}
                  {!isCurrent && (gained.length > 0 || lost.length > 0 || limitChanges.length > 0) && (
                    <div className="space-y-3 pt-3 border-t border-dashed">
                      {gained.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-xs font-semibold text-green-600 mb-1.5">
                            <ArrowUp className="h-3 w-3" />
                            Je krijgt erbij
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {gained.slice(0, 4).map((feature, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-green-700 text-[10px] font-medium border border-border">
                                <Check className="h-2.5 w-2.5" />
                                {feature}
                              </span>
                            ))}
                            {gained.length > 4 && (
                              <button
                                type="button"
                                onClick={() => setDetailPlan(plan)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-green-700 text-[10px] font-medium border border-border hover:bg-muted/80 cursor-pointer transition-colors"
                              >
                                +{gained.length - 4} meer
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {lost.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-xs font-semibold text-red-600 mb-1.5">
                            <ArrowDown className="h-3 w-3" />
                            Je verliest
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {lost.slice(0, 3).map((feature, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-medium border border-red-200">
                                <X className="h-2.5 w-2.5" />
                                {feature}
                              </span>
                            ))}
                            {lost.length > 3 && (
                              <button
                                type="button"
                                onClick={() => setDetailPlan(plan)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-medium border border-red-200 hover:bg-red-100 cursor-pointer transition-colors"
                              >
                                +{lost.length - 3} meer
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {limitChanges.length > 0 && (
                        <div className="space-y-1">
                          {limitChanges.map((change, i) => (
                            <div
                              key={i}
                              className={cn(
                                'text-[10px] flex items-center gap-1.5 px-2 py-1 rounded-md',
                                change.isIncrease ? 'bg-muted text-green-700' : 'bg-muted text-red-700'
                              )}
                            >
                              {change.isIncrease ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                              <span className="font-medium">{change.label}:</span> {formatLimit(change.current)} → {formatLimit(change.target)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* View all features */}
                  <button
                    type="button"
                    onClick={() => setDetailPlan(plan)}
                    className={cn(
                      'w-full text-xs font-medium py-2 px-3 rounded-lg border border-dashed transition-all',
                      'flex items-center justify-center gap-1.5 cursor-pointer',
                      'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Info className="h-3.5 w-3.5" />
                    Bekijk alle {enabledCount} features
                  </button>
                </CardContent>

                <CardFooter className="px-5 pb-5 pt-2">
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      <Check className="h-4 w-4 mr-1" />
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
                      className="w-full shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
                      onClick={() => onSelectPlan(plan.id, true)}
                      disabled={isLoading}
                    >
                      <ArrowUp className="h-4 w-4 mr-1" />
                      Upgrade naar {plan.name}
                      {gained.length > 0 && (
                        <Badge variant="secondary" className="ml-2 bg-primary-foreground/20 text-primary-foreground border-0 text-[10px]">
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
                        <Badge variant="destructive" className="ml-2 text-[10px]">
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

        <p className="text-center text-xs text-muted-foreground">
          Alle prijzen zijn exclusief BTW
        </p>
      </div>

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
