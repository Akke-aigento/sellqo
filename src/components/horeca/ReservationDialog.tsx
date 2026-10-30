// RESERVATIE-1 — één venster om een reservatie te maken of te wijzigen, in de kassa én in het beheer.
// Velden van 16 px (geen zoom op iOS), grote knoppen, aantal met − en +.
// Het gsm-nummer is optioneel en wordt 30 dagen na de reservatie automatisch gewist.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Minus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { nextHalfHour, type Reservation, type ReservationInput } from '@/lib/horeca/reservations';

const pad = (n: number) => String(n).padStart(2, '0');
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function ReservationDialog({ initial, tables, defaultTableId, defaultDate, onClose, onSave }: {
  /** Bestaande reservatie = wijzigen. */
  initial?: Reservation | null;
  tables: { id: string; label: string }[];
  defaultTableId?: string | null;
  /** Dag waarop het venster opent (beheer: de gekozen dag). */
  defaultDate?: Date;
  onClose: () => void;
  onSave: (r: ReservationInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const start = initial ? new Date(initial.starts_at) : (() => {
    const base = nextHalfHour(new Date());
    if (!defaultDate) return base;
    const d = new Date(defaultDate);
    d.setHours(base.getHours(), base.getMinutes(), 0, 0);
    return d;
  })();
  const [name, setName] = useState(initial?.name ?? '');
  const [guests, setGuests] = useState(initial?.guests ?? 2);
  const [date, setDate] = useState(dateValue(start));
  const [time, setTime] = useState(timeValue(start));
  const [tableId, setTableId] = useState<string>(initial?.table_id ?? defaultTableId ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startsAt = (() => {
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const dt = new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  })();
  const valid = name.trim().length > 0 && !!startsAt && guests >= 1;
  const field = 'h-11 w-full rounded-md border bg-background px-3 text-base';
  const sorted = [...tables].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const save = async () => {
    if (!valid || !startsAt) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ name, guests, phone, note, table_id: tableId || null, starts_at: startsAt.toISOString() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? t('reservations.editTitle') : t('reservations.newTitle')}</DialogTitle>
          <DialogDescription>{t('reservations.dialogHint')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">{t('reservations.name')}</span>
            <input autoFocus={!initial} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{t('reservations.guests')}</span>
            <button type="button" aria-label={t('reservations.fewer')} onClick={() => setGuests((g) => Math.max(1, g - 1))} className="flex h-11 w-11 items-center justify-center rounded-full border"><Minus className="h-4 w-4" /></button>
            <span className="w-8 text-center text-lg font-bold tabular-nums">{guests}</span>
            <button type="button" aria-label={t('reservations.more')} onClick={() => setGuests((g) => Math.min(99, g + 1))} className="flex h-11 w-11 items-center justify-center rounded-full border"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">{t('reservations.date')}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">{t('reservations.time')}</span>
              <input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">{t('reservations.table')}</span>
            <select value={tableId} onChange={(e) => setTableId(e.target.value)} className={field}>
              <option value="">{t('reservations.noTable')}</option>
              {sorted.map((tb) => <option key={tb.id} value={tb.id}>{tb.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">{t('reservations.phone')}</span>
            <input type="tel" inputMode="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} className={field} />
            <span className="block text-xs text-muted-foreground">{t('reservations.phoneHint')}</span>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">{t('reservations.note')}</span>
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t('reservations.notePlaceholder')} className={field} />
          </label>
          {error ? <p role="alert" className="text-sm text-destructive">{t('reservations.saveFailed', { detail: error })}</p> : null}
          <DialogFooter className="gap-2">
            <button type="button" onClick={onClose} className="h-11 rounded-md border px-4">{t('common.cancel')}</button>
            <button type="submit" disabled={!valid || busy} className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t('reservations.save')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
