// TAFEL-1 — startscherm van de bediening: het live zaalplan (vrij / bezet / rekening gevraagd),
// rekeningen op naam als chips, en "+ Op naam". Op een gsm kan je naar een lijst wisselen.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { FloorPlanView } from '@/components/admin/floorplan/FloorPlanView';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import type { FloorTable, TableStatus } from '@/lib/floorplan';
import { cn } from '@/lib/utils';
import { checkTotalCents, type Check } from '../horeca/types';
import type { HorecaStore } from '../horeca/store';
import { formatEuro, minutesSince } from '../horeca/format';

interface Props { store: HorecaStore; staffId: string; tableLabel: (id: string | null) => string | null; onOpen: (checkId: string) => void }

function lastActivity(c: Check): string {
  return c.lines.reduce((m, l) => (l.created_at > m ? l.created_at : m), c.opened_at);
}

export function TablesScreen({ store, staffId, tableLabel, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const { data: plan, isLoading } = useFloorPlan();
  const [mode, setMode] = useState<'plan' | 'list'>(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'list' : 'plan'));
  const [naming, setNaming] = useState(false);
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
    status[tableId] = c.bill_requested_at ? 'attention' : 'occupied';
    badges[tableId] = `${formatEuro(checkTotalCents(c), i18n.language)} · ${minutesSince(lastActivity(c), now)}′`;
  }
  // QR-REKENING-1: een tafel met een openstaande QR-bestelling springt eruit.
  const qrPending = new Map<string, number>();
  for (const r of store.requests) if (r.dining_table_id) qrPending.set(r.dining_table_id, (qrPending.get(r.dining_table_id) ?? 0) + 1);
  for (const [tableId, n] of qrPending) {
    status[tableId] = 'attention';
    badges[tableId] = [t('kassa.requests.badge', { count: n }), badges[tableId]].filter(Boolean).join(' · ');
  }

  const openTable = (tb: Pick<FloorTable, 'id'>) => {
    const existing = byTable.get(tb.id);
    if (existing) return onOpen(existing.id);
    const id = crypto.randomUUID();
    store.enqueue({ id: crypto.randomUUID(), kind: 'open_check', check_id: id, table_id: tb.id, staff_id: staffId });
    onOpen(id);
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
      <div className="flex flex-wrap items-center gap-2">
        {named.map((c) => (
          <button key={c.id} type="button" onClick={() => onOpen(c.id)}
            className={cn('flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold', c.bill_requested_at ? 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100' : 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100')}>
            {chipLabel(c)}
            <span className="font-normal">{formatEuro(checkTotalCents(c), i18n.language)}</span>
          </button>
        ))}
        {naming ? (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); openNamed(); }}>
            <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t('kassa.tables.namePlaceholder')}
              className="h-11 w-44 rounded-full border bg-background px-4 text-sm" aria-label={t('kassa.tables.namePlaceholder')} />
            <button type="submit" disabled={!name.trim()} className="h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t('kassa.tables.open')}</button>
            <button type="button" onClick={() => { setNaming(false); setName(''); }} className="h-11 px-2 text-sm text-muted-foreground">{t('kassa.common.cancel')}</button>
          </form>
        ) : (
          <button type="button" onClick={() => setNaming(true)} className="flex h-11 items-center gap-1 rounded-full border border-dashed px-4 text-sm font-semibold">
            <Plus className="h-4 w-4" /> {t('kassa.tables.onName')}
          </button>
        )}
        {plan && plan.tables.length > 0 && (
          <div className="ml-auto flex rounded-md border">
            <button type="button" aria-pressed={mode === 'plan'} aria-label={t('kassa.tables.viewPlan')} onClick={() => setMode('plan')} className={cn('flex h-10 w-11 items-center justify-center', mode === 'plan' && 'bg-muted')}><LayoutGrid className="h-4 w-4" /></button>
            <button type="button" aria-pressed={mode === 'list'} aria-label={t('kassa.tables.viewList')} onClick={() => setMode('list')} className={cn('flex h-10 w-11 items-center justify-center', mode === 'list' && 'bg-muted')}><List className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {isLoading ? <div className="h-64 animate-pulse rounded-lg bg-muted" /> : !plan || plan.tables.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('kassa.tables.noPlan')}</p>
      ) : mode === 'plan' ? (
        <FloorPlanView areas={plan.areas} tables={plan.tables} markers={plan.markers} status={status} badges={badges} onTableClick={openTable} />
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
                      <button key={tb.id} type="button" onClick={() => openTable(tb)}
                        className={cn('flex min-h-16 flex-col items-center justify-center rounded-lg border-2 p-2 text-center',
                          qr ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : !c ? 'border-slate-300 bg-background' : c.bill_requested_at ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950')}>
                        <span className="font-bold">{tb.label}</span>
                        {c || qr ? <span className="text-xs">{badges[tb.id]}</span> : <span className="text-xs text-muted-foreground">{t('kassa.tables.free')}</span>}
                      </button>
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
