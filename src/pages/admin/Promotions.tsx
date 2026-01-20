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
  CreditCard
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

const promotionModules = [
  {
    id: 'discount-codes',
    title: 'Kortingscodes',
    description: 'Manuele codes die klanten kunnen invoeren',
    icon: Tag,
    href: '/admin/orders/discounts',
    color: 'bg-orange-500',
  },
  {
    id: 'bundles',
    title: 'Product Bundels',
    description: 'Combineer producten voor een speciale prijs',
    icon: Package,
    href: '/admin/promotions/bundles',
    color: 'bg-blue-500',
  },
  {
    id: 'volume',
    title: 'Staffelkortingen',
    description: 'Korting op basis van bestelde hoeveelheid',
    icon: Layers,
    href: '/admin/promotions/volume',
    color: 'bg-green-500',
  },
  {
    id: 'bogo',
    title: 'BOGO Acties',
    description: 'Koop X krijg Y gratis of met korting',
    icon: Gift,
    href: '/admin/promotions/bogo',
    color: 'bg-purple-500',
  },
  {
    id: 'customer-groups',
    title: 'Klantengroepen',
    description: 'VIP prijzen en groepskortingen',
    icon: Users,
    href: '/admin/promotions/customer-groups',
    color: 'bg-indigo-500',
  },
  {
    id: 'auto',
    title: 'Automatische Kortingen',
    description: 'Kortingen die automatisch worden toegepast',
    icon: Zap,
    href: '/admin/promotions/auto',
    color: 'bg-amber-500',
  },
  {
    id: 'gifts',
    title: 'Cadeaus bij Aankoop',
    description: 'Gratis producten bij bepaalde aankopen',
    icon: Gift,
    href: '/admin/promotions/gifts',
    color: 'bg-pink-500',
  },
  {
    id: 'loyalty',
    title: 'Loyaliteitsprogramma',
    description: 'Spaarpunten en VIP tiers',
    icon: Heart,
    href: '/admin/promotions/loyalty',
    color: 'bg-red-500',
  },
  {
    id: 'gift-cards',
    title: 'Cadeaukaarten',
    description: 'Digitale cadeaukaarten als betaalmiddel',
    icon: CreditCard,
    href: '/admin/promotions/gift-cards',
    color: 'bg-teal-500',
  },
  {
    id: 'stacking',
    title: 'Stapelregels',
    description: 'Bepaal welke kortingen mogen combineren',
    icon: Settings2,
    href: '/admin/promotions/stacking',
    color: 'bg-slate-500',
  },
];

export default function Promotions() {
  const { data: bundles = [] } = useBundles();
  const { data: volumeDiscounts = [] } = useVolumeDiscounts();
  const { data: bogoPromotions = [] } = useBogoPromotions();
  const { data: customerGroups = [] } = useCustomerGroups();
  const { data: autoDiscounts = [] } = useAutoDiscounts();
  const { data: giftPromotions = [] } = useGiftPromotions();
  const { data: loyaltyPrograms = [] } = useLoyaltyPrograms();
  const { data: discountCodes = [] } = useDiscountCodes({});
  const { data: giftCards = [] } = useGiftCards();

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

  const totalActive = 
    bundles.filter(b => b.is_active).length +
    volumeDiscounts.filter(v => v.is_active).length +
    bogoPromotions.filter(b => b.is_active).length +
    customerGroups.filter(c => c.is_active).length +
    autoDiscounts.filter(a => a.is_active).length +
    giftPromotions.filter(g => g.is_active).length +
    loyaltyPrograms.filter(l => l.is_active).length +
    discountCodes.filter(d => d.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Promoties & Kortingen</h1>
          <p className="text-muted-foreground">
            Beheer alle kortingsacties en promoties voor je webshop
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Actieve Promoties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Klantengroepen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{customerGroups.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Loyaliteitsprogramma's</CardTitle>
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
          return (
            <Card key={module.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${module.color} text-white`}>
                    <module.icon className="h-5 w-5" />
                  </div>
                  {counts.total > 0 && (
                    <Badge variant="secondary">
                      {counts.active}/{counts.total} actief
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-3">{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="w-full justify-between group-hover:bg-accent">
                  <NavLink to={module.href}>
                    Beheren
                    <ArrowRight className="h-4 w-4" />
                  </NavLink>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
