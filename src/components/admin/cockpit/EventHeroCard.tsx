import { Link } from 'react-router-dom';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { CalendarPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import type { CockpitEvent } from '@/hooks/useCockpitTracks';
import { cn } from '@/lib/utils';
import { HERO_SURFACE } from './cockpitFormat';
import { TicketScanButton } from './TicketScanButton';

interface Props {
  event: CockpitEvent | null | undefined;
  isLoading: boolean;
}

/** DASH-2b — volgend event: aftellen, verkocht tegenover capaciteit en de scanknop. */
export function EventHeroCard({ event, isLoading }: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();

  let body: React.ReactNode;
  if (isLoading && event === undefined) {
    body = (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32 bg-white/20" />
        <Skeleton className="h-8 w-64 bg-white/20" />
        <Skeleton className="h-3 w-full bg-white/10" />
      </div>
    );
  } else if (!event) {
    body = (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">{t('admin.cockpit.event.next')}</span>
        <h2 className="text-2xl font-extrabold tracking-tight">{t('admin.cockpit.event.none')}</h2>
        <Link to="/admin/events" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          {t('admin.cockpit.event.plan')}
        </Link>
      </div>
    );
  } else {
    const date = parseISO(event.date);
    const days = differenceInCalendarDays(date, new Date());
    const when = [
      format(date, 'EEEE d MMMM', { locale }),
      event.startTime ? event.startTime.slice(0, 5) : null,
      event.location,
    ]
      .filter(Boolean)
      .join(' · ');
    const pct = event.capacity ? Math.min(100, Math.round((event.sold / event.capacity) * 100)) : null;

    body = (
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">{t('admin.cockpit.event.next')}</span>
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{event.name}</h2>
            <span className="text-sm text-white/80 first-letter:uppercase">{when}</span>
          </div>
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#FF6B33] text-white">
            {days <= 0 ? (
              <span className="text-base font-extrabold">{t('admin.cockpit.event.today')}</span>
            ) : (
              <>
                <span className="text-3xl font-extrabold leading-none tabular-nums">{days}</span>
                <span className="text-xs font-bold">{t('admin.cockpit.event.days', { count: days })}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/80">{days <= 0 ? t('admin.cockpit.event.checked_in') : t('admin.cockpit.event.sold')}</span>
            <span className="font-bold tabular-nums">
              {days <= 0 ? `${event.checkedIn} / ${event.sold}` : event.capacity ? `${event.sold} / ${event.capacity}` : event.sold}
            </span>
          </div>
          {(days <= 0 ? event.sold > 0 : pct !== null) && (
            <div className="h-3 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-700"
                style={{ width: `${days <= 0 ? (event.checkedIn / Math.max(1, event.sold)) * 100 : pct}%` }}
              />
            </div>
          )}
          {event.soldLastWeek > 0 && days > 0 && (
            <span className="text-xs text-white/70">{t('admin.cockpit.event.this_week', { count: event.soldLastWeek })}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <section aria-label={t('admin.cockpit.event.next')} className={cn('flex flex-col gap-5 rounded-2xl p-5 md:flex-row md:items-end md:p-7', HERO_SURFACE)}>
      <div className="min-w-0 flex-1">{body}</div>
      <TicketScanButton className="md:w-72" />
    </section>
  );
}
