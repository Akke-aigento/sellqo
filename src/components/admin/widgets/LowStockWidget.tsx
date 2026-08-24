import { AlertTriangle, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

export function LowStockWidget() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          {t('admin.marketing.productSelectDialog.lage_voorraad')}
        </CardTitle>
        <CardDescription>
          {t('admin.widgets.lowStockWidget.producten_die_bijna_op_zijn')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Package className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {t('admin.widgets.lowStockWidget.geen_producten_met_lage_voorraad')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
