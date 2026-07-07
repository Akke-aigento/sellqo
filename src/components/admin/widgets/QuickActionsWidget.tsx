import { Link } from 'react-router-dom';
import { Plus, ShoppingCart, Package, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { useAuth } from '@/hooks/useAuth';

interface QuickAction {
  to: string;
  icon: LucideIcon;
  label: string;
  pageId: string;
  variant?: 'default' | 'outline';
}

const ACTIONS: QuickAction[] = [
  { to: '/admin/products/new', icon: Plus, label: 'Nieuw product toevoegen', pageId: 'products' },
  { to: '/admin/orders', icon: ShoppingCart, label: 'Bestellingen bekijken', pageId: 'orders-all', variant: 'outline' },
  { to: '/admin/categories', icon: Package, label: 'Categorieën beheren', pageId: 'categories', variant: 'outline' },
];

export function QuickActionsWidget() {
  const { isPageHidden } = useTenantPageOverrides();
  const { isAdminView } = usePlatformViewMode();
  const { isPlatformAdmin } = useAuth();
  const bypass = isPlatformAdmin && isAdminView;

  const visible = ACTIONS.filter((a) => bypass || !isPageHidden(a.pageId));

  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Snelle acties</CardTitle>
        <CardDescription>Veelgebruikte taken</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((a) => {
          const Icon = a.icon;
          return (
            <Button
              key={a.to}
              asChild
              variant={a.variant ?? 'default'}
              className="w-full justify-start"
            >
              <Link to={a.to}>
                <Icon className="mr-2 h-4 w-4" />
                {a.label}
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
