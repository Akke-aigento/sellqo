// UREN-1 — weekschema bewerken: per dag open/gesloten, één tot drie blokken (bv. 11:30–14:00 en
// 17:30–22:00). "tot" vóór "van" = tot na middernacht (bv. een café tot 02:00).
import { useTranslation } from 'react-i18next';
import { Moon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { MAX_RANGES, WEEK_ORDER, crossesMidnight, validRange, type Range, type Week } from '@/lib/businessHours';
import { dayName } from './dayNames';

export function WeekHoursEditor({ week, onChange, disabled = false }: { week: Week; onChange: (w: Week) => void; disabled?: boolean }) {
  const { t, i18n } = useTranslation();
  const setDay = (d: string, ranges: Range[]) => onChange({ ...week, [d]: ranges });
  return (
    <div className="space-y-1">
      <ul className="divide-y rounded-md border">
        {WEEK_ORDER.map((d) => {
          const name = dayName(i18n.language, d);
          const ranges = week[d] || [];
          const open = ranges.length > 0;
          return (
            <li key={d} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <span className="w-24 shrink-0 text-sm font-medium capitalize">{name}</span>
              <Switch checked={open} disabled={disabled} aria-label={t('settings.businessHours.day_open', { day: name })}
                onCheckedChange={(v) => setDay(d, v ? [['11:30', '22:00']] : [])} />
              {!open ? <span className="text-sm text-muted-foreground">{t('settings.businessHours.closed')}</span> : null}
              {open ? (
                <div className="flex min-w-0 flex-1 basis-full flex-col gap-2 sm:basis-auto">
                  {ranges.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                      <Input type="time" step={300} value={r[0]} disabled={disabled} aria-label={t('settings.businessHours.from')}
                        className="h-9 w-[7rem]" onChange={(e) => setDay(d, ranges.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} />
                      <span className="text-muted-foreground" aria-hidden>–</span>
                      <Input type="time" step={300} value={r[1]} disabled={disabled} aria-label={t('settings.businessHours.to')}
                        className="h-9 w-[7rem]" onChange={(e) => setDay(d, ranges.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} />
                      {ranges.length > 1 ? (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={disabled}
                          aria-label={t('settings.businessHours.remove_block')} onClick={() => setDay(d, ranges.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {crossesMidnight(r) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Moon className="h-3.5 w-3.5" aria-hidden />{t('settings.businessHours.after_midnight')}</span>
                      ) : null}
                      {!validRange(r) ? <span role="alert" className="text-xs text-destructive">{t('settings.businessHours.range_invalid')}</span> : null}
                    </div>
                  ))}
                  {ranges.length < MAX_RANGES ? (
                    <Button type="button" variant="ghost" size="sm" className="h-8 self-start px-2 text-xs" disabled={disabled}
                      onClick={() => setDay(d, [...ranges, ['17:30', '22:00']])}>
                      <Plus className="mr-1 h-3.5 w-3.5" />{t('settings.businessHours.add_block')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button type="button" variant="link" size="sm" className="h-auto px-0" disabled={disabled || !(week['1'] || []).length}
        onClick={() => onChange(Object.fromEntries(WEEK_ORDER.map((d) => [d, d === '1' || (week[d] || []).length ? (week['1'] || []).map((r) => [...r] as Range) : []])))}>
        {t('settings.businessHours.copy_monday')}
      </Button>
    </div>
  );
}
