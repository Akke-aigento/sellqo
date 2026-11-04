// HORECA-NU-1 — "Nu" in de kassa (⋯ › Nu): de schakelaars uit het Nu-paneel die op de vloer thuishoren:
// uitverkocht, keuken pauzeren, zone (terras) open/dicht en de dagschotel. Elke handeling vraagt een
// eigenaar/verantwoordelijke: wie dat zelf is (met sessietoken), tikt meteen; anders kiest de medewerker een
// goedkeurder en tikt die zijn PIN één keer in (blijft enkel in dit scherm, tot je het verlaat of op
// "Vergrendelen" tikt, HORECA-NU-1b). De server
// (kassa_now_apply) controleert alles opnieuw. Geen fiscaal bericht, geen prijs.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, ChefHat, Lock, PauseCircle, Search, ShieldCheck, Soup, Sun } from 'lucide-react';
import { toast } from 'sonner';
// KASSA-MOBIEL-1: de kassa-client (eigen sessie van het toestel), niet de beheer-sessie.
import { kassaSupabase as supabase } from '@/kassa/app/kassaSupabase';
import { cn } from '@/lib/utils';
import { useFloorPlan, floorPlanKey } from '@/hooks/useFloorPlan';
import { NowTile } from '@/components/horeca/now/NowTile';
import { activeUntil, pauseTileVisible, zoneTiles } from '@/lib/horeca/nowPanel';
import type { ActionCtx } from '../horeca/actions';
import { useCatalog, type CatalogProduct } from '../horeca/useCatalog';
import { PRODUCT_EDIT_ROLES } from '../horeca/productActions';
import { formatEuro } from '../horeca/format';
import { applyNow, fetchNowState, selfApproves, type NowChange } from '../horeca/nowActions';

interface Approver { id: string; display_name: string; role: string }
const PAUSES = [15, 30, 60] as const;

export function NowScreen({ ctx }: { ctx: ActionCtx }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const tenantId = ctx.runtime.device.tenantId;
  const { data: catalog } = useCatalog(tenantId);
  const { data: plan } = useFloorPlan();
  const self = selfApproves(ctx);
  const { data: state } = useQuery({
    queryKey: ['kassa-now-state', tenantId],
    queryFn: () => fetchNowState(tenantId),
    refetchInterval: 30_000,
  });
  const { data: approvers } = useQuery({
    queryKey: ['kassa-approvers', tenantId],
    enabled: !self,
    queryFn: async () => {
      const { data, error } = await supabase.from('pos_cashiers').select('id, display_name, role')
        .eq('tenant_id', tenantId).eq('is_active', true).in('role', [...PRODUCT_EDIT_ROLES]).order('display_name');
      if (error) throw error;
      return (data ?? []) as Approver[];
    },
  });
  const [approverId, setApproverId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [list, setList] = useState<null | 'soldout' | 'special'>(null);
  const [q, setQ] = useState('');
  const approverPick = approverId || (approvers?.length === 1 ? approvers[0].id : '');
  const approved = self || (!!approverPick && /^\d{4,6}$/.test(pin));
  const now = Date.now();
  const euro = (c: number) => formatEuro(c, i18n.language);

  const run = async (key: string, change: NowChange, okText: string) => {
    if (!approved) { toast.error(t('kassa.now.needApproval')); return false; }
    setBusy(key);
    const o = await applyNow(ctx, change, self ? null : { approverId: approverPick, pin });
    setBusy(null);
    if (o.ok === false) {
      if (o.reason === 'wrong_pin' || o.reason === 'locked') setPin('');
      toast.error(t(`kassa.now.error.${o.reason}`));
      return false;
    }
    toast.success(okText);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['kassa-catalog', tenantId] }),
      qc.invalidateQueries({ queryKey: ['kassa-now-state', tenantId] }),
      qc.invalidateQueries({ queryKey: floorPlanKey(tenantId) }),
    ]);
    return true;
  };

  const paused = activeUntil(state?.pausedUntil, now) ? state!.pausedUntil : null;
  const zones = zoneTiles(plan?.areas);
  const products = catalog?.products ?? [];
  const soldOut = products.filter((p) => p.sold_out);
  const specials = products.filter((p) => p.daily_special);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = list === 'special' ? products.filter((p) => !p.daily_special) : products;
    const sorted = list === 'soldout' ? [...base].sort((a, b) => Number(b.sold_out) - Number(a.sold_out)) : base;
    return sorted.filter((p) => !term || p.name.toLowerCase().includes(term)).slice(0, 80);
  }, [products, q, list]);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  const row = (p: CatalogProduct, action: { label: string; on: boolean; change: NowChange; ok: string }) => (
    <li key={p.id} className="flex min-h-12 items-center gap-3 border-b last:border-0">
      <span className={cn('min-w-0 flex-1 truncate font-semibold', p.sold_out && list === 'soldout' && 'text-muted-foreground line-through')}>{p.name}</span>
      <span className="text-sm tabular-nums text-muted-foreground">{euro(p.price_cents)}</span>
      <button type="button" disabled={!!busy || !approved} onClick={() => void run(p.id, action.change, action.ok)}
        className={cn('h-11 shrink-0 rounded-full border px-4 text-sm font-semibold disabled:opacity-40', action.on && 'border-orange-400 bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-100')}>
        {action.label}
      </button>
    </li>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-3">
      {!self ? (
        <section className="space-y-2 rounded-lg border p-3" aria-label={t('kassa.approval.title')} data-testid="kassa-now-approval">
          <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden />{t('kassa.now.approvalIntro')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={approverPick} onChange={(e) => { setApproverId(e.target.value); setPin(''); }} aria-label={t('kassa.productEdit.approver')}
              className="h-11 w-full rounded-md border bg-background px-2">
              <option value="">{t('kassa.productEdit.pickApprover')}</option>
              {(approvers ?? []).map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
            </select>
            <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder={t('kassa.productEdit.pin')} aria-label={t('kassa.productEdit.pin')} className="h-11 w-full rounded-md border bg-background px-3 text-center text-lg tracking-widest" />
          </div>
          {approvers && !approvers.length ? <p className="text-xs text-destructive">{t('kassa.productEdit.noApprovers')}</p> : null}
          {/* HORECA-NU-1b — één goedkeuring geldt voor meerdere tikken in dit scherm; Vergrendelen wist de PIN meteen. */}
          {pin ? (
            <button type="button" data-testid="kassa-now-lock"
              onClick={() => { setPin(''); setApproverId(''); toast.success(t('kassa.now.lockedToast')); }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold">
              <Lock className="h-4 w-4" aria-hidden />{t('kassa.now.lock')}
            </button>
          ) : null}
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <NowTile testId="kassa-now-soldout" icon={CalendarX} title={t('kassa.now.soldout.title')}
          state={soldOut.length ? t('kassa.now.soldout.count', { count: soldOut.length }) : t('kassa.now.soldout.none')}
          tone={soldOut.length ? 'alert' : 'neutral'} pressed={list === 'soldout'} onClick={() => { setList(list === 'soldout' ? null : 'soldout'); setQ(''); }} />
        <NowTile testId="kassa-now-special" icon={Soup} title={t('kassa.now.special.title')}
          state={specials.length ? specials.map((p) => p.name).join(', ') : t('kassa.now.special.none')}
          tone={specials.length ? 'on' : 'neutral'} pressed={list === 'special'} onClick={() => { setList(list === 'special' ? null : 'special'); setQ(''); }} />
        {/* De pauze geldt voor online bestellen (afhalen/leveren), niet aan tafel: enkel tonen als daar iets te pauzeren valt. */}
        {state && pauseTileVisible({ onlineOrdering: state.online, paused: !!paused }) ? (
          paused ? (
            <NowTile testId="kassa-now-pause" icon={PauseCircle} title={t('kassa.now.pause.title')} state={t('kassa.now.pause.paused')} sub={t('kassa.now.pause.until', { time: time(paused) })}
              tone="alert" pressed busy={busy === 'pause'} disabled={!approved}
              onClick={() => void run('pause', { kind: 'pause', minutes: 0 }, t('kassa.now.pause.resumed'))} />
          ) : (
            <div className="flex flex-col gap-1.5 rounded-2xl border-2 p-3" data-testid="kassa-now-pause">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80"><ChefHat className="h-4 w-4" aria-hidden />{t('kassa.now.pause.title')}</span>
              <span className="text-xl font-extrabold">{t('kassa.now.pause.running')}</span>
              <div className="grid grid-cols-3 gap-1.5">
                {PAUSES.map((m) => (
                  <button key={m} type="button" disabled={!!busy || !approved} onClick={() => void run('pause', { kind: 'pause', minutes: m }, t('kassa.now.pause.pausedToast', { count: m }))}
                    className="h-11 rounded-md border text-sm font-semibold disabled:opacity-40">{t('kassa.now.pause.minutes', { count: m })}</button>
                ))}
              </div>
            </div>
          )
        ) : null}
        {zones.map((a) => {
          const open = a.is_open !== false;
          return (
            <NowTile key={a.id} testId={`kassa-now-zone-${a.id}`} icon={Sun} title={a.name} state={open ? t('kassa.now.zone.open') : t('kassa.now.zone.closed')}
              // Zonder akkoord uitgegrijsd; de reden staat bovenaan in het akkoordblok.
              tone={open ? 'on' : 'alert'} pressed={open} busy={busy === a.id} disabled={!approved}
              onClick={() => void run(a.id, { kind: 'area', area_id: a.id, open: !open }, t(open ? 'kassa.now.zone.closedToast' : 'kassa.now.zone.openToast', { name: a.name }))} />
          );
        })}
      </div>

      {list ? (
        <section className="space-y-2 rounded-lg border p-3" aria-label={list === 'soldout' ? t('kassa.now.soldout.title') : t('kassa.now.special.title')}>
          {list === 'special' && specials.length > 0 ? (
            <div className="space-y-1.5 border-b pb-2" data-testid="kassa-now-special-current">
              <ul>{specials.map((p) => row(p, { label: t('kassa.now.special.remove'), on: true, change: { kind: 'special', product_id: p.id, on: false }, ok: t('kassa.now.special.offToast', { name: p.name }) }))}</ul>
              <button type="button" disabled={!!busy || !approved} onClick={() => void run('clear', { kind: 'special_clear' }, t('kassa.now.special.noneToast'))}
                className="h-11 w-full rounded-md border font-semibold disabled:opacity-40">{t('kassa.now.special.noneToday')}</button>
            </div>
          ) : null}
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('kassa.checks.search')} aria-label={t('kassa.checks.search')} className="h-11 w-full rounded-md border bg-background pl-9 pr-3" />
          </label>
          <ul data-testid={`kassa-now-list-${list}`}>
            {shown.map((p) => list === 'soldout'
              ? row(p, { label: p.sold_out ? t('kassa.productEdit.backIn') : t('kassa.productEdit.soldOut'), on: p.sold_out, change: { kind: 'sold_out', product_id: p.id, sold_out: !p.sold_out },
                  ok: p.sold_out ? t('kassa.productEdit.soldOutOff', { name: p.name }) : t('kassa.productEdit.soldOutOn', { name: p.name }) })
              : row(p, { label: t('kassa.now.special.make'), on: false, change: { kind: 'special', product_id: p.id, on: true }, ok: t('kassa.now.special.onToast', { name: p.name }) }))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
