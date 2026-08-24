import { Package, ShoppingCart, Euro, AlertTriangle } from 'lucide-react';
import { StatsCard } from '@/components/admin/StatsCard';
import { useTranslation } from 'react-i18next';

export function StatsGridWidget() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title={t('admin.widgets.statsGridWidget.omzet_deze_maand')}
        value="€0,00"
        description={t('admin.widgets.statsGridWidget.vs_vorige_maand')}
        icon={Euro}
        trend={{ value: 0, isPositive: true }}
      />
      <StatsCard
        title={t('admin.customers.bestellingen')}
        value="0"
        description={t('admin.widgets.statsGridWidget.deze_maand')}
        icon={ShoppingCart}
      />
      <StatsCard
        title={t('admin.widgets.statsGridWidget.actieve_producten')}
        value="0"
        description={t('admin.widgets.statsGridWidget.in_catalogus')}
        icon={Package}
      />
      <StatsCard
        title={t('admin.widgets.statsGridWidget.openstaande_bestellingen')}
        value="0"
        description={t('admin.widgets.statsGridWidget.te_verwerken')}
        icon={AlertTriangle}
      />
    </div>
  );
}
