import { Link } from 'react-router-dom';
import { Plus, ShoppingCart, Package, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface QuickAction {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  pageId: string;
  variant?: 'default' | 'outline';
}

// Labels staan als i18n-key; `pageId` en `to` blijven letterlijk.
const ACTIONS: QuickAction[] = [
  { to: '/admin/products/new', icon: Plus, labelKey: 'admin.widgets.quickActionsWidget.actions.products', pageId: 'products' },
  { to: '/admin/orders', icon: ShoppingCart, labelKey: 'admin.widgets.quickActionsWidget.actions.orders-all', pageId: 'orders-all', variant: 'outline' },
  { to: '/admin/categories', icon: Package, labelKey: 'admin.widgets.quickActionsWidget.actions.categories', pageId: 'categories', variant: 'outline' },
];

export function QuickActionsWidget() {
  const { t } = useTranslation();
  const { isPageHidden } = useTenantPageOverrides();
  const { isAdminView } = usePlatformViewMode();
  const { isPlatformAdmin } = useAuth();
  const bypass = isPlatformAdmin && isAdminView;

  const visible = ACTIONS.filter((a) => bypass || !isPageHidden(a.pageId));

  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.widgets.quickActionsWidget.snelle_acties')}</CardTitle>
        <CardDescription>{t('admin.widgets.quickActionsWidget.veelgebruikte_taken')}</CardDescription>
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
                {t(a.labelKey)}
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
