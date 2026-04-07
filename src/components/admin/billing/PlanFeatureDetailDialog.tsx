import { Check, X, Crown, Zap } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
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
  items: { label: string; key: keyof PricingPlanFeatures }[];
}

const featureCategories: FeatureCategory[] = [
  {
    label: 'Webshop & Tools',
    icon: <Zap className="h-4 w-4" />,
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
    icon: <Crown className="h-4 w-4" />,
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
    icon: <Zap className="h-4 w-4" />,
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
    icon: <Zap className="h-4 w-4" />,
    items: [
      { label: 'POS Kassa', key: 'pos' },
      { label: 'Factur-X e-facturen', key: 'facturX' },
      { label: 'Peppol e-invoicing', key: 'peppol' },
      { label: 'Multi-valuta', key: 'multiCurrency' },
    ],
  },
  {
    label: 'Geavanceerd',
    icon: <Zap className="h-4 w-4" />,
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

  const enabledCount = plan.features
    ? Object.values(plan.features).filter(Boolean).length
    : 0;
  const totalCount = plan.features
    ? Object.keys(plan.features).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl font-bold">{plan.name}</DialogTitle>
              {plan.highlighted && (
                <Badge className="bg-primary/20 text-primary border-0">
                  <Crown className="h-3 w-3 mr-1" />
                  Populair
                </Badge>
              )}
            </div>
            <DialogDescription className="sr-only">
              Alle features van het {plan.name} plan
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight">
              €{monthlyPrice}
            </span>
            <span className="text-muted-foreground">/mnd</span>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            {enabledCount} van {totalCount} features inbegrepen
          </p>
        </div>

        <Separator />

        {/* Limits */}
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Producten', value: formatLimit(plan.limit_products) },
            { label: 'Orders/mnd', value: formatLimit(plan.limit_orders) },
            { label: 'Klanten', value: formatLimit(plan.limit_customers) },
            { label: 'Teamleden', value: String(plan.limit_users) },
          ].map((item) => (
            <div key={item.label} className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-sm font-semibold">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Feature categories */}
        <ScrollArea className="max-h-[45vh] px-6 py-4">
          <div className="space-y-5">
            {featureCategories.map((category) => (
              <div key={category.label}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  {category.icon}
                  {category.label}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {category.items.map((item) => {
                    const enabled = plan.features?.[item.key] ?? false;
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          'flex items-center gap-2 py-1 text-sm',
                          !enabled && 'text-muted-foreground/50'
                        )}
                      >
                        {enabled ? (
                          <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                        )}
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <Separator />
        <div className="px-6 py-4">
          {isCurrent ? (
            <Button className="w-full" variant="outline" disabled>
              Huidig plan
            </Button>
          ) : isUpgrade ? (
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                onSelectPlan(plan.id, true);
                onOpenChange(false);
              }}
              disabled={isLoading}
            >
              <Zap className="h-4 w-4 mr-1" />
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
              Downgrade naar {plan.name}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
