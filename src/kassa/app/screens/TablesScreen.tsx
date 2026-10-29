// TAFEL-1 — startscherm van de bediening: het live zaalplan (vrij / bezet / rekening gevraagd),
// rekeningen op naam als chips, en "+ Op naam". Op een gsm kan je naar een lijst wisselen.
// KASSA-UX-1: de toog is een vaste tegel bovenaan (geen tabblad meer), het plan past altijd
// op het scherm, en plan en lijst gebruiken dezelfde kleuren.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, List, Plus, ShoppingBag, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLongPress } from '../useLongPress';
import { FloorPlanView } from '@/components/admin/floorplan/FloorPlanView';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { quarterTurn, quarterTurnHelps, type FloorTable, type TableStatus } from '@/lib/floorplan';
import { cn } from '@/lib/utils';
import { checkTotalCents, type Check } from '../horeca/types';
import type { HorecaStore } from '../horeca/store';
import { formatEuro, minutesSince } from '../horeca/format';

interface Props {
  store: HorecaStore; staffId: string; tableLabel: (id: string | null) => string | null; onOpen: (checkId: string) => void; onCounter: () => void;
  /** KASSA-UX-3: lang drukken op een tafel → menu met acties (tafel-id, rekening of null). */
  onTableAction?: (tableId: string, checkId: string | null) => void;
}

const VIEW_KEY = 'sq_kassa_tables_view';

/** Afmetingen van een element volgen, zodat het zaalplan in de beschikbare ruimte past. */
function useSize(): [(el: HTMLElement | null) => void, { w: number; h: number }] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((e) => { const r = e[0]?.contentRect; if (r) setSize({ w: Math.floor(r.width), h: Math.floor(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [useCallback((x: HTMLElement | null) => setEl(x), []), size];
}

function lastActivity(c: Check): string {
  return c.lines.reduce((m, l) => (l.created_at > m ? l.created_at : m), c.opened_at);
}

export function TablesScreen({ store, staffId, tableLabel, onOpen, onCounter, onTableAction }: Props) {
  const { t, i18n } = useTranslation();
  const { data: plan, isLoading } = useFloorPlan();
  // KASSA-UX-2: standaard het zaalplan (past nu ook op een gsm); de keuze plan/lijst onthoudt dit toestel.
  const [mode, setModeState] = useState<'plan' | 'list'>(() => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'plan'; } catch { return 'plan'; } });
  const setMode = (m: 'plan' | 'list') => { setModeState(m); try { localStorage.setItem(VIEW_KEY, m); } catch { /* privémodus */ } };
  const [naming, setNaming] = useState(false);
  const [allTabs, setAllTabs] = useState(false);
  const [tabQuery, setTabQuery] = useState('');
  const [planBox, box] = useSize();
  const [name, setName] = useState('');
  const checks = store.checks;
  // Hoofdrekening per tafel; deelrekeningen (apart afrekenen) staan als chip bovenaan. Is de
  // hoofdrekening al betaald maar een deel nog niet, dan blijft de tafel bezet via dat deel.
  const byTable = useMemo(() => {
    const m = new Map<string, Check>();
    for (const c of checks) if (c.table_id && !c.split_of) m.set(c.table_id, c);
    for (const c of checks) if (c.table_id && c.split_of && !m.has(c.table_id)) m.set(c.table_id, c);
    return m;
  }, [checks]);
  const named = checks.filter((c) => !c.table_id || (c.split_of && byTable.get(c.table_id)?.id !== c.id));
  const chipLabel = (c: Check) => (c.split_no
    ? t('kassa.pay.partTitle', { title: c.table_id ? tableLabel(c.table_id) ?? '?' : c.name, n: c.split_no })
    : c.name);

  const status: Record<string, TableStatus> = {};
  const badges: Record<string, string> = {};
  const now = Date.now();
  for (const [tableId, c] of byTable) {
    status[tableId] = c.bill_requested_at ? 'bill' : 'occupied';
    badges[tableId] = `${formatEuro(checkTotalCents(c), i18n.language)} · ${minutesSince(lastActivity(c), now)}′`;
  }
  // QR-REKENING-1: een tafel met een openstaande QR-bestelling springt eruit.
  const qrPending = new Map<string, number>();
  for (const r of store.requests) if (r.dining_table_id) qrPending.set(r.dining_table_id, (qrPending.get(r.dining_table_id) ?? 0) + 1);
  for (const [tableId, n] of qrPending) {
    status[tableId] = 'attention';
    badges[tableId] = [t('kassa.requests.badge', { count: n }), badges[tableId]].filter(Boolean).join(' · ');
  }

  // KASSA-UX-2: op een gsm in staande stand een kwartslag draaien als de tafels daar groter van worden.
  const multiArea = (plan?.areas.filter((a) => a.is_active).length ?? 0) > 1;
  const planH = box.h ? Math.max(200, box.h - (multiArea ? 48 : 0)) : 0;
  const shown = useMemo(() => {
    if (!plan) return null;
    const active = plan.areas.filter((a) => a.is_active);
    const biggest = active.reduce<typeof active[number] | null>((m, a) => (!m || a.grid_w * a.grid_h > m.grid_w * m.grid_h ? a : m), null);
    if (!biggest || !quarterTurnHelps(biggest, box.w, planH)) return plan;
    const tables = quarterTurn(plan.areas, plan.tables);
    return { areas: tables.areas, tables: tables.items, markers: quarterTurn(plan.areas, plan.markers).items };
  }, [plan, box.w, planH]);

  const openTable = (tb: Pick<FloorTable, 'id'>) => {
    const existing = byTable.get(tb.id);
    if (existing) return onOpen(existing.id);
    const id = crypto.randomUUID();
    store.enqueue({ id: crypto.randomUUID(), kind: 'open_check', check_id: id, table_id: tb.id, staff_id: staffId });
    onOpen(id);
  };

  const longPress = (tableId: string) => {
    if (!onTableAction) return;
    try { navigator.vibrate?.(20); } catch { /* geen trilfunctie */ }
    onTableAction(tableId, byTable.get(tableId)?.id ?? null);
  };

  const openNamed = () => {
    const n = name.trim();
    if (!n) return;
    const id = crypto.randomUUID();
    store.enqueue({ id: crypto.randomUUID(), kind: 'open_check', check_id: id, name: n, staff_id: staffId });
    setName('');
    setNaming(false);
    onOpen(id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      {/* KASSA-UX-3: vaste kopregels — tabs op naam verschuiven het zaalplan nooit meer. */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCounter}
          className="flex h-12 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground active:scale-[0.98]">
          <ShoppingBag className="h-5 w-5" aria-hidden /><span className="sm:hidden">{t('kassa.counter.name')}</span><span className="hidden sm:inline">{t('kassa.tables.counter')}</span>
        </button>
        <button type="button" onClick={() => setNaming(true)} className="flex h-12 shrink-0 items-center gap-1 rounded-lg border border-dashed px-3 text-sm font-semibold">
          <Plus className="h-4 w-4" /> {t('kassa.tables.onName')}
        </button>
        {plan && plan.tables.length > 0 && (
          <div className="ml-auto flex shrink-0 rounded-md border">
            <button type="button" aria-pressed={mode === 'plan'} aria-label={t('kassa.tables.viewPlan')} onClick={() => setMode('plan')} className={cn('flex h-11 w-11 items-center justify-center', mode === 'plan' && 'bg-muted')}><LayoutGrid className="h-4 w-4" /></button>
            <button type="button" aria-pressed={mode === 'list'} aria-label={t('kassa.tables.viewList')} onClick={() => setMode('list')} className={cn('flex h-11 w-11 items-center justify-center', mode === 'list' && 'bg-muted')}><List className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <div className="flex h-11 shrink-0 items-center gap-2">
        {naming ? (
          <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); openNamed(); }}>
            <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t('kassa.tables.namePlaceholder')}
              className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-base" aria-label={t('kassa.tables.namePlaceholder')} />
            <button type="submit" disabled={!name.trim()} className="h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t('kassa.tables.open')}</button>
            <button type="button" onClick={() => { setNaming(false); setName(''); }} className="h-11 shrink-0 px-2 text-sm text-muted-foreground">{t('kassa.common.cancel')}</button>
          </form>
        ) : named.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('kassa.tables.noTabs')}</p>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]">
              {named.map((c) => (
                <button key={c.id} type="button" onClick={() => onOpen(c.id)}
                  className={cn('flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold', c.bill_requested_at ? 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100' : 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100')}>
                  {chipLabel(c)}
                  <span className="font-normal">{formatEuro(checkTotalCents(c), i18n.language)}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setAllTabs(true)} className="flex h-11 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-semibold">
              <Users className="h-4 w-4" aria-hidden /> {t('kassa.tables.allTabs', { count: named.length })}
            </button>
          </>
        )}
      </div>

      {allTabs && (
        <Dialog open onOpenChange={(o) => { if (!o) { setAllTabs(false); setTabQuery(''); } }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>{t('kassa.tables.allTabsTitle', { count: named.length })}</DialogTitle></DialogHeader>
            <input value={tabQuery} onChange={(e) => setTabQuery(e.target.value)} placeholder={t('kassa.checks.search')} aria-label={t('kassa.checks.search')}
              className="h-11 w-full rounded-md border bg-background px-3 text-base" />
            <ul className="space-y-1.5">
              {named.filter((c) => chipLabel(c)?.toLowerCase().includes(tabQuery.trim().toLowerCase())).sort((a, b) => (chipLabel(a) ?? '').localeCompare(chipLabel(b) ?? '')).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => { setAllTabs(false); setTabQuery(''); onOpen(c.id); }}
                    className="flex h-12 w-full items-center justify-between rounded-md border px-3 text-left font-semibold hover:bg-muted">
                    <span className="truncate">{chipLabel(c)}</span>
                    <span className={cn('tabular-nums', c.bill_requested_at && 'text-blue-700 dark:text-blue-300')}>{formatEuro(checkTotalCents(c), i18n.language)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-muted" /> : !plan || plan.tables.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('kassa.tables.noPlan')}</p>
      ) : mode === 'plan' ? (
        // Het plan past in de ruimte die overblijft (min. de rij met ruimtes erboven).
        <div ref={planBox} className="min-h-[16rem] flex-1">
          <FloorPlanView areas={(shown ?? plan).areas} tables={(shown ?? plan).tables} markers={(shown ?? plan).markers} status={status} badges={badges} onTableClick={openTable} onTableLongPress={(tb) => longPress(tb.id)}
            maxHeight={planH || undefined} />
        </div>
      ) : (
        <div className="space-y-4">
          {plan.areas.map((a) => {
            const tables = plan.tables.filter((x) => x.area_id === a.id).sort((x, y) => x.label.localeCompare(y.label, undefined, { numeric: true }));
            if (!tables.length) return null;
            return (
              <section key={a.id}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{a.name}</h2>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {tables.map((tb) => {
                    const c = byTable.get(tb.id);
                    const qr = qrPending.get(tb.id) ?? 0;
                    return (
                      <TableTile key={tb.id} onTap={() => openTable(tb)} onLong={() => longPress(tb.id)}
                        className={cn('flex min-h-16 w-full select-none flex-col items-center justify-center rounded-lg border-2 p-2 text-center [-webkit-touch-callout:none]',
                          qr ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : !c ? 'border-slate-300 bg-background' : c.bill_requested_at ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950')}>
                        <span className="font-bold">{tb.label}</span>
                        {c || qr ? <span className="text-xs">{badges[tb.id]}</span> : <span className="text-xs text-muted-foreground">{t('kassa.tables.free')}</span>}
                      </TableTile>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** KASSA-UX-3 — tafel in de lijstweergave: tikken = openen, lang drukken = acties. */
function TableTile({ onTap, onLong, className, children }: { onTap: () => void; onLong: () => void; className: string; children: React.ReactNode }) {
  const lp = useLongPress(onLong, true);
  return (
    <button type="button" onClick={() => { if (lp.consumeClick()) return; onTap(); }} {...lp.handlers} className={className}>
      {children}
    </button>
  );
}
