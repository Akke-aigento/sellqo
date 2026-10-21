import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency } from '@/lib/utils';
import type { CockpitRevenue } from '@/lib/cockpitRevenue';
import { CockpitNoAccess } from './CockpitNoAccess';

interface Props {
  canRead: boolean;
  data: CockpitRevenue | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** Mobiel: omzet vandaag + bestellingen vandaag. */
export function TodayRevenueTiles({ canRead, data, isLoading, isError }: Props) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';

  const value = (v: string) => {
    if (!canRead) return <CockpitNoAccess compact />;
    if (isLoading) return <Skeleton className="h-7 w-20" />;
    if (isError || !data) return <span className="text-sm text-muted-foreground">{t('admin.cockpit.load_failed')}</span>;
    return <span className="text-2xl font-bold tracking-tight tabular-nums">{v}</span>;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
        <span className="text-xs font-medium text-muted-foreground">{t('admin.cockpit.today.revenue')}</span>
        {value(formatCurrency(data?.todayRevenue ?? 0, currency))}
      </div>
      <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
        <span className="text-xs font-medium text-muted-foreground">{t('admin.cockpit.today.orders')}</span>
        {value(String(data?.todayOrders ?? 0))}
      </div>
    </div>
  );
}
