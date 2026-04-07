import { Check, X, Crown, Zap, Package, ShoppingCart, Users, UserPlus, Sparkles, Star, ArrowUp, ArrowDown } from 'lucide-react';
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
  label: string;
  icon: React.ReactNode;
  color: string;
  items: { label: string; key: keyof PricingPlanFeatures }[];
}

const featureCategories: FeatureCategory[] = [
  {
    label: 'Webshop & Tools',
    icon: <Package className="h-4 w-4" />,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    items: [
      { label: 'Webshop Builder', key: 'webshop_builder' },
      { label: 'Visual Editor', key: 'visual_editor' },
      { label: 'Eigen domein', key: 'customDomain' },
      { label: 'Geen watermerk', key: 'removeWatermark' },
      { label: 'White-label', key: 'whiteLabel' },
    ],
  },
  {
    label: 'AI Tools',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    items: [
      { label: 'AI Marketing', key: 'ai_marketing' },
      { label: 'AI Copywriting', key: 'ai_copywriting' },
      { label: 'AI Afbeeldingen', key: 'ai_images' },
      { label: 'AI SEO', key: 'ai_seo' },
      { label: 'AI Business Coach', key: 'ai_coach' },
      { label: 'AI Chatbot', key: 'ai_chatbot' },
      { label: 'AI A/B Testing', key: 'ai_ab_testing' },
    ],
  },
  {
    label: 'Integraties & Kanalen',
    icon: <Zap className="h-4 w-4" />,
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    items: [
      { label: 'API toegang', key: 'apiAccess' },
      { label: 'Webhooks', key: 'webhooks' },
      { label: 'Bol.com integratie', key: 'bol_com' },
      { label: 'Bol.com VVB Labels', key: 'bol_vvb_labels' },
      { label: 'Amazon integratie', key: 'amazon' },
      { label: 'eBay integratie', key: 'ebay' },
      { label: 'Social Commerce', key: 'social_commerce' },
      { label: 'WhatsApp berichten', key: 'whatsapp' },
    ],
  },
  {
    label: 'Promoties & Loyaliteit',
    icon: <Crown className="h-4 w-4" />,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    items: [
      { label: 'Bundel aanbiedingen', key: 'promo_bundles' },
      { label: 'Buy One Get One', key: 'promo_bogo' },
      { label: 'Volume kortingen', key: 'promo_volume' },
      { label: 'Cadeaubonnen', key: 'promo_giftcards' },
      { label: 'Loyaliteitsprogramma', key: 'loyalty_program' },
      { label: 'Abonnementen', key: 'recurring_subscriptions' },
      { label: 'Gamification & Badges', key: 'gamification' },
    ],
  },
  {
    label: 'Facturatie & Betalingen',
    icon: <ShoppingCart className="h-4 w-4" />,
    color: 'bg-green-50 text-green-700 border-green-200',
    items: [
      { label: 'POS Kassa', key: 'pos' },
      { label: 'Factur-X e-facturen', key: 'facturX' },
      { label: 'Peppol e-invoicing', key: 'peppol' },
      { label: 'Multi-valuta', key: 'multiCurrency' },
    ],
  },
  {
    label: 'Geavanceerd',
    icon: <Star className="h-4 w-4" />,
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    items: [
      { label: 'Geavanceerde analytics', key: 'advancedAnalytics' },
      { label: 'Prioriteit support', key: 'prioritySupport' },
      { label: 'Shop Health Score', key: 'shop_health' },
      { label: 'Live Activity Feed', key: 'live_activity' },
      { label: 'Multi-warehouse', key: 'multi_warehouse' },
    ],
  },
];

function formatLimit(value: number | null) {
  if (value === null) return 'Onbeperkt';
  return value.toLocaleString('nl-NL');
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
  if (!plan) return null;

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
              <DialogTitle className="text-2xl font-extrabold tracking-tight">{plan.name}</DialogTitle>
              {plan.highlighted && (
                <Badge className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 shadow-sm">
                  <Crown className="h-3 w-3 mr-1" />
                  Populair
                </Badge>
              )}
            </div>
            <DialogDescription className="sr-only">
              Alle features van het {plan.name} plan
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 text-center">
            <span className="text-5xl font-extrabold tracking-tight">
              €{monthlyPrice}
            </span>
            <span className="text-muted-foreground text-lg">/mnd</span>
          </div>

          {/* Feature progress bar */}
          <div className="mt-4 max-w-[200px] mx-auto">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>{enabledCount} features</span>
              <span>{totalCount} totaal</span>
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
            { icon: <Package className="h-4 w-4 text-blue-500" />, label: 'Producten', value: formatLimit(plan.limit_products) },
            { icon: <ShoppingCart className="h-4 w-4 text-green-500" />, label: 'Orders/mnd', value: formatLimit(plan.limit_orders) },
            { icon: <Users className="h-4 w-4 text-purple-500" />, label: 'Klanten', value: formatLimit(plan.limit_customers) },
            { icon: <UserPlus className="h-4 w-4 text-amber-500" />, label: 'Team', value: String(plan.limit_users) },
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
                <div key={category.label}>
                  <div className={cn(
                    'flex items-center justify-between px-3 py-1.5 rounded-lg border mb-2',
                    category.color
                  )}>
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      {category.icon}
                      {category.label}
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
                          <span className="text-xs">{item.label}</span>
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
              Huidig plan
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
              Upgrade naar {plan.name}
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
              Downgrade naar {plan.name}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
