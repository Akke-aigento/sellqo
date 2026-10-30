// RESERVATIE-1 — reservaties van één dag, met de acties per reservatie. Kassa en beheer delen dit.
// Niets is definitief: geannuleerd, niet gekomen of aangekomen zet je met "Terugzetten" weer op geboekt.
import { useTranslation } from 'react-i18next';
import { Globe, Mail, Phone, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isLate, timeLabel, type Reservation, type ReservationSettings, type ReservationStatus } from '@/lib/horeca/reservations';

const TONE: Record<ReservationStatus, string> = {
  // RESERVATIE-2: online aanvraag die op een antwoord wacht.
  requested: 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50',
  declined: 'border-slate-300 text-muted-foreground line-through',
  booked: 'border-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950 dark:text-violet-50',
  seated: 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
  cancelled: 'border-slate-300 text-muted-foreground line-through',
  no_show: 'border-slate-300 text-muted-foreground',
};

export function ReservationList({ list, settings, tableLabel, now, onSeat, onEdit, onStatus, emptyText, showDate = false }: {
  list: Reservation[];
  settings: ReservationSettings;
  tableLabel: (id: string | null) => string | null;
  now: number;
  onSeat: (r: Reservation) => void;
  onEdit: (r: Reservation) => void;
  onStatus: (r: Reservation, s: ReservationStatus) => void;
  emptyText: string;
  /** RESERVATIE-2: ook de dag tonen (aanvragen over meerdere dagen). */
  showDate?: boolean;
}) {
  const { t, i18n } = useTranslation();
  if (!list.length) return emptyText ? <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p> : null;
  const btn = 'h-11 rounded-md border px-3 text-sm font-semibold';
  return (
    <ul className="space-y-2">
      {list.map((r) => {
        const late = isLate(r, now, settings);
        const table = r.table_id ? tableLabel(r.table_id) : null;
        return (
          <li key={r.id} className={cn('rounded-lg border-l-4 border p-3', TONE[r.status])}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {showDate ? <span className="w-full text-xs font-semibold capitalize">{new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(r.starts_at))}</span> : null}
              <span className="text-lg font-bold tabular-nums">{timeLabel(r.starts_at, i18n.language)}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <span className="flex items-center gap-1 text-sm"><Users className="h-4 w-4" aria-hidden />{r.guests}</span>
              <span className="text-sm">{table ? t('reservations.tableShort', { label: table }) : t('reservations.noTable')}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
              {r.status !== 'booked' ? <span className="font-semibold">{t(`reservations.status.${r.status}`)}</span> : late ? <span className="font-semibold text-destructive">{t('reservations.late')}</span> : null}
              {r.source === 'online' ? <span className="flex items-center gap-1"><Globe className="h-3 w-3" aria-hidden />{t('reservations.online')}</span> : null}
              {r.email ? <a href={`mailto:${r.email}`} className="flex items-center gap-1 underline"><Mail className="h-3 w-3" aria-hidden />{r.email}</a> : null}
              {r.phone ? <a href={`tel:${r.phone.replace(/\s+/g, '')}`} className="flex items-center gap-1 underline"><Phone className="h-3 w-3" aria-hidden />{r.phone}</a> : null}
              {r.note ? <span className="italic">“{r.note}”</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.status === 'requested' ? (
                <>
                  <button type="button" className={cn(btn, 'border-transparent bg-primary text-primary-foreground')} onClick={() => onStatus(r, 'booked')}>{t('reservations.confirm')}</button>
                  <button type="button" className={btn} onClick={() => onEdit(r)}>{t('reservations.edit')}</button>
                  <button type="button" className={cn(btn, 'text-destructive')} onClick={() => onStatus(r, 'declined')}>{t('reservations.decline')}</button>
                </>
              ) : r.status === 'booked' ? (
                <>
                  <button type="button" className={cn(btn, 'border-transparent bg-primary text-primary-foreground')} onClick={() => onSeat(r)}>{t('reservations.seat')}</button>
                  <button type="button" className={btn} onClick={() => onEdit(r)}>{t('reservations.edit')}</button>
                  <button type="button" className={btn} onClick={() => onStatus(r, 'no_show')}>{t('reservations.noShow')}</button>
                  <button type="button" className={cn(btn, 'text-destructive')} onClick={() => onStatus(r, 'cancelled')}>{t('reservations.cancel')}</button>
                </>
              ) : (
                <button type="button" className={btn} onClick={() => onStatus(r, 'booked')}>{t('reservations.restore')}</button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
