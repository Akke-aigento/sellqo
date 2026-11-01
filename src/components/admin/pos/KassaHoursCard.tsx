// PERSONEEL-2 — uren van het kassapersoneel op /admin/pos?tab=personeel: per medewerker per week,
// open shifts, correcties (een correctie voegt een rij toe, de geklokte tijd blijft bewaard),
// CSV per week voor het sociaal secretariaat, en de fooienpot per dag (rapport, geen boeking).
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, format, getISOWeek } from 'date-fns';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useKassaHours } from '@/hooks/useKassaHours';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { downloadCsv, toCsv } from '@/lib/csvExport';
import {
  formatMinutes, hoursCsvRows, shiftMinutes, summarizeWeek, tipPot, weekQueryRange, weekStart, type HoursShift, type HoursStaff,
} from '@/lib/kassaHours';

interface FormState {
  mode: 'adjust' | 'add';
  shift: HoursShift | null;
  staffId: string;
  start: string; // datetime-local
  end: string;
  reason: string;
}

const toLocalInput = (iso: string | Date) => format(typeof iso === 'string' ? new Date(iso) : iso, "yyyy-MM-dd'T'HH:mm");
const fromLocalInput = (v: string) => new Date(v).toISOString();

export function KassaHoursCard() {
  const { t, i18n } = useTranslation();
  const locale = useDateFnsLocale();
  const [monday, setMonday] = useState(() => weekStart(new Date()));
  const range = useMemo(() => weekQueryRange(monday), [monday]);
  const { report, correct } = useKassaHours(range.from, range.to);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmVoid, setConfirmVoid] = useState(false);

  const week = useMemo(() => (report.data ? summarizeWeek(report.data, monday) : null), [report.data, monday]);
  const tips = useMemo(() => (report.data && week ? tipPot(report.data, week.days).filter((d) => d.cents > 0) : []), [report.data, week]);
  const staff: HoursStaff[] = report.data?.staff ?? [];
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? '—';
  const euro = (c: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' }).format(c / 100);
  const dt = (iso: string) => format(new Date(iso), 'EEE d/M HH:mm', { locale });
  const hm = (iso: string) => format(new Date(iso), 'HH:mm');
  const dayLabel = (d: string) => format(new Date(`${d}T12:00:00`), 'EEE d/M', { locale });
  const isCurrentWeek = weekStart(new Date()).getTime() === monday.getTime();

  const openAdjust = (s: HoursShift) => setForm({
    mode: 'adjust', shift: s, staffId: s.staff_id, start: toLocalInput(s.clock_in_at),
    // Open shift afsluiten: standaard nu, maar nooit meer dan 8 uur na het begin (vergeten uitklokken).
    end: toLocalInput(s.clock_out_at ?? new Date(Math.min(Date.now(), new Date(s.clock_in_at).getTime() + 8 * 3600_000))), reason: '',
  });
  const openAdd = () => setForm({
    mode: 'add', shift: null, staffId: staff.find((s) => s.is_active)?.id ?? '', start: toLocalInput(new Date(Date.now() - 4 * 3600_000)), end: toLocalInput(new Date()), reason: '',
  });

  const startMs = form?.start ? new Date(form.start).getTime() : NaN;
  const endMs = form?.end ? new Date(form.end).getTime() : NaN;
  const timesOk = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && endMs - startMs <= 24 * 3600_000 && endMs <= Date.now() + 5 * 60_000;
  const reasonOk = (form?.reason.trim().length ?? 0) >= 3;
  const canSave = !!form && timesOk && reasonOk && !!form.staffId && !correct.isPending;

  const submit = async () => {
    if (!form || !canSave) return;
    try {
      if (form.mode === 'adjust' && form.shift) {
        await correct.mutateAsync({ action: 'adjust', shift_id: form.shift.id, clock_in_at: fromLocalInput(form.start), clock_out_at: fromLocalInput(form.end), reason: form.reason.trim() });
      } else {
        await correct.mutateAsync({ action: 'add', staff_id: form.staffId, clock_in_at: fromLocalInput(form.start), clock_out_at: fromLocalInput(form.end), reason: form.reason.trim() });
      }
      toast.success(t('admin.kassaHours.saved'));
      setForm(null);
    } catch (e) {
      toast.error(t('admin.kassaHours.saveError', { detail: e instanceof Error ? e.message : String(e) }));
    }
  };

  const doVoid = async () => {
    if (!form?.shift || !reasonOk) return;
    try {
      await correct.mutateAsync({ action: 'void', shift_id: form.shift.id, reason: form.reason.trim() });
      toast.success(t('admin.kassaHours.voided'));
      setConfirmVoid(false);
      setForm(null);
    } catch (e) {
      toast.error(t('admin.kassaHours.saveError', { detail: e instanceof Error ? e.message : String(e) }));
    }
  };

  const exportCsv = () => {
    if (!week) return;
    const L = {
      headers: [t('admin.kassaHours.csv.staff'), t('admin.kassaHours.csv.number'), t('admin.kassaHours.csv.day'), t('admin.kassaHours.csv.in'),
        t('admin.kassaHours.csv.out'), t('admin.kassaHours.csv.minutes'), t('admin.kassaHours.csv.hours'), t('admin.kassaHours.csv.source'),
        t('admin.kassaHours.csv.corrected'), t('admin.kassaHours.csv.reason')] as [string, string, string, string, string, string, string, string, string, string],
      sourceKassa: t('admin.kassaHours.sourceKassa'), sourceManual: t('admin.kassaHours.sourceManual'),
      yes: t('admin.kassaHours.yes'), no: t('admin.kassaHours.no'), total: t('admin.kassaHours.total'),
    };
    const rows = hoursCsvRows(week, L, (iso) => format(new Date(iso), 'yyyy-MM-dd HH:mm'));
    downloadCsv(`uren-week-${getISOWeek(monday)}-${format(monday, 'yyyy-MM-dd')}.csv`, toCsv(L.headers, rows));
  };

  const shiftsSorted = week ? week.rows.flatMap((r) => r.shifts).sort((a, b) => b.clock_in_at.localeCompare(a.clock_in_at)) : [];

  return (
    <Card className="mt-6">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Clock className="h-5 w-5" />{t('admin.kassaHours.title')}</CardTitle>
            <CardDescription>{t('admin.kassaHours.intro')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openAdd} disabled={!staff.length}><Plus className="mr-1 h-4 w-4" />{t('admin.kassaHours.addShift')}</Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!week || !week.rows.length}><Download className="mr-1 h-4 w-4" />{t('admin.kassaHours.csvButton')}</Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label={t('admin.kassaHours.prevWeek')} onClick={() => setMonday(addDays(monday, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-0 flex-1 text-center text-sm font-medium sm:flex-none">
            {t('admin.kassaHours.weekLabel', { n: getISOWeek(monday), from: format(monday, 'd MMM', { locale }), to: format(addDays(monday, 6), 'd MMM yyyy', { locale }) })}
          </span>
          <Button variant="ghost" size="icon" aria-label={t('admin.kassaHours.nextWeek')} disabled={isCurrentWeek} onClick={() => setMonday(addDays(monday, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {report.isError && <p role="alert" className="text-sm text-destructive">{t('admin.kassaHours.loadError')}</p>}
        {report.isLoading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}

        {week && week.open.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" />{t('admin.kassaHours.openTitle', { count: week.open.length })}</p>
            <ul className="space-y-1">
              {week.open.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{t('admin.kassaHours.openSince', { name: staffName(s.staff_id), at: dt(s.clock_in_at) })}</span>
                  <Button size="sm" variant="outline" onClick={() => openAdjust(s)}>{t('admin.kassaHours.closeShift')}</Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {week && (week.rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('admin.kassaHours.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="sticky left-0 bg-muted px-3 py-2 text-left font-medium">{t('admin.kassaHours.staff')}</th>
                  {week.days.map((d) => <th key={d} className="px-2 py-2 text-right font-medium">{dayLabel(d)}</th>)}
                  <th className="px-3 py-2 text-right font-medium">{t('admin.kassaHours.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {week.rows.map((r) => (
                  <tr key={r.staff.id}>
                    <td className="sticky left-0 bg-card px-3 py-2 font-medium">{r.staff.name}</td>
                    {r.perDay.map((m, i) => <td key={week.days[i]} className="px-2 py-2 text-right tabular-nums text-muted-foreground">{m ? formatMinutes(m) : '–'}</td>)}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMinutes(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted">
                <tr>
                  <td className="sticky left-0 bg-muted px-3 py-2 font-semibold">{t('admin.kassaHours.total')}</td>
                  {week.days.map((d, i) => <td key={d} className="px-2 py-2 text-right tabular-nums">{formatMinutes(week.rows.reduce((n, r) => n + r.perDay[i], 0))}</td>)}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMinutes(week.totalMinutes)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

        {shiftsSorted.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">{t('admin.kassaHours.shiftsTitle')}</h3>
            <ul className="divide-y rounded-lg border">
              {shiftsSorted.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => !s.voided && openAdjust(s)} disabled={s.voided}
                    className="flex w-full flex-col gap-1 px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent sm:flex-row sm:items-center sm:gap-3">
                    <span className="flex items-baseline justify-between gap-3 sm:contents">
                      <span className="font-medium sm:w-48 sm:truncate">{staffName(s.staff_id)}</span>
                      <span className="tabular-nums sm:order-last sm:ml-auto">{formatMinutes(shiftMinutes(s))}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={s.voided ? 'text-muted-foreground line-through' : 'text-muted-foreground sm:text-foreground'}>
                        {dayLabel(s.business_day)} · {hm(s.clock_in_at)}–{s.clock_out_at ? hm(s.clock_out_at) : '…'}
                      </span>
                      {s.source === 'manual' && <Badge variant="outline">{t('admin.kassaHours.sourceManual')}</Badge>}
                      {s.voided && <Badge variant="outline">{t('admin.kassaHours.voidedBadge')}</Badge>}
                      {s.corrected && !s.voided && s.source === 'kassa' && <Badge variant="outline" className="border-blue-300 text-blue-800">{t('admin.kassaHours.correctedBadge')}</Badge>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tips.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold">{t('admin.kassaHours.tipsTitle')}</h3>
            <p className="mb-2 text-xs text-muted-foreground">{t('admin.kassaHours.tipsIntro')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {tips.map((d) => (
                <div key={d.day} className="rounded-lg border p-3 text-sm">
                  <p className="mb-1 flex justify-between font-medium"><span>{dayLabel(d.day)}</span><span className="tabular-nums">{euro(d.cents)}</span></p>
                  {d.shares.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('admin.kassaHours.tipsNoHours')}</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {d.shares.map((s) => (
                        <li key={s.staff.id} className="flex justify-between gap-2 text-muted-foreground">
                          <span>{s.staff.name} · {formatMinutes(s.minutes)}</span><span className="tabular-nums text-foreground">{euro(s.cents)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </CardContent>

      <Dialog open={!!form} onOpenChange={(o) => { if (!o) { setForm(null); setConfirmVoid(false); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.mode === 'add' ? t('admin.kassaHours.addTitle') : t('admin.kassaHours.editTitle')}</DialogTitle>
            <DialogDescription>{t('admin.kassaHours.dialogIntro')}</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              {form.mode === 'add' ? (
                <div className="space-y-1">
                  <Label htmlFor="kh-staff">{t('admin.kassaHours.staff')}</Label>
                  <select id="kh-staff" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              ) : (
                <p className="text-sm">
                  <span className="font-medium">{staffName(form.staffId)}</span>
                  {form.shift?.original_in && <span className="block text-xs text-muted-foreground">{t('admin.kassaHours.clocked', {
                    from: dt(form.shift.original_in),
                    to: form.shift.original_out ? hm(form.shift.original_out) : t('admin.kassaHours.stillOpen'),
                  })}</span>}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="kh-start">{t('admin.kassaHours.start')}</Label>
                  <Input id="kh-start" type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="kh-end">{t('admin.kassaHours.end')}</Label>
                  <Input id="kh-end" type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                </div>
              </div>
              {!timesOk && <p className="text-xs text-destructive">{t('admin.kassaHours.timesInvalid')}</p>}
              <div className="space-y-1">
                <Label htmlFor="kh-reason">{t('admin.kassaHours.reason')}</Label>
                <Textarea id="kh-reason" rows={2} maxLength={200} value={form.reason} placeholder={t('admin.kassaHours.reasonPlaceholder')} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
              {confirmVoid && (
                <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{t('admin.kassaHours.voidConfirm')}</p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {form?.mode === 'adjust' ? (
              <Button variant="ghost" className="text-destructive" disabled={!reasonOk || correct.isPending}
                onClick={() => (confirmVoid ? void doVoid() : setConfirmVoid(true))}>
                {confirmVoid ? t('admin.kassaHours.voidYes') : t('admin.kassaHours.void')}
              </Button>
            ) : <span />}
            <Button onClick={() => void submit()} disabled={!canSave}>{t('admin.kassaHours.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
