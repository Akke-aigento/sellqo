// EVENT-SCAN-1 — publieke scanpagina voor de deurploeg: /scan/:token, zonder account.
// De QR van een scantoegang (EventDetail → Toegangen) wijst hiernaartoe. Het token blijft
// in het pad en wordt op dit toestel bewaard, zodat het beginscherm-icoon (start_url /scan)
// meteen de juiste scanner opent. Zonder bewaard token stuurt /scan een ingelogde
// gebruiker door naar de admin-scanner.
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, TriangleAlert } from 'lucide-react';
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
}

function invokeWithToken<T>(fn: string, token: string, body: Record<string, unknown>): Promise<T> {
  return supabase.functions.invoke(fn, { body, headers: { 'x-scanner-token': token } })
    .then(({ data, error }) => {
      // Een 401 komt hier als error terug; de scanner toont dan "mislukt".
      if (error) throw error;
      return data as T;
    });
}

export function DoorScanHome() {
  useDoorAppShell();
  const { t } = useTranslation();
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(DOOR_TOKEN_KEY); } catch { /* geen opslag */ }
    if (stored && TOKEN_RE.test(stored)) { setTarget(`/scan/${stored}`); return; }
    void supabase.auth.getSession().then(({ data }) => setTarget(data.session ? '/admin/checkin' : 'none'));
  }, []);
  if (target && target !== 'none') return <Navigate to={target} replace />;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b1220] p-8 text-center text-white">
      {target === 'none' ? (
        <>
          <TriangleAlert className="h-10 w-10 text-amber-400" />
          <p className="text-lg font-semibold">{t('door.no_link_title')}</p>
          <p className="max-w-xs text-sm text-white/60">{t('door.no_link_text')}</p>
        </>
      ) : <Loader2 className="h-8 w-8 animate-spin text-white/60" />}
    </div>
  );
}

export default function DoorScan() {
  useDoorAppShell();
  const { token = '' } = useParams();
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
    scan: (qr) => invokeWithToken<DoorScanResult>('ticket-checkin', token, { qr_token: qr, action: 'checkin' }),
    stats: () => invokeWithToken<{ success: boolean; sold: number; inside: number }>('scanner-door', token, { action: 'stats' })
      .then((r) => ({ sold: r.sold, inside: r.inside })),
    search: (q) => invokeWithToken<{ success: boolean; results: DoorSearchHit[] }>('scanner-door', token, { action: 'search', q })
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
  return (
    <DoorScanner
      title={ctx.tenant_branding?.name ?? 'SellQo'}
      subtitle={[when, ctx.zone?.name, ctx.scanner?.name].filter(Boolean).join(' · ')}
      logoUrl={ctx.tenant_branding?.logo_url ?? null}
      adapter={adapter}
    />
  );
}
