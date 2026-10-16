// EVENT-SCAN-1 — publieke scanpagina voor de deurploeg: /scan/:token, zonder account.
// De QR van een scantoegang (EventDetail → Toegangen) wijst hiernaartoe. Het token blijft
// in het pad en wordt op dit toestel bewaard, zodat het beginscherm-icoon (start_url /scan)
// meteen de juiste scanner opent. Zonder bewaard token stuurt /scan een ingelogde
// gebruiker door naar de admin-scanner.
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, TriangleAlert } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { DoorScanner, type DoorAdapter, type DoorScanResult, type DoorSearchHit } from '@/components/door/DoorScanner';
import { DOOR_TOKEN_KEY, useDoorAppShell } from '@/hooks/useDoorAppShell';

const TOKEN_RE = /^[a-f0-9]{64}$/;

interface ScannerContext {
  success: boolean;
  scanner?: { id: string; name: string };
  event?: { id: string; date: string; start_time: string; end_time: string | null; location_name: string | null; status: string } | null;
  zone?: { id: string; name: string } | null;
  tenant_branding?: { name: string; logo_url: string | null } | null;
  /** EVENT-SCAN-2 — vaste deurlink: het event is zelf opgelost (lopend of eerstvolgend). */
  auto?: boolean;
  auto_live?: boolean;
}

// EVENT-DOOR-2 — optioneel AbortSignal: de scanner breekt een hangende oproep af na 8 s.
function invokeWithToken<T>(fn: string, token: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  return supabase.functions.invoke(fn, { body, headers: { 'x-scanner-token': token }, signal })
    .then(({ data, error }) => {
      // Een 401 komt hier als error terug; de scanner toont dan "mislukt".
      if (error) throw error;
      return data as T;
    });
}

interface HomeLink { token: string; fixed: boolean; name: string; event_name: string; event_date: string; start_time: string | null }

/** SCAN-APP-1 — /scan vlucht niet meer naar de admin. Zonder bewaard token en mét login
 *  tonen we de actieve deurlinks van je winkel: precies één → meteen door; meerdere →
 *  kiezen (één tik). Zo opent een ouder beginscherm-icoon met start_url /scan voortaan
 *  ook gewoon de scanner in plaats van de volledige admin. */
export function DoorScanHome() {
  useDoorAppShell();
  const { t } = useTranslation();
  const [target, setTarget] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'anon' | 'empty' | 'list'>('loading');
  const [links, setLinks] = useState<HomeLink[]>([]);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(DOOR_TOKEN_KEY); } catch { /* geen opslag */ }
    if (stored && TOKEN_RE.test(stored)) { setTarget(`/scan/${stored}`); return; }
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setState('anon'); return; }
      try {
        const { data: rows } = await (supabase as unknown as SupabaseClient)
          .from('event_scanner_access')
          .select('access_token, name, expires_at, event_detail_id, event_details(event_date, start_time, status, products(name))')
          .eq('is_active', true)
          .limit(50);
        const now = Date.now();
        const since = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const found: HomeLink[] = ((rows ?? []) as DoorAccessRow[])
          .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
          // EVENT-SCAN-2 — vaste deurlinks (geen event) doen altijd mee; eventlinks
          // alleen als hun event nog komt en gepland/bevestigd is.
          .filter((r) => !r.event_detail_id
            || (!!r.event_details && ['scheduled', 'confirmed'].includes(r.event_details.status ?? '') && (r.event_details.event_date ?? '') >= since))
          .map((r) => ({
            token: r.access_token,
            fixed: !r.event_detail_id,
            name: r.name,
            event_name: r.event_details?.products?.name ?? '',
            event_date: r.event_details?.event_date ?? '',
            start_time: r.event_details?.start_time ?? null,
          }))
          .sort((a, b) => (Number(b.fixed) - Number(a.fixed)) || `${a.event_date}${a.start_time ?? ''}`.localeCompare(`${b.event_date}${b.start_time ?? ''}`));
        if (found.length === 1) { enter(found[0].token, setTarget); return; }
        setLinks(found);
        setState(found.length ? 'list' : 'empty');
      } catch {
        setState('empty');
      }
    })();
  }, []);

  if (target) return <Navigate to={target} replace />;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b1220] p-8 text-center text-white">
      {state === 'loading' && <Loader2 className="h-8 w-8 animate-spin text-white/60" />}
      {state === 'anon' && (
        <>
          <TriangleAlert className="h-10 w-10 text-amber-400" />
          <p className="text-lg font-semibold">{t('door.no_link_title')}</p>
          <p className="max-w-xs text-sm text-white/60">{t('door.no_link_text')}</p>
        </>
      )}
      {state === 'empty' && (
        <>
          <TriangleAlert className="h-10 w-10 text-amber-400" />
          <p className="text-lg font-semibold">{t('door.no_links_title')}</p>
          <p className="max-w-xs text-sm text-white/60">{t('door.no_links_text')}</p>
          <a href="/admin/checkin" className="mt-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold">{t('door.open_admin')}</a>
        </>
      )}
      {state === 'list' && (
        <div className="w-full max-w-sm space-y-3 text-left">
          <p className="text-center text-lg font-semibold">{t('door.choose_title')}</p>
          <p className="text-center text-sm text-white/60">{t('door.choose_text')}</p>
          {links.map((l) => (
            <button
              key={l.token} type="button" onClick={() => enter(l.token, setTarget)}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-left active:scale-[0.99]"
            >
              <span className="block font-semibold">{l.name}</span>
              <span className="block text-sm text-white/60 first-letter:uppercase">{l.fixed ? t('door.fixed_link') : `${l.event_name} · ${eventWhenShort(l.event_date, l.start_time)}`}</span>
            </button>
          ))}
          <a href="/admin/checkin" className="block text-center text-sm text-white/50 underline">{t('door.open_admin')}</a>
        </div>
      )}
    </div>
  );
}

interface DoorAccessRow {
  access_token: string;
  name: string;
  expires_at: string | null;
  event_detail_id?: string | null;
  event_details?: { event_date?: string; start_time?: string | null; status?: string; products?: { name?: string } } | null;
}

function enter(token: string, setTarget: (t: string) => void) {
  try { localStorage.setItem(DOOR_TOKEN_KEY, token); } catch { /* geen opslag */ }
  setTarget(`/scan/${token}`);
}

const eventWhenShort = (d: string, t: string | null) =>
  `${d ? new Date(`${d}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : ''}${t ? ` · ${String(t).slice(0, 5)}` : ''}`;

export default function DoorScan() {
  const { token = '' } = useParams();
  // SCAN-APP-1 — token in de start_url van het manifest: dit icoon opent altijd deze deur.
  useDoorAppShell(TOKEN_RE.test(token) ? token : undefined);
  const { t } = useTranslation();
  const valid = TOKEN_RE.test(token);
  const [ctx, setCtx] = useState<ScannerContext | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!valid) { setFailed(true); return; }
    invokeWithToken<ScannerContext>('scanner-context', token, {})
      .then((c) => {
        if (!c?.success) throw new Error('invalid');
        setCtx(c);
        try { localStorage.setItem(DOOR_TOKEN_KEY, token); } catch { /* geen opslag */ }
      })
      .catch(() => {
        setFailed(true);
        // Een ingetrokken of verlopen link mag het beginscherm-icoon niet blijven openen.
        try { if (localStorage.getItem(DOOR_TOKEN_KEY) === token) localStorage.removeItem(DOOR_TOKEN_KEY); } catch { /* noop */ }
      });
  }, [token, valid]);

  const adapter = useMemo<DoorAdapter>(() => ({
    scan: (qr, signal) => invokeWithToken<DoorScanResult>('ticket-checkin', token, { qr_token: qr, action: 'checkin' }, signal),
    forceScan: (qr, signal) => invokeWithToken<DoorScanResult>('ticket-checkin', token, { qr_token: qr, action: 'checkin', force_window: true }, signal),
    stats: (signal) => invokeWithToken<{ success: boolean; sold: number; inside: number }>('scanner-door', token, { action: 'stats' }, signal)
      .then((r) => ({ sold: r.sold, inside: r.inside })),
    search: (q, signal) => invokeWithToken<{ success: boolean; results: DoorSearchHit[] }>('scanner-door', token, { action: 'search', q }, signal)
      .then((r) => r.results ?? []),
  }), [token]);

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b1220] p-8 text-center text-white">
        <TriangleAlert className="h-10 w-10 text-amber-400" />
        <p className="text-lg font-semibold">{t('door.invalid_link_title')}</p>
        <p className="max-w-xs text-sm text-white/60">{t('door.invalid_link_text')}</p>
      </div>
    );
  }
  if (!ctx) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0b1220]"><Loader2 className="h-8 w-8 animate-spin text-white/60" /></div>;
  }

  const ev = ctx.event;
  const when = ev ? `${new Date(`${ev.date}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${String(ev.start_time).slice(0, 5)}` : '';
  // EVENT-SCAN-2 — vaste deurlink: toon het zelf opgeloste event, of dat er niks aankomt.
  const autoLabel = ctx.auto ? (ev ? (ctx.auto_live ? t('door.auto_live') : t('door.auto_next')) : t('door.auto_none')) : null;
  return (
    <DoorScanner
      title={ctx.tenant_branding?.name ?? 'SellQo'}
      subtitle={[when, autoLabel, ctx.zone?.name, ctx.scanner?.name].filter(Boolean).join(' · ')}
      logoUrl={ctx.tenant_branding?.logo_url ?? null}
      adapter={adapter}
    />
  );
}
