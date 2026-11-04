// UREN-1 — compacte weergave van de openingsuren (alleen lezen), voor de plekken die ze overnemen.
import { useTranslation } from 'react-i18next';
import { groupWeek, todayYmd, type BusinessHours } from '@/lib/businessHours';
import { closureLabel, dayName } from './dayNames';

export function BusinessHoursSummary({ hours, showClosures = true }: { hours: BusinessHours; showClosures?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const today = todayYmd(hours.timezone);
  const upcoming = hours.closures.filter((c) => c.to >= today).slice(0, 3);
  return (
    <div className="space-y-2 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {groupWeek(hours.week).map((g) => (
          <div key={g.days.join()} className="contents">
            <dt className="capitalize text-muted-foreground">
              {g.days.length === 1 ? dayName(lang, g.days[0], 'short') : `${dayName(lang, g.days[0], 'short')} – ${dayName(lang, g.days[g.days.length - 1], 'short')}`}
            </dt>
            <dd className="m-0">{g.ranges.length ? g.ranges.map((r) => `${r[0]}–${r[1]}`).join(', ') : t('settings.businessHours.closed')}</dd>
          </div>
        ))}
      </dl>
      {showClosures && upcoming.length ? (
        <p className="text-muted-foreground">
          {t('settings.businessHours.closed_on')}{' '}
          {upcoming.map((c) => `${closureLabel(lang, c.from, c.to)}${c.reason ? ` (${c.reason})` : ''}`).join(', ')}
        </p>
      ) : null}
    </div>
  );
}
