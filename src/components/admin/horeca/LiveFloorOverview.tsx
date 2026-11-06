// HORECA-ZIJBALK-1 — Zaal › Live: wat er nu open staat in de zaak, alleen-lezen.
// Zaalplan met kleur per tafel (zoals op de kassa) en een lijst van alle open rekeningen
// (tafel, stand, hoe lang open, bedrag). Openen en afrekenen gebeurt op SellQo Kassa.
// TAFEL-SAMEN-1 — per rekening de waarschuwingen "Open sinds gisteren" en "Lijnen van vorige gasten", en
// "Tafel vrijgeven" (beëindigt de tafelgroep van de QR-gasten; de rekening blijft ongemoeid).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, History, Loader2, Pencil, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useReleaseTable, useTableGroups } from '@/hooks/useTableGroups';
import { checkWarnings, needsAttention } from '@/lib/horeca/tableGroups';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FloorPlanView } from '@/components/admin/floorplan/FloorPlanView';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { useLiveChecks } from '@/hooks/useLiveChecks';
import { buildLiveFloor, durationParts, type LiveState } from '@/lib/horeca/liveFloor';
import { formatEuro } from '@/kassa/app/horeca/format';
import { cn } from '@/lib/utils';

const STATE_CLASS: Record<LiveState, string> = {
  open: 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
  bill: 'border-blue-600 bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-50',
  paying: 'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50',
};

export function LiveFloorOverview({ onEditPlan }: { onEditPlan: () => void }) {
  const { t, i18n } = useTranslation();
  const { data: plan, isLoading: planLoading } = useFloorPlan();
  const { checks, isLoading, error, polledAt } = useLiveChecks();
  const groups = useTableGroups();
  const release = useReleaseTable();
  const [releaseFor, setReleaseFor] = useState<{ tableId: string; label: string } | null>(null);
  // "Open sinds" loopt door, ook als er niets verandert.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  useEffect(() => { if (polledAt) setNow(Date.now()); }, [polledAt]);
  const warnings = useMemo(() => checkWarnings(groups.data, now), [groups.data, now]);

  const money = (c: number) => formatEuro(c, i18n.language);
  const labels = useMemo(() => new Map((plan?.tables ?? []).map((tb) => [tb.id, tb.label])), [plan]);
  const floor = useMemo(() => buildLiveFloor(checks, (id) => labels.get(id) ?? null, {
    now, money, counterLabel: t('admin.liveFloor.counter'), unnamedLabel: t('admin.liveFloor.unnamed'),
  }), [checks, labels, now, t, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || planLoading) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label={t('common.loading')} />;

  const hasPlan = (plan?.tables.length ?? 0) > 0;
  const duration = (min: number) => {
    const d = durationParts(min);
    return d.h > 0 ? t('admin.liveFloor.hours', { h: d.h, mm: d.mm }) : t('admin.liveFloor.minutes', { m: d.m });
  };
  const time = polledAt ? new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(polledAt) : null;
  const hhmm = (iso: string) => new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const doRelease = () => {
    if (!releaseFor) return;
    const label = releaseFor.label;
    release.mutate(releaseFor.tableId, {
      onSuccess: (n) => toast.success(n ? t('admin.liveFloor.release_done', { table: label }) : t('admin.liveFloor.release_none')),
      onError: () => toast.error(t('admin.liveFloor.release_failed')),
    });
    setReleaseFor(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: t('admin.liveFloor.stat_tables'), value: String(floor.openTables) },
          { label: t('admin.liveFloor.stat_checks'), value: String(floor.openChecks) },
          { label: t('admin.liveFloor.stat_total'), value: money(floor.totalCents) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-3 sm:p-4">
            <p className="text-xs text-muted-foreground sm:text-sm">{s.label}</p>
            <p className="mt-1 truncate text-lg font-semibold tabular-nums sm:text-2xl">{s.value}</p>
          </div>
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />{t('admin.liveFloor.live')}</span>
        {time ? <span>· {t('admin.liveFloor.updated', { time })}</span> : null}
      </p>

      {error ? (
        <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />{t('admin.liveFloor.error')}
        </p>
      ) : null}

      {hasPlan && plan ? (
        <FloorPlanView areas={plan.areas} tables={plan.tables} markers={plan.markers} status={floor.status} badges={floor.badges} maxHeight={520} />
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm sm:p-6">
          <p className="font-medium">{t('admin.liveFloor.no_plan_title')}</p>
          <p className="mt-1 text-muted-foreground">{t('admin.liveFloor.no_plan_body')}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onEditPlan}><Pencil className="mr-1.5 h-4 w-4" />{t('admin.liveFloor.edit_plan')}</Button>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.liveFloor.list_title')}</h2>
        {floor.rows.length === 0 ? (
          <p className="rounded-md border p-4 text-sm text-muted-foreground">{t('admin.liveFloor.none')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {floor.rows.map((r) => {
              const w = r.part ? undefined : warnings.get(r.checkId);
              return (
              <li key={r.checkId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5" data-testid={`live-row-${r.checkId}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {r.part ? t('admin.liveFloor.part', { title: r.label, n: r.part }) : r.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t('admin.liveFloor.open_for', { duration: duration(r.minutesOpen) })}
                    {r.guests ? ` · ${t('admin.liveFloor.guests', { n: r.guests })}` : ''}
                    {w?.groupStartedAt ? ` · ${t('admin.liveFloor.qr_guests_since', { time: hhmm(w.groupStartedAt) })}` : ''}
                  </span>
                </span>
                <Badge variant="outline" className={cn('shrink-0 font-medium', STATE_CLASS[r.state])}>{t(`admin.liveFloor.state_${r.state}`)}</Badge>
                <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{money(r.totalCents)}</span>
                {w && needsAttention(w) ? (
                  <div role="status" className="flex w-full flex-col gap-2 rounded-md border border-amber-400 bg-amber-50 p-2.5 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50 sm:flex-row sm:items-center sm:justify-between" data-testid="live-prev-guests">
                    <span className="flex min-w-0 gap-2">
                      <History className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {[w.stale ? t('admin.liveFloor.stale') : null, w.prevLines > 0 ? t('admin.liveFloor.prev_lines', { count: w.prevLines }) : null,
                            w.idleMinutes !== null ? t('admin.liveFloor.idle_open', { duration: duration(w.idleMinutes) }) : null].filter(Boolean).join(' · ')}
                        </span>
                        <span className="block text-xs">{w.stale || w.prevLines > 0 ? t('admin.liveFloor.prev_hint') : t('admin.liveFloor.idle_hint')}</span>
                      </span>
                    </span>
                    {w.groupActive && w.tableId ? (
                      <Button size="sm" variant="outline" className="h-9 shrink-0 bg-background" disabled={release.isPending}
                        onClick={() => setReleaseFor({ tableId: w.tableId!, label: r.label })}>
                        <Users className="mr-1.5 h-4 w-4" />{t('admin.liveFloor.release')}
                      </Button>
                    ) : null}
                  </div>
                ) : w?.groupActive && w.tableId ? (
                  <Button size="sm" variant="ghost" className="h-9 w-full justify-start text-muted-foreground sm:w-auto" disabled={release.isPending}
                    onClick={() => setReleaseFor({ tableId: w.tableId!, label: r.label })}>
                    <Users className="mr-1.5 h-4 w-4" />{t('admin.liveFloor.release')}
                  </Button>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t('admin.liveFloor.readonly_hint')}</p>
        <Button asChild size="sm" variant="outline">
          <Link to="/kassa"><ExternalLink className="mr-1.5 h-4 w-4" />{t('admin.liveFloor.open_kassa')}</Link>
        </Button>
      </section>

      <AlertDialog open={!!releaseFor} onOpenChange={(o) => { if (!o) setReleaseFor(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.liveFloor.release_title', { table: releaseFor?.label ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.liveFloor.release_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={doRelease}>{t('admin.liveFloor.release')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
