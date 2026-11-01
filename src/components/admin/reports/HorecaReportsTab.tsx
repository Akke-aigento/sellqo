// RAPPORT-HORECA-1 — Rapporten › Horeca: Z-archief (openen en afdrukken van hetzelfde rapport als
// in de kassa, via src/kassa/app/reportHtml.ts), CSV voor de boekhouder, en een analyse over de
// gekozen periode (toppers, omzet per uur, per medewerker, gemiddelde per rekening en couvert).
// Periode = bedrijfsdagen van de pagina-periode (afkapuur zoals de Z).
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { BookOpen, ChevronRight, Download, FileText, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTracks } from '@/hooks/useBusinessModules';
import { accountingUrl } from '@/lib/accountingLink';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTenant } from '@/hooks/useTenant';
import { useHorecaAnalysis, useZArchive } from '@/hooks/useHorecaReports';
import { downloadCsv, toCsv } from '@/lib/csvExport';
import { activeHours, avg, csvEuro, zCsv } from '@/lib/horecaReports';
import { formatEuro } from '@/kassa/app/horeca/format';
import { reportHtml } from '@/kassa/app/reportHtml';
import type { ReportResult } from '@/kassa/app/reportActions';

export function HorecaReportsTab({ from, to }: { from: Date; to: Date }) {
  const { t, i18n } = useTranslation();
  const fromDay = format(from, 'yyyy-MM-dd');
  const toDay = format(to, 'yyyy-MM-dd');
  const archive = useZArchive(fromDay, toDay);
  const analysis = useHorecaAnalysis(fromDay, toDay);
  const [shown, setShown] = useState<ReportResult | null>(null);
  const euro = (c: number) => formatEuro(c, i18n.language);
  const dt = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
  const a = analysis.data;
  // HORECA-ZIJBALK-1: van het Z-archief naar de boekhoudkoppeling (Odoo); plan-gating zit op die plek.
  const { hasTrack } = useTracks();
  const hours = useMemo(() => (a ? activeHours(a) : []), [a]);
  const maxHour = Math.max(1, ...hours.map((h) => h.cents));
  const top = a?.products.slice(0, 10) ?? [];
  const maxTop = Math.max(1, ...top.map((p) => p.cents));
  const zTotal = (archive.data ?? []).reduce((n, r) => n + r.data.sales.total_cents, 0);

  const exportZ = () => {
    const list = archive.data ?? [];
    if (!list.length) return;
    const method = (m: string) => t(`kassa.pay.method.${m}`, { defaultValue: m });
    const { headers, rows } = zCsv(list, {
      no: t('admin.horecaReports.csv.no'), day: t('admin.horecaReports.csv.day'), from: t('admin.horecaReports.csv.from'), to: t('admin.horecaReports.csv.to'),
      count: t('kassa.reports.r.count'), total: t('kassa.reports.r.total'), net: t('kassa.reports.r.net'), vat: t('kassa.reports.r.vat'),
      netRate: (r) => t('admin.horecaReports.csv.netRate', { rate: r }), vatRate: (r) => t('admin.horecaReports.csv.vatRate', { rate: r }),
      method, tip: (m) => t('admin.horecaReports.csv.tip', { method: method(m) }),
      rounding: t('kassa.reports.r.rounding'), discounts: t('kassa.reports.r.discounts'), cashIn: t('kassa.reports.r.cashIn'), cashOut: t('kassa.reports.r.cashOut'),
      voided: t('kassa.reports.r.voided'), corrections: t('kassa.reports.r.corrections'),
    }, (iso) => format(new Date(iso), 'yyyy-MM-dd HH:mm'));
    downloadCsv(`z-rapporten-${fromDay}-${toDay}.csv`, toCsv(headers, rows));
  };

  const exportMix = () => {
    if (!a?.products.length) return;
    downloadCsv(`productmix-${fromDay}-${toDay}.csv`, toCsv(
      [t('admin.horecaReports.product'), t('admin.horecaReports.qty'), t('admin.horecaReports.revenue')],
      a.products.map((p) => [p.name, p.qty, csvEuro(p.cents)]),
    ));
  };

  const avgText = (c: number | null) => (c === null ? '–' : euro(c));
  const tiles = a ? [
    { label: t('admin.horecaReports.kpi.revenue'), value: euro(a.totals.revenue_cents), hint: t('admin.horecaReports.kpi.tickets', { n: a.totals.tickets }) },
    { label: t('admin.horecaReports.kpi.perCheck'), value: avgText(avg(a.totals.checks_revenue_cents, a.totals.checks)), hint: t('admin.horecaReports.kpi.checks', { n: a.totals.checks }) },
    { label: t('admin.horecaReports.kpi.perCover'), value: avgText(avg(a.totals.guests_revenue_cents, a.totals.guests)), hint: t('admin.horecaReports.kpi.covers', { n: a.totals.guests }) },
    { label: t('admin.horecaReports.kpi.tips'), value: euro(a.totals.tips_cents), hint: t('admin.horecaReports.kpi.tipsHint') },
  ] : [];

  return (
    <div className="space-y-4">
      <Link to={accountingUrl(hasTrack)} className="flex min-h-12 items-center gap-3 rounded-lg border bg-card px-4 py-2 text-sm hover:bg-muted/50">
        <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{t('admin.horecaReports.accountingLink')}</span>
          <span className="block text-xs text-muted-foreground">{t('admin.horecaReports.accountingHint')}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="text-base">{t('admin.horecaReports.zTitle')}</CardTitle>
            <CardDescription>{t('admin.horecaReports.zIntro')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportZ} disabled={!archive.data?.length}><Download className="mr-1 h-4 w-4" />{t('admin.horecaReports.zCsv')}</Button>
        </CardHeader>
        <CardContent>
          {archive.isError && <p role="alert" className="text-sm text-destructive">{t('admin.horecaReports.loadError')}</p>}
          {archive.isLoading ? <div className="h-20 animate-pulse rounded-lg bg-muted" /> : !archive.data?.length ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('admin.horecaReports.zNone')}</p>
          ) : (
            <>
              <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
                {archive.data.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setShown(r)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{t('kassa.reports.zNo', { n: r.report_no })}</span>
                        <span className="block text-xs text-muted-foreground">{r.booking_date} · {t('admin.horecaReports.salesCount', { n: r.data.sales.count })}</span>
                      </span>
                      <span className="tabular-nums">{euro(r.data.sales.total_cents)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-right text-sm text-muted-foreground">{t('admin.horecaReports.zSum', { n: archive.data.length, amount: euro(zTotal) })}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="text-base">{t('admin.horecaReports.analysisTitle')}</CardTitle>
            <CardDescription>{t('admin.horecaReports.analysisIntro', { from: fromDay, to: toDay })}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportMix} disabled={!a?.products.length}><Download className="mr-1 h-4 w-4" />{t('admin.horecaReports.mixCsv')}</Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {analysis.isError && <p role="alert" className="text-sm text-destructive">{t('admin.horecaReports.analysisError', { detail: analysis.error instanceof Error ? analysis.error.message : '' })}</p>}
          {analysis.isLoading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}
          {a && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {tiles.map((x) => (
                  <div key={x.label} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{x.label}</p>
                    <p className="text-xl font-semibold tabular-nums">{x.value}</p>
                    <p className="text-xs text-muted-foreground">{x.hint}</p>
                  </div>
                ))}
              </div>

              {a.totals.tickets === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('admin.horecaReports.noSales')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <section className="min-w-0">
                    <h3 className="mb-2 text-sm font-semibold">{t('admin.horecaReports.topTitle')}</h3>
                    <ol className="space-y-1.5">
                      {top.map((p, i) => (
                        <li key={p.key} className="text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="min-w-0 truncate">{i + 1}. {p.name}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{t('admin.horecaReports.qtyShort', { n: p.qty })} · <span className="text-foreground">{euro(p.cents)}</span></span>
                          </div>
                          <div className="mt-0.5 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${Math.max(2, (p.cents / maxTop) * 100)}%` }} /></div>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section className="min-w-0">
                    <h3 className="mb-2 text-sm font-semibold">{t('admin.horecaReports.hourTitle')}</h3>
                    <div className="flex h-40 items-end gap-1" role="img" aria-label={t('admin.horecaReports.hourTitle')}>
                      {hours.map((h) => (
                        <div key={h.hour} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${String(h.hour).padStart(2, '0')}:00 · ${euro(h.cents)} · ${h.count}`}>
                          <div className="rounded-t bg-primary/80" style={{ height: `${(h.cents / maxHour) * 100}%`, minHeight: h.cents > 0 ? 2 : 0 }} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 flex gap-1 text-[10px] text-muted-foreground">
                      {hours.map((h) => <span key={h.hour} className="min-w-0 flex-1 text-center">{h.hour % 2 === 0 || hours.length <= 12 ? h.hour : ''}</span>)}
                    </div>
                  </section>
                  <section className="min-w-0 lg:col-span-2">
                    <h3 className="mb-2 text-sm font-semibold">{t('admin.horecaReports.staffTitle')}</h3>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">{t('admin.horecaReports.staff')}</th>
                            <th className="px-3 py-2 text-right font-medium">{t('admin.horecaReports.tickets')}</th>
                            <th className="px-3 py-2 text-right font-medium">{t('admin.horecaReports.revenue')}</th>
                            <th className="px-3 py-2 text-right font-medium">{t('admin.horecaReports.avgTicket')}</th>
                            <th className="px-3 py-2 text-right font-medium">{t('admin.horecaReports.tips')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {a.staff.map((s) => (
                            <tr key={s.staff_id ?? 'none'}>
                              <td className="px-3 py-2">{s.name ?? t('admin.horecaReports.noStaff')}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{euro(s.cents)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{avgText(avg(s.cents, s.count))}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{euro(s.tips_cents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {shown && <ZDialog report={shown} onClose={() => setShown(null)} />}
    </div>
  );
}

function ZDialog({ report, onClose }: { report: ReportResult; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => {
    const euro = (c: number) => formatEuro(c, i18n.language);
    const dt = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
    // Zelfde labels als het rapportscherm van de kassa (src/kassa/app/screens/ReportsScreen.tsx).
    return reportHtml(report, {
      title: t('kassa.reports.zNo', { n: report.report_no }),
      shop: currentTenant?.name ?? '',
      period: t('kassa.reports.periodLine', { day: report.booking_date, from: dt(report.period_start), to: dt(report.period_end) }),
      printedAt: t('kassa.reports.printedAt', { at: dt(new Date().toISOString()) }),
      sections: {
        sales: t('kassa.reports.s.sales'), vats: t('kassa.reports.s.vats'), payments: t('kassa.reports.s.payments'), tips: t('kassa.reports.s.tips'),
        cash: t('kassa.reports.s.cash'), staff: t('kassa.reports.s.staff'), shifts: t('kassa.reports.s.shifts'), other: t('kassa.reports.s.other'),
      },
      row: {
        count: t('kassa.reports.r.count'), total: t('kassa.reports.r.total'), net: t('kassa.reports.r.net'), netShort: t('kassa.reports.r.netShort'),
        vat: t('kassa.reports.r.vat'), discounts: t('kassa.reports.r.discounts'), rounding: t('kassa.reports.r.rounding'),
        cashIn: t('kassa.reports.r.cashIn'), cashOut: t('kassa.reports.r.cashOut'), expected: t('kassa.cash.expected'), counted: t('kassa.cash.counted'),
        difference: t('kassa.cash.difference'), voided: t('kassa.reports.r.voided'), corrections: t('kassa.reports.r.corrections'),
        drawerOpens: t('kassa.reports.r.drawerOpens'), openChecks: t('kassa.reports.r.openChecks'),
      },
      method: (m) => t(`kassa.pay.method.${m}`, { defaultValue: m }),
      euro,
      date: dt,
    });
  }, [report, currentTenant?.name, t, i18n.language]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{t('kassa.reports.zNo', { n: report.report_no })}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{t('admin.horecaReports.zFiscalNote')}</p>
        <iframe ref={frame} title={t('kassa.reports.preview')} srcDoc={html} className="h-96 w-full rounded-md border bg-white" />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t('kassa.common.close')}</Button>
          <Button onClick={() => frame.current?.contentWindow?.print()} className="gap-2"><Printer className="h-4 w-4" />{t('kassa.reports.print')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
