import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NavLink } from 'react-router-dom';
import { 
  Package, 
  Layers, 
  Gift, 
  Users, 
  Zap, 
  Heart, 
  Settings2,
  ArrowRight,
  Tag,
  CreditCard,
  Lock
} from 'lucide-react';
import { useBundles } from '@/hooks/useBundles';
import { useVolumeDiscounts } from '@/hooks/useVolumeDiscounts';
import { useBogoPromotions } from '@/hooks/useBogoPromotions';
import { useCustomerGroups } from '@/hooks/useCustomerGroups';
import { useAutoDiscounts } from '@/hooks/useAutoDiscounts';
import { useGiftPromotions } from '@/hooks/useGiftPromotions';
import { useLoyaltyPrograms } from '@/hooks/useLoyalty';
import { useDiscountCodes } from '@/hooks/useDiscountCodes';
import { useGiftCards } from '@/hooks/useGiftCards';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface PromotionModule {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  href: string;
  color: string;
  featureKey?: string;
}

// Labels staan als i18n-key; `id`, `href` en `featureKey` blijven letterlijk.
const promotionModules: PromotionModule[] = [
  {
    id: 'discount-codes',
    titleKey: 'admin.promotions.modules.discount-codes.title',
    descriptionKey: 'admin.promotions.modules.discount-codes.description',
    icon: Tag,
    href: '/admin/orders/discounts',
    color: 'bg-orange-500',
  },
  {
    id: 'bundles',
    titleKey: 'admin.promotions.modules.bundles.title',
    descriptionKey: 'admin.promotions.modules.bundles.description',
    icon: Package,
    href: '/admin/promotions/bundles',
    color: 'bg-blue-500',
    featureKey: 'promo_bundles',
  },
  {
    id: 'volume',
    titleKey: 'admin.promotions.modules.volume.title',
    descriptionKey: 'admin.promotions.modules.volume.description',
    icon: Layers,
    href: '/admin/promotions/volume',
    color: 'bg-green-500',
    featureKey: 'promo_volume',
  },
  {
    id: 'bogo',
    titleKey: 'admin.promotions.modules.bogo.title',
    descriptionKey: 'admin.promotions.modules.bogo.description',
    icon: Gift,
    href: '/admin/promotions/bogo',
    color: 'bg-purple-500',
    featureKey: 'promo_bogo',
  },
  {
    id: 'customer-groups',
    titleKey: 'admin.promotions.modules.customer-groups.title',
    descriptionKey: 'admin.promotions.modules.customer-groups.description',
    icon: Users,
    href: '/admin/promotions/customer-groups',
    color: 'bg-indigo-500',
  },
  {
    id: 'auto',
    titleKey: 'admin.promotions.modules.auto.title',
    descriptionKey: 'admin.promotions.modules.auto.description',
    icon: Zap,
    href: '/admin/promotions/auto',
    color: 'bg-amber-500',
  },
  {
    id: 'gifts',
    titleKey: 'admin.promotions.modules.gifts.title',
    descriptionKey: 'admin.promotions.modules.gifts.description',
    icon: Gift,
    href: '/admin/promotions/gifts',
    color: 'bg-pink-500',
  },
  {
    id: 'loyalty',
    titleKey: 'admin.promotions.modules.loyalty.title',
    descriptionKey: 'admin.promotions.modules.loyalty.description',
    icon: Heart,
    href: '/admin/promotions/loyalty',
    color: 'bg-red-500',
    featureKey: 'loyalty_program',
  },
  {
    id: 'gift-cards',
    titleKey: 'admin.promotions.modules.gift-cards.title',
    descriptionKey: 'admin.promotions.modules.gift-cards.description',
    icon: CreditCard,
    href: '/admin/promotions/gift-cards',
    color: 'bg-teal-500',
    featureKey: 'promo_giftcards',
  },
  {
    id: 'stacking',
    titleKey: 'admin.promotions.modules.stacking.title',
    descriptionKey: 'admin.promotions.modules.stacking.description',
    icon: Settings2,
    href: '/admin/promotions/stacking',
    color: 'bg-slate-500',
  },
];

export default function Promotions() {
  const { t } = useTranslation();
  const { data: bundles = [] } = useBundles();
  const { data: volumeDiscounts = [] } = useVolumeDiscounts();
  const { data: bogoPromotions = [] } = useBogoPromotions();
  const { data: customerGroups = [] } = useCustomerGroups();
  const { data: autoDiscounts = [] } = useAutoDiscounts();
  const { data: giftPromotions = [] } = useGiftPromotions();
  const { data: loyaltyPrograms = [] } = useLoyaltyPrograms();
  const { data: discountCodes = [] } = useDiscountCodes({});
  const { data: giftCards = [] } = useGiftCards();

  const { isFeatureGranted } = useTenantPageOverrides();
  const { subscription } = useTenantSubscription();
  const { isAdminView } = usePlatformViewMode();
  const { roles } = useAuth();
  const isPlatformAdmin = roles?.some((r: any) => r.role === 'platform_admin') || false;

  const isModuleLocked = (module: PromotionModule): boolean => {
    if (!module.featureKey) return false;
    if (isPlatformAdmin && isAdminView) return false;
    if (isFeatureGranted(module.featureKey)) return false;
    const features = subscription?.pricing_plan?.features as unknown as Record<string, boolean> | undefined;
    if (!features) return false;
    return features[module.featureKey] === false;
  };

  const getCounts = (id: string) => {
    switch (id) {
      case 'discount-codes':
        return { active: discountCodes.filter(d => d.is_active).length, total: discountCodes.length };
      case 'bundles':
        return { active: bundles.filter(b => b.is_active).length, total: bundles.length };
      case 'volume':
        return { active: volumeDiscounts.filter(v => v.is_active).length, total: volumeDiscounts.length };
      case 'bogo':
        return { active: bogoPromotions.filter(b => b.is_active).length, total: bogoPromotions.length };
      case 'customer-groups':
        return { active: customerGroups.filter(c => c.is_active).length, total: customerGroups.length };
      case 'auto':
        return { active: autoDiscounts.filter(a => a.is_active).length, total: autoDiscounts.length };
      case 'gifts':
        return { active: giftPromotions.filter(g => g.is_active).length, total: giftPromotions.length };
      case 'loyalty':
        return { active: loyaltyPrograms.filter(l => l.is_active).length, total: loyaltyPrograms.length };
      case 'gift-cards':
        return { active: giftCards.filter(g => g.status === 'active').length, total: giftCards.length };
      default:
        return { active: 0, total: 0 };
    }
  };

  // Only count accessible modules in totals
  const totalActive = promotionModules
    .filter(m => !isModuleLocked(m))
    .reduce((sum, m) => {
      const counts = getCounts(m.id);
      return sum + counts.active;
    }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('admin.promotions.promoties_kortingen')}</h1>
          <p className="text-muted-foreground">
            {t('admin.promotions.beheer_alle_kortingsacties_en_promoties_voor')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('admin.promotions.actieve_promoties')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('admin.promotions.modules.customer-groups.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{customerGroups.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('admin.loyaltyPrograms.loyaliteitsprogramma_s')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loyaltyPrograms.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotionModules.map((module) => {
          const counts = getCounts(module.id);
          const locked = isModuleLocked(module);
          return (
            <Card key={module.id} className={`group transition-shadow ${locked ? 'opacity-60' : 'hover:shadow-md'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${locked ? 'bg-muted text-muted-foreground' : `${module.color} text-white`}`}>
                    {locked ? <Lock className="h-5 w-5" /> : <module.icon className="h-5 w-5" />}
                  </div>
                  {locked ? (
                    <Badge variant="outline" className="border-amber-500 text-amber-600">
                      {t('admin.promotions.premium')}
                    </Badge>
                  ) : counts.total > 0 ? (
                    <Badge variant="secondary">
                      {counts.active}/{counts.total} actief
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-lg mt-3">{t(module.titleKey)}</CardTitle>
                <CardDescription>{t(module.descriptionKey)}</CardDescription>
              </CardHeader>
              <CardContent>
                {locked ? (
                  <Button asChild variant="outline" className="w-full justify-between border-amber-500 text-amber-600 hover:bg-amber-50">
                    <NavLink to="/admin/billing">
                      <span className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5" />
                        {t('admin.promotions.upgrade')}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </NavLink>
                  </Button>
                ) : (
                  <Button asChild variant="ghost" className="w-full justify-between group-hover:bg-accent">
                    <NavLink to={module.href}>
                      {t('admin.promotions.beheren')}
                      <ArrowRight className="h-4 w-4" />
                    </NavLink>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
