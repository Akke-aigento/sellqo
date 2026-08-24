import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export function RecentOrdersWidget() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('admin.widgets.recentOrdersWidget.recente_bestellingen')}</CardTitle>
          <CardDescription>{t('admin.widgets.recentOrdersWidget.laatste_5_bestellingen')}</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/orders">
            {t('admin.widgets.recentOrdersWidget.alles_bekijken')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ShoppingCart className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {t('admin.widgets.recentOrdersWidget.nog_geen_bestellingen')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('admin.widgets.recentOrdersWidget.bestellingen_verschijnen_hier_zodra_ze_binnenkomen')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
