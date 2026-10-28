import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/hooks/useTenant';
import { cn, formatCurrency } from '@/lib/utils';
import type { CockpitRevenueData } from '@/hooks/useCockpitRevenue';
import { HERO_SURFACE, minuteLabel } from './cockpitFormat';
import { CockpitNoAccess } from './CockpitNoAccess';

interface Props {
  canRead: boolean;
  data: CockpitRevenueData | undefined;
  isLoading: boolean;
  isError: boolean;
  newCustomers: number | null;
  /** WERKPLEK-1/BETAAL-1: zonder klantenbestand (horeca-only) geen tegel "nieuwe klanten". */
  showCustomers?: boolean;
}

const W = 520;
const H = 124;
const BASE = 112;

/** DASH-2b — omzet vandaag, met een lijn per uur tegenover dezelfde weekdag vorige week. */
export function TodayHeroCard({ canRead, data, isLoading, isError, newCustomers, showCustomers = true }: Props) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';

  let body: React.ReactNode;
  if (!canRead) {
    body = <CockpitNoAccess />;
  } else if (isLoading) {
    body = (
      <div className="space-y-4">
        <Skeleton className="h-4 w-28 bg-white/20" />
        <Skeleton className="h-12 w-56 bg-white/20" />
        <Skeleton className="h-32 w-full bg-white/10" />
      </div>
    );
  } else if (isError || !data) {
    body = <p className="text-sm text-white/80">{t('admin.cockpit.load_failed')}</p>;
  } else {
    const h = data.hourly;
    const span = Math.max(1, h.endHour - h.startHour);
    const max = Math.max(1, h.todaySoFar, h.lastWeek[h.lastWeek.length - 1] ?? 0);
    const x = (hour: number) => ((hour - h.startHour) / span) * W;
    const y = (v: number) => BASE - (v / max) * (BASE - 8);
    const lastWeekPts = h.lastWeek.map((v, i) => `${x(h.startHour + i)},${y(v)}`).join(' ');
    const todayPts = [...h.today.map((v, i) => [x(h.startHour + i), y(v)]), [x(h.nowHour), y(h.todaySoFar)]];
    const todayLine = todayPts.map(([a, b]) => `${a},${b}`).join(' ');
    const area = `${todayLine} ${x(h.nowHour)},${BASE} ${x(h.startHour)},${BASE}`;
    const [nx, ny] = todayPts[todayPts.length - 1];
    const ticks: number[] = [];
    const step = span > 12 ? 3 : 2;
    for (let hr = h.startHour; hr <= h.endHour; hr += step) ticks.push(hr);
    const avg = data.todayOrders > 0 ? data.todayRevenue / data.todayOrders : null;
    const time = minuteLabel(Math.floor(h.nowHour * 60));

    body = (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {t('admin.cockpit.today.revenue')}
            </span>
            <span className="text-4xl font-extrabold leading-none tracking-tight tabular-nums md:text-5xl">
              {formatCurrency(data.todayRevenue, currency)}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-white/80">
              {h.changePct === null ? (
                t('admin.cockpit.today.no_compare')
              ) : (
                <>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-bold text-white',
                      h.changePct >= 0 ? 'bg-[#FF6B33]' : 'bg-white/20',
                    )}
                  >
                    {h.changePct > 0 ? '+' : ''}
                    {h.changePct}%
                  </span>
                  {t('admin.cockpit.today.vs_last_week', { time })}
                </>
              )}
            </span>
          </div>
          <dl className={cn('grid gap-4 md:gap-7', showCustomers ? 'grid-cols-3' : 'grid-cols-2')}>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-white/70 md:text-sm">{t('admin.cockpit.today.orders_short')}</dt>
              <dd className="text-xl font-bold tabular-nums md:text-2xl">{data.todayOrders}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-white/70 md:text-sm">{t('admin.cockpit.today.average')}</dt>
              <dd className="text-xl font-bold tabular-nums md:text-2xl">
                {avg === null ? '–' : formatCurrency(avg, currency)}
              </dd>
            </div>
            {showCustomers ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-white/70 md:text-sm">{t('admin.cockpit.today.new_customers')}</dt>
                <dd className="text-xl font-bold tabular-nums md:text-2xl">{newCustomers ?? '–'}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div>
          <div className="relative">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="block h-28 w-full md:h-36"
              role="img"
              aria-label={t('admin.cockpit.today.chart_label')}
            >
              <line x1="0" y1={BASE} x2={W} y2={BASE} className="stroke-white/20" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {h.lastWeek.length > 1 && (
                <polyline
                  points={lastWeekPts}
                  fill="none"
                  className="stroke-white/45"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <polygon points={area} className="fill-white/10" />
              <polyline
                points={todayLine}
                fill="none"
                className="stroke-white"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {/* De "nu"-stip als element, zodat hij rond blijft (de svg rekt mee met de breedte). */}
            <span
              className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#FF6B33]"
              style={{ left: `${(nx / W) * 100}%`, top: `${(ny / H) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="flex justify-between text-xs text-white/70">
            {ticks.map((hr) => (
              <span key={hr}>{minuteLabel(hr * 60)}</span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-5 text-xs text-white/80">
            <span className="inline-flex items-center gap-2">
              <span className="h-[3px] w-4 rounded bg-white" aria-hidden="true" />
              {t('admin.cockpit.today.legend_today')}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-4 border-t-2 border-dashed border-white/50" aria-hidden="true" />
              {t('admin.cockpit.today.legend_last_week')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section aria-label={t('admin.cockpit.today.revenue')} className={cn('rounded-2xl p-5 md:p-7', HERO_SURFACE)}>
      {body}
    </section>
  );
}
