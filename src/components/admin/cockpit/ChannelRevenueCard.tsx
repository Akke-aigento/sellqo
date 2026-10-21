import { format, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTenant } from '@/hooks/useTenant';
import { cn, formatCurrency } from '@/lib/utils';
import type { CockpitRevenue } from '@/lib/cockpitRevenue';
import { CHANNEL_COLORS, channelLabel } from './cockpitFormat';
import { CockpitNoAccess } from './CockpitNoAccess';

interface Props {
  canRead: boolean;
  data: CockpitRevenue | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** Omzet maand-tot-nu per kanaal, vergeleken met dezelfde dagen vorige maand. */
export function ChannelRevenueCard({ canRead, data, isLoading, isError }: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';
  const now = data?.periods.now ?? new Date();

  const title = t('admin.cockpit.revenue.month_to_date', { month: format(now, 'LLLL', { locale }) });

  let body: React.ReactNode;
  if (!canRead) {
    body = <CockpitNoAccess />;
  } else if (isLoading) {
    body = (
      <div className="space-y-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  } else if (isError || !data) {
    body = <p className="text-sm text-muted-foreground">{t('admin.cockpit.load_failed')}</p>;
  } else {
    const { monthChannels, monthTotal, changePct, periods } = data;
    // Vergelijkingsperiode als "1–20 sep": einde is exclusief, dus de dag ervóór tonen
    // als de grens op middernacht valt (hele vorige maand).
    const end = periods.prevCompareEnd;
    const lastDay = end.getTime() === periods.monthStart.getTime() ? subDays(end, 1) : end;
    const compareLabel = t('admin.cockpit.revenue.compared_to', {
      range: `1–${format(lastDay, 'd MMM', { locale })}`,
    });
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold tracking-tight">{formatCurrency(monthTotal, currency)}</span>
          {changePct === null ? (
            <span className="text-sm text-muted-foreground">{t('admin.cockpit.revenue.no_comparison')}</span>
          ) : (
            <span
              className={cn(
                'text-sm font-semibold',
                changePct >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400',
              )}
            >
              {changePct > 0 ? '+' : ''}
              {changePct}%
            </span>
          )}
          <span className="text-xs text-muted-foreground">{compareLabel}</span>
        </div>

        {monthChannels.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.cockpit.revenue.no_sales_yet')}</p>
        ) : (
          <>
            {monthTotal > 0 && (
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                {monthChannels.map((c, i) => (
                  <div
                    key={c.channel}
                    className={CHANNEL_COLORS[i % CHANNEL_COLORS.length]}
                    style={{ width: `${(c.revenue / monthTotal) * 100}%` }}
                  />
                ))}
              </div>
            )}
            <ul className="flex flex-col gap-2.5">
              {monthChannels.map((c, i) => (
                <li key={c.channel} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', CHANNEL_COLORS[i % CHANNEL_COLORS.length])}
                      aria-hidden="true"
                    />
                    <span className="truncate">{channelLabel(t, c.channel)}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatCurrency(c.revenue, currency)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg first-letter:uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
