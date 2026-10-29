// QR-REKENING-1 — inbox met wat gasten via de QR aan tafel bestelden.
// KASSA-UX-2: geen apart venster meer maar een lijst die in de kolom "Binnenkomend" van het
// barscherm staat (tablet: naast het zaalplan; gsm: onder Bar).
//
// Gemaakt voor drukte: per tafel gegroepeerd (oudste eerst), "Alles van tafel X" in één tik, en
// elke aanvraag apart met haar eigen status. Een fout bij één aanvraag blijft bij die aanvraag
// staan; ze laat nooit het venster of de kassa vallen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Check as CheckIcon, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ActionCtx } from '../horeca/actions';
import { groupByTable, rejectRequest, type TableRequest } from '../horeca/requests';
import { runAccept } from '../horeca/autoAccept';
import { formatEuro, minutesSince } from '../horeca/format';

const REASONS = ['soldOut', 'kitchenClosed', 'askStaff'] as const;

type ItemState = { busy?: boolean; error?: string };

/** Knop in de kopbalk: aantal openstaande aanvragen; opent het barscherm. */
export function RequestInboxButton({ count, onClick }: { count: number; onClick: () => void }) {
  const { t } = useTranslation();
  if (!count) return null;
  return (
    <button type="button" onClick={onClick} className="flex h-11 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-sm font-bold text-white motion-safe:animate-pulse">
      <BellRing className="h-4 w-4" aria-hidden /> <span>{t('kassa.requests.button', { count })}</span>
    </button>
  );
}

export function RequestList({ ctx, requests, beforeAction }: { ctx: ActionCtx; requests: TableRequest[]; /** KASSA-UX-3: PIN-bewaking op een scherm dat niet vergrendelt (Bar). */ beforeAction?: () => boolean }) {
  const { t, i18n } = useTranslation();
  const euro = (c: number) => formatEuro(c, i18n.language);
  const groups = useMemo(() => groupByTable(requests), [requests]);
  const [state, setState] = useState<Record<string, ItemState>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  // Wat niet meer openstaat (door ons of een collega verwerkt), verdwijnt ook uit de lokale stand.
  useEffect(() => {
    const ids = new Set(requests.map((r) => r.id));
    setState((s) => (Object.keys(s).every((k) => ids.has(k)) ? s : Object.fromEntries(Object.entries(s).filter(([k]) => ids.has(k)))));
  }, [requests]);

  const patch = (id: string, v: ItemState) => { if (alive.current) setState((s) => ({ ...s, [id]: v })); };

  const accept = async (r: TableRequest) => {
    if (state[r.id]?.busy) return;
    if (beforeAction && !beforeAction()) return;
    patch(r.id, { busy: true });
    const o = await runAccept(ctx, r, t);
    patch(r.id, 'error' in o ? { error: o.error } : {});
  };
  const acceptAll = async (rs: TableRequest[]) => {
    // Na elkaar (zelfde tafel = zelfde rekening): zo komt alles in de volgorde waarin het besteld werd.
    for (const r of rs) await accept(r);
  };
  const reject = async (r: TableRequest, reason: string) => {
    if (beforeAction && !beforeAction()) return;
    patch(r.id, { busy: true });
    setRejecting(null);
    setCustom('');
    const o = await rejectRequest(ctx, r, reason).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    patch(r.id, 'error' in o ? { error: o.error } : {});
  };

  return (
        <div className="space-y-3">
          {groups.map((g) => {
            const busyAll = g.requests.some((r) => state[r.id]?.busy);
            return (
              <section key={g.key} className="rounded-lg border">
                <header className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-3 py-2">
                  <span className="text-lg font-bold">{t('kassa.requests.table', { label: g.label })}</span>
                  <span className="text-sm text-muted-foreground">{t('kassa.requests.waiting', { min: minutesSince(g.requests[0].created_at, now) })}</span>
                  {g.requests.length > 1 ? (
                    <button type="button" disabled={busyAll} onClick={() => void acceptAll(g.requests)}
                      className="ml-auto flex h-11 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                      <CheckIcon className="h-4 w-4" /> {t('kassa.requests.acceptAll', { count: g.requests.length })}
                    </button>
                  ) : null}
                </header>
                <ul className="divide-y">
                  {g.requests.map((r) => {
                    const st = state[r.id] ?? {};
                    return (
                      <li key={r.id} className="space-y-2 p-3">
                        <div className="flex items-start gap-3">
                          <ul className="min-w-0 flex-1 space-y-0.5 text-sm">
                            {r.items.map((it, i) => (
                              <li key={i}><span className="font-semibold">{it.qty}× {it.name}</span>
                                {it.addons?.length ? <span className="text-muted-foreground"> · {it.addons.map((a) => a.name).join(', ')}</span> : null}</li>
                            ))}
                          </ul>
                          <div className="shrink-0 text-right text-sm">
                            <p className="font-bold tabular-nums">{euro(r.total_cents)}</p>
                            <p className="text-xs text-muted-foreground">{t('kassa.requests.ago', { min: minutesSince(r.created_at, now) })}</p>
                          </div>
                        </div>
                        {r.guest_name || r.note ? (
                          <p className="rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                            {[r.guest_name, r.note].filter(Boolean).join(' · ')}
                          </p>
                        ) : null}
                        {st.error ? <p role="alert" className="text-sm text-destructive">{t('kassa.requests.error', { error: st.error })}</p> : null}
                        {rejecting === r.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {REASONS.map((k) => (
                              <button key={k} type="button" onClick={() => void reject(r, k)} className="h-11 rounded-md border px-3 text-sm">{t(`kassa.requests.reason.${k}`)}</button>
                            ))}
                            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) void reject(r, custom.trim()); }}>
                              <input value={custom} maxLength={160} onChange={(e) => setCustom(e.target.value)} placeholder={t('kassa.requests.reason.other')}
                                aria-label={t('kassa.requests.reason.other')} className="h-11 w-48 rounded-md border bg-background px-3 text-sm" />
                              <button type="submit" disabled={!custom.trim()} className="h-11 rounded-md bg-destructive px-3 text-sm font-semibold text-destructive-foreground disabled:opacity-40">{t('kassa.requests.reject')}</button>
                            </form>
                            <button type="button" onClick={() => setRejecting(null)} className="h-11 px-2 text-sm text-muted-foreground">{t('kassa.common.cancel')}</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button type="button" disabled={st.busy} onClick={() => void accept(r)}
                              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary font-semibold text-primary-foreground disabled:opacity-50">
                              {st.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckIcon className="h-5 w-5" />} {t('kassa.requests.accept')}
                            </button>
                            <button type="button" disabled={st.busy} onClick={() => setRejecting(r.id)}
                              className={cn('flex h-12 items-center gap-1 rounded-md border px-4 font-semibold disabled:opacity-50')}>
                              <X className="h-4 w-4" /> {t('kassa.requests.reject')}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
  );
}
