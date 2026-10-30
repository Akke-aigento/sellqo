import { Check, X, Crown, Zap, Package, ShoppingCart, Users, UserPlus, Sparkles, Star, ArrowUp, ArrowDown, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { planDisplayName } from '@/lib/planLines';
import type { PricingPlan, PricingPlanFeatures } from '@/types/billing';

interface PlanFeatureDetailDialogProps {
  plan: PricingPlan | null;
  currentPlanId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlan: (planId: string, isUpgrade: boolean) => void;
  currentPlanSortOrder?: number;
  isLoading?: boolean;
}

interface FeatureCategory {
  labelKey: string;
  icon: React.ReactNode;
  color: string;
  items: { key: keyof PricingPlanFeatures }[];
}

const featureCategories: FeatureCategory[] = [
  {
    labelKey: 'cat_webshop',
    icon: <Package className="h-4 w-4" />,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    items: [
      { key: 'webshop_builder' },
      { key: 'visual_editor' },
      { key: 'customDomain' },
      { key: 'removeWatermark' },
      { key: 'whiteLabel' },
    ],
  },
  {
    labelKey: 'cat_ai',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    items: [
      { key: 'ai_marketing' },
      { key: 'ai_copywriting' },
      { key: 'ai_images' },
      { key: 'ai_seo' },
      { key: 'ai_coach' },
      { key: 'ai_chatbot' },
      { key: 'ai_ab_testing' },
    ],
  },
  {
    labelKey: 'cat_connect',
    icon: <Zap className="h-4 w-4" />,
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    items: [
      { key: 'apiAccess' },
      { key: 'webhooks' },
      { key: 'bol_com' },
      { key: 'bol_vvb_labels' },
      { key: 'amazon' },
      { key: 'ebay' },
      { key: 'social_commerce' },
      { key: 'whatsapp' },
    ],
  },
  {
    labelKey: 'cat_promo',
    icon: <Crown className="h-4 w-4" />,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    items: [
      { key: 'promo_bundles' },
      { key: 'promo_bogo' },
      { key: 'promo_volume' },
      { key: 'promo_giftcards' },
      { key: 'loyalty_program' },
      { key: 'recurring_subscriptions' },
      { key: 'gamification' },
    ],
  },
  {
    labelKey: 'cat_billing',
    icon: <ShoppingCart className="h-4 w-4" />,
    color: 'bg-green-50 text-green-700 border-green-200',
    items: [
      { key: 'pos' },
      { key: 'facturX' },
      { key: 'peppol' },
      { key: 'multiCurrency' },
    ],
  },
  {
    labelKey: 'cat_advanced',
    icon: <Star className="h-4 w-4" />,
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    items: [
      { key: 'advancedAnalytics' },
      { key: 'prioritySupport' },
      { key: 'shop_health' },
      { key: 'live_activity' },
      { key: 'multi_warehouse' },
    ],
  },
];

function formatLimit(value: number | null, unlimited: string, locale: string) {
  if (value === null) return unlimited;
  return value.toLocaleString(locale);
}

function getTierGradient(planName: string): { header: string; button: string } {
  const lower = planName.toLowerCase();
  if (lower.includes('free') || lower.includes('gratis'))
    return { header: 'from-slate-200 via-slate-100 to-white', button: 'bg-slate-600 hover:bg-slate-700' };
  if (lower.includes('starter'))
    return { header: 'from-blue-200 via-indigo-100 to-white', button: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700' };
  if (lower.includes('pro'))
    return { header: 'from-teal-200 via-emerald-100 to-white', button: 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700' };
  return { header: 'from-amber-200 via-orange-100 to-white', button: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700' };
}

export function PlanFeatureDetailDialog({
  plan,
  currentPlanId,
  open,
  onOpenChange,
  onSelectPlan,
  currentPlanSortOrder = 0,
  isLoading,
}: PlanFeatureDetailDialogProps) {
  const { t, i18n } = useTranslation();
  if (!plan) return null;
  const fmt = (v: number | null) => formatLimit(v, t('billing.plan_detail.unlimited'), i18n.language || 'nl');
  const planName = planDisplayName(plan, t);

  const isCurrent = plan.id === currentPlanId;
  const isUpgrade = plan.sort_order > currentPlanSortOrder;
  const monthlyPrice = plan.monthly_price;
  const tierGradient = getTierGradient(plan.name);

  const enabledCount = plan.features
    ? Object.values(plan.features).filter(Boolean).length
    : 0;
  const totalCount = plan.features
    ? Object.keys(plan.features).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Premium gradient header */}
        <div className={cn('bg-gradient-to-br px-6 pt-8 pb-5', tierGradient.header)}>
          <DialogHeader>
            <div className="flex items-center justify-center gap-2">
              <DialogTitle className="text-2xl font-extrabold tracking-tight">{planName}</DialogTitle>
              {plan.highlighted && (
                <Badge className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 shadow-sm">
                  <Crown className="h-3 w-3 mr-1" />
                  {t('billing.plan_detail.popular')}
                </Badge>
              )}
            </div>
            <DialogDescription className="sr-only">
              {t('billing.plan_detail.all_features', { plan: planName })}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 text-center">
            <span className="text-5xl font-extrabold tracking-tight">
              €{monthlyPrice}
            </span>
            <span className="text-muted-foreground text-lg">{t('billing.plan_detail.per_month')}</span>
          </div>

          {/* Feature progress bar */}
          <div className="mt-4 max-w-[200px] mx-auto">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>{t('billing.plan_detail.features_count', { count: enabledCount })}</span>
              <span>{t('billing.plan_detail.total_count', { count: totalCount })}</span>
            </div>
            <div className="h-2 rounded-full bg-white/60 overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                style={{ width: `${totalCount > 0 ? (enabledCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Limits grid */}
        <div className="px-6 py-4 grid grid-cols-4 gap-2 border-b">
          {[
            { icon: <Package className="h-4 w-4 text-blue-500" />, label: t('billing.usage_labels.products'), value: fmt(plan.limit_products) },
            { icon: <ShoppingCart className="h-4 w-4 text-green-500" />, label: t('billing.plan_detail.orders_per_month'), value: fmt(plan.limit_orders) },
            { icon: <UserPlus className="h-4 w-4 text-amber-500" />, label: t('billing.usage_labels.users'), value: String(plan.limit_users) },
            // MAIL-LIMIT-UI: uit pricing_plans.limit_marketing_emails_monthly (null = onbeperkt).
            ...(plan.limit_marketing_emails_monthly === undefined ? [] : [
              { icon: <Mail className="h-4 w-4 text-purple-500" />, label: t('billing.plan_limits.marketing_emails'), value: fmt(plan.limit_marketing_emails_monthly) },
            ]),
          ].map((item) => (
            <div key={item.label} className="text-center p-2.5 rounded-xl bg-muted/40">
              <div className="flex justify-center mb-1">{item.icon}</div>
              <div className="text-sm font-bold">{item.value}</div>
              <div className="text-[10px] text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Feature categories */}
        <ScrollArea className="max-h-[42vh] px-6 py-4">
          <div className="space-y-4">
            {featureCategories.map((category) => {
              const enabledInCat = category.items.filter(item => plan.features?.[item.key]).length;
              return (
                <div key={category.labelKey}>
                  <div className={cn(
                    'flex items-center justify-between px-3 py-1.5 rounded-lg border mb-2',
                    category.color
                  )}>
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      {category.icon}
                      {t(`billing.plan_detail.categories.${category.labelKey}`)}
                    </h4>
                    <span className="text-[10px] font-medium">{enabledInCat}/{category.items.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 px-1">
                    {category.items.map((item) => {
                      const enabled = plan.features?.[item.key] ?? false;
                      return (
                        <div
                          key={item.key}
                          className={cn(
                            'flex items-center gap-2 py-1.5 px-2 rounded-md text-sm transition-colors',
                            enabled ? 'text-foreground' : 'text-muted-foreground/40'
                          )}
                        >
                          {enabled ? (
                            <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              <Check className="h-2.5 w-2.5 text-green-600" />
                            </div>
                          ) : (
                            <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <X className="h-2.5 w-2.5 text-muted-foreground/30" />
                            </div>
                          )}
                          <span className="text-xs">{t(`billing.plan_detail.features.${item.key}`)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t bg-muted/20">
          {isCurrent ? (
            <Button className="w-full" variant="outline" disabled>
              <Check className="h-4 w-4 mr-1" />
              {t('billing.plan_detail.current')}
            </Button>
          ) : isUpgrade ? (
            <Button
              className={cn('w-full text-white shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all', tierGradient.button)}
              onClick={() => {
                onSelectPlan(plan.id, true);
                onOpenChange(false);
              }}
              disabled={isLoading}
            >
              <ArrowUp className="h-4 w-4 mr-1" />
              {t('billing.plan_detail.upgrade_to', { plan: planName })}
            </Button>
          ) : (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                onSelectPlan(plan.id, false);
                onOpenChange(false);
              }}
              disabled={isLoading}
            >
              <ArrowDown className="h-4 w-4 mr-1" />
              {t('billing.plan_detail.downgrade_to', { plan: planName })}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
