// TAFEL-3 — Rapporten: X (tussenstand van vandaag) en Z (dag afsluiten, doorlopend genummerd),
// en de laatste rapporten om opnieuw te bekijken of af te drukken. Een Z mag enkel de eigenaar
// of een verantwoordelijke maken; ontbrekende Z's maakt de kassa zelf (achtergrond).
import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Loader2, Lock, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTenant } from '@/hooks/useTenant';
import { buildReport, renderHtml } from '../../print';
import type { SignedEvent } from '../../print/types';
import type { ActionCtx } from '../horeca/actions';
import { formatEuro } from '../horeca/format';
import { makeReport, recentReports, type ReportKind, type ReportResult } from '../reportActions';
import { reportHtml } from '../reportHtml';

const Z_ROLES = new Set(['owner', 'manager']);

export function ReportsScreen({ ctx, staffRole }: { ctx: ActionCtx; staffRole: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const tenantId = ctx.runtime.device.tenantId;
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ report: ReportResult; signed: SignedEvent[] } | null>(null);
  const [confirmZ, setConfirmZ] = useState(false);
  const { data: list, isLoading } = useQuery({ queryKey: ['kassa-reports', tenantId], queryFn: () => recentReports(tenantId) });
  const canZ = Z_ROLES.has(staffRole);

  const run = async (kind: ReportKind) => {
    setBusy(kind);
    setError(null);
    const o = await makeReport(ctx.runtime, { staffId: ctx.staffId, employeeId: ctx.employeeId }, kind);
    setBusy(null);
    setConfirmZ(false);
    if (!o.ok) { setError(t(`kassa.reports.error.${o.reason}`, { detail: o.detail ?? '' })); return; }
    if (o.pending || !o.data) { setError(t('kassa.reports.pending')); return; }
    void qc.invalidateQueries({ queryKey: ['kassa-reports', tenantId] });
    setShown({ report: o.data, signed: o.signed });
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-3">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void run('X')} disabled={!!busy} className="flex h-16 flex-col items-center justify-center rounded-lg border-2 font-semibold disabled:opacity-40">
          {busy === 'X' ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>{t('kassa.reports.x')}</span>}
          <span className="text-xs font-normal text-muted-foreground">{t('kassa.reports.xHint')}</span>
        </button>
        <button type="button" onClick={() => setConfirmZ(true)} disabled={!!busy || !canZ} className="flex h-16 flex-col items-center justify-center rounded-lg border-2 border-primary font-semibold disabled:opacity-40">
          {busy === 'Z' ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex items-center gap-1">{!canZ && <Lock className="h-4 w-4" />}{t('kassa.reports.z')}</span>}
          <span className="text-xs font-normal text-muted-foreground">{t('kassa.reports.zHint')}</span>
        </button>
      </div>
      {!canZ && <p className="text-sm text-muted-foreground">{t('kassa.reports.zRoleOnly')}</p>}
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('kassa.reports.recent')}</h2>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : !list?.length ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{t('kassa.reports.none')}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {list.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setShown({ report: r, signed: [] })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.kind === 'Z' ? t('kassa.reports.zNo', { n: r.report_no }) : t('kassa.reports.x')}</span>
                    <span className="block text-xs text-muted-foreground">{r.booking_date}</span>
                  </span>
                  <span className="tabular-nums">{formatEuro(r.data.sales.total_cents, i18n.language)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmZ && (
        <Dialog open onOpenChange={(o) => !o && !busy && setConfirmZ(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{t('kassa.reports.zConfirmTitle')}</DialogTitle></DialogHeader>
            <p className="text-sm">{t('kassa.reports.zConfirmText')}</p>
            <DialogFooter className="gap-2">
              <button type="button" onClick={() => setConfirmZ(false)} disabled={!!busy} className="h-12 rounded-md border px-4">{t('kassa.common.cancel')}</button>
              <button type="button" onClick={() => void run('Z')} disabled={!!busy} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground">
                {busy === 'Z' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{t('kassa.reports.zConfirm')}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {shown && <ReportDialog ctx={ctx} report={shown.report} signed={shown.signed} onClose={() => setShown(null)} />}
    </div>
  );
}

function ReportDialog({ ctx, report, signed, onClose }: { ctx: ActionCtx; report: ReportResult; signed: SignedEvent[]; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const frame = useRef<HTMLIFrameElement>(null);
  const euro = (c: number) => formatEuro(c, i18n.language);
  const dt = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });

  const html = useMemo(() => {
    const ours = reportHtml(report, {
      title: report.kind === 'Z' ? t('kassa.reports.zNo', { n: report.report_no }) : t('kassa.reports.x'),
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
    // GKS: het officiële rapport uit de ondertekende events (nooit het INSZ: staffDirectory leeg).
    const fiscal = signed.map((ev) => {
      try {
        return renderHtml(buildReport(ev, {
          business: {
            legalName: currentTenant?.billing_company_name || currentTenant?.name || '',
            tradeName: currentTenant?.name || '',
            address: [currentTenant?.address, [currentTenant?.postal_code, currentTenant?.city].filter(Boolean).join(' ')].filter(Boolean) as string[],
            vatNo: ctx.runtime.fiscal.vatNo ?? '', estNo: ctx.runtime.fiscal.estNo ?? '',
          },
          staff: { name: ctx.staffName },
          staffDirectory: {},
        }));
      } catch (e) {
        return `<p>${t('kassa.pay.ticketError', { detail: e instanceof Error ? e.message : String(e) })}</p>`;
      }
    });
    if (!fiscal.length) return ours;
    return ours.replace('</body>', `${fiscal.map((f) => `<hr style="margin:16px 0">${f.replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/g, '')}`).join('')}</body>`);
  }, [report, signed, currentTenant, ctx, t]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{report.kind === 'Z' ? t('kassa.reports.zNo', { n: report.report_no }) : t('kassa.reports.x')}</DialogTitle></DialogHeader>
        <p className="text-sm">{t('kassa.reports.totalLine', { amount: euro(report.data.sales.total_cents), n: report.data.sales.count })}</p>
        {report.data.open_checks > 0 && report.kind === 'Z' ? <p role="alert" className="rounded-md bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t('kassa.reports.openChecksWarning', { n: report.data.open_checks })}</p> : null}
        <iframe ref={frame} title={t('kassa.reports.preview')} srcDoc={html} className="h-96 w-full rounded-md border bg-white" />
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className="h-12 rounded-md border px-4">{t('kassa.common.close')}</button>
          <button type="button" onClick={() => frame.current?.contentWindow?.print()} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground">
            <Printer className="h-4 w-4" /> {t('kassa.reports.print')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
