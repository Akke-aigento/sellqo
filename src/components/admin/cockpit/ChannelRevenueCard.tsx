import { format, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTenant } from '@/hooks/useTenant';
import { cn, formatCurrency } from '@/lib/utils';
import type { CockpitRevenue } from '@/lib/cockpitRevenue';
import { channelLabel, channelSwatch } from './cockpitFormat';
import { CockpitNoAccess } from './CockpitNoAccess';

interface Props {
  canRead: boolean;
  data: CockpitRevenue | undefined;
  isLoading: boolean;
  isError: boolean;
}

const R = 40;
const C = 2 * Math.PI * R;

/** Omzet maand-tot-nu per kanaal als donut, vergeleken met dezelfde dagen vorige maand. */
export function ChannelRevenueCard({ canRead, data, isLoading, isError }: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';
  const now = data?.periods.now ?? new Date();

  const title = t('admin.cockpit.revenue.channel_mix', { month: format(now, 'LLLL', { locale }) });

  let body: React.ReactNode;
  if (!canRead) {
    body = <CockpitNoAccess />;
  } else if (isLoading) {
    body = (
      <div className="flex items-center gap-5">
        <Skeleton className="h-32 w-32 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  } else if (isError || !data) {
    body = <p className="text-sm text-muted-foreground">{t('admin.cockpit.load_failed')}</p>;
  } else {
    const { monthChannels, monthTotal, changePct, periods } = data;
    const end = periods.prevCompareEnd;
    const lastDay = end.getTime() === periods.monthStart.getTime() ? subDays(end, 1) : end;
    const compareLabel = t('admin.cockpit.revenue.compared_to', {
      range: `1–${format(lastDay, 'd MMM', { locale })}`,
    });
    let offset = 0;
    const arcs = monthTotal > 0
      ? monthChannels.map((c) => {
          const len = (c.revenue / monthTotal) * C;
          const arc = { key: c.channel, len, offset, swatch: channelSwatch(c.channel) };
          offset += len;
          return arc;
        })
      : [];

    body = (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          {changePct === null ? (
            t('admin.cockpit.revenue.no_comparison')
          ) : (
            <>
              <span className={cn('font-semibold', changePct >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
                {changePct > 0 ? '+' : ''}
                {changePct}%
              </span>{' '}
              {compareLabel}
            </>
          )}
        </p>
        {monthChannels.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.cockpit.revenue.no_sales_yet')}</p>
        ) : (
          <div className="flex items-center gap-5">
            <svg width="128" height="128" viewBox="0 0 100 100" className="shrink-0" role="img" aria-label={title}>
              <circle cx="50" cy="50" r={R} fill="none" strokeWidth="16" className="stroke-muted" />
              {arcs.map((a) => (
                <circle
                  key={a.key}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  strokeWidth="16"
                  className={a.swatch.stroke}
                  strokeDasharray={`${a.len} ${C}`}
                  strokeDashoffset={-a.offset}
                  transform="rotate(-90 50 50)"
                />
              ))}
              <text x="50" y="47" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {t('admin.cockpit.revenue.total')}
              </text>
              <text x="50" y="61" textAnchor="middle" className="fill-foreground text-[11px] font-extrabold">
                {formatCurrency(monthTotal, currency)}
              </text>
            </svg>
            <ul className="flex min-w-0 flex-1 flex-col gap-3">
              {monthChannels.map((c) => (
                <li key={c.channel} className="flex items-center gap-2.5 text-sm">
                  <span className={cn('h-3 w-3 shrink-0 rounded', channelSwatch(c.channel).bg)} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{channelLabel(t, c.channel)}</span>
                  <span className="font-bold tabular-nums">{formatCurrency(c.revenue, currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="flex flex-col rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base first-letter:uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">{body}</CardContent>
    </Card>
  );
}
