// FEST-2 — "SellQo Bar": munten afschrijven aan de bar of de foodstand, zonder account.
// De barlink (/bar/:token) maak je in Events → Munten. Het token blijft op dit toestel
// bewaard, zodat het beginscherm-icoon (start_url /bar) meteen de juiste bar opent.
//
// Werkwijze aan de toog: kies hoeveel munten (1 is standaard), scan de QR van de klant,
// tik op "Afschrijven". Met "Snel" staat de keuze vast en schrijft elke scan meteen af.
// Een vergissing draai je binnen 10 minuten terug met "Terugdraaien".
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Check, Coins, Loader2, Minus, Plus, TriangleAlert, Undo2, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { doorFeedback, keepScreenOn, unlockDoorAudio } from '@/lib/doorFeedback';

const TOKEN_RE = /^[a-f0-9]{64}$/;
const BAR_TOKEN_KEY = 'sellqo.bar.token';
const SOUND_KEY = 'sellqo.bar.sound';
const VIDEO_ID = 'bar-scanner-video';
const FILE_ID = 'bar-scanner-file';
const COOLDOWN_MS = 3500;
/** In snelle modus schrijft dezelfde kaart binnen dit venster niet automatisch opnieuw af:
 *  een QR die nog voor de camera hangt, mag geen tweede drankje kosten. */
const QUICK_REPEAT_MS = 20000;

interface BarInfo { success: boolean; bar: { name: string }; shop: { name: string | null; logo_url: string | null }; token_name: string; token_name_plural: string }
interface Lookup { success: boolean; found: boolean; balance?: number; purchased?: number; status?: string; name?: string | null; reason?: string | null }
interface SpendRes { success: boolean; found: boolean; ok?: boolean; reason?: string | null; balance?: number | null; transaction_id?: string | null }
interface Recent { tx: string; amount: number; balance: number; name: string | null; at: number; undone?: boolean }

function call<T>(token: string, body: Record<string, unknown>): Promise<T> {
  return supabase.functions.invoke('token-bar', { body, headers: { 'x-bar-token': token } })
    .then(({ data, error }) => { if (error) throw error; return data as T; });
}

/** Eigen beginscherm-app ("SellQo Bar"), los van de admin en van de deurscanner. */
function useBarAppShell() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prev = link?.getAttribute('href') ?? null;
    link?.setAttribute('href', '/bar.webmanifest');
    const metas: [string, string][] = [
      ['apple-mobile-web-app-capable', 'yes'], ['mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-title', 'Bar'], ['apple-mobile-web-app-status-bar-style', 'black-translucent'], ['theme-color', '#1a1206'],
    ];
    const restores = metas.map(([name, content]) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const created = !el;
      const before = el?.getAttribute('content') ?? null;
      if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
      el.setAttribute('content', content);
      return () => { if (created) el?.remove(); else if (before !== null) el?.setAttribute('content', before); };
    });
    return () => { if (link && prev) link.setAttribute('href', prev); restores.forEach((r) => r()); };
  }, []);
}

export function BarScanHome() {
  useBarAppShell();
  const { t } = useTranslation();
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(BAR_TOKEN_KEY); } catch { /* geen opslag */ }
    setTarget(stored && TOKEN_RE.test(stored) ? `/bar/${stored}` : 'none');
  }, []);
  if (target && target !== 'none') return <Navigate to={target} replace />;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#1a1206] p-8 text-center text-white">
      {target === 'none' ? (
        <>
          <TriangleAlert className="h-10 w-10 text-amber-400" />
          <p className="text-lg font-semibold">{t('bar.no_link_title')}</p>
          <p className="max-w-xs text-sm text-white/60">{t('bar.no_link_text')}</p>
        </>
      ) : <Loader2 className="h-8 w-8 animate-spin text-white/60" />}
    </div>
  );
}

export default function BarScan() {
  useBarAppShell();
  const { token = '' } = useParams();
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`bar.${x}`, o);
  const valid = TOKEN_RE.test(token);
  const [info, setInfo] = useState<BarInfo | null>(null);
  const [failed, setFailed] = useState(false);

  const [amount, setAmount] = useState(1);
  const [quick, setQuick] = useState(false);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } });
  const [started, setStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ code: string; lookup: Lookup } | null>(null);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'error' | 'warn'; title: string; sub?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const lastSpendRef = useRef<{ code: string; at: number } | null>(null);
  const busyRef = useRef(false);
  const stateRef = useRef({ amount, quick, sound, current });
  stateRef.current = { amount, quick, sound, current };
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!valid) { setFailed(true); return; }
    call<BarInfo>(token, { action: 'info' })
      .then((r) => {
        if (!r?.success) throw new Error('invalid');
        setInfo(r);
        try { localStorage.setItem(BAR_TOKEN_KEY, token); } catch { /* geen opslag */ }
      })
      .catch(() => {
        setFailed(true);
        try { if (localStorage.getItem(BAR_TOKEN_KEY) === token) localStorage.removeItem(BAR_TOKEN_KEY); } catch { /* noop */ }
      });
  }, [token, valid]);

  const plural = info?.token_name_plural ?? 'munten';
  const singular = info?.token_name ?? 'munt';
  const unit = (n: number) => (n === 1 ? singular : plural);

  const showFlash = useCallback((f: { tone: 'ok' | 'error' | 'warn'; title: string; sub?: string }, ms = 1800) => {
    setFlash(f);
    doorFeedback(f.tone, stateRef.current.sound);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), ms);
  }, []);

  const reasonText = useCallback((r?: string | null, balance?: number | null) => {
    switch (r) {
      case 'insufficient': return k('insufficient', { balance: balance ?? 0, unit: unit(balance ?? 0) });
      case 'unknown_wallet': return k('unknown');
      case 'wallet_blocked': return k('blocked');
      case 'wallet_refund_requested': case 'wallet_refunded': return k('refunded');
      default: return k('failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plural, singular]);

  const spend = useCallback(async (code: string, n: number) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    const key = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
    try {
      const r = await call<SpendRes>(token, { action: 'spend', code, amount: n, idempotency_key: key });
      if (r.ok && r.transaction_id) {
        lastSpendRef.current = { code, at: Date.now() };
        const name = stateRef.current.current?.lookup.name ?? null;
        setRecent((prev) => [{ tx: r.transaction_id!, amount: n, balance: r.balance ?? 0, name, at: Date.now() }, ...prev].slice(0, 6));
        setCurrent(null);
        showFlash({ tone: 'ok', title: `−${n} ${unit(n)}`, sub: k('balance_left', { balance: r.balance ?? 0, unit: unit(r.balance ?? 0) }) }, 2200);
      } else {
        showFlash({ tone: r.reason === 'insufficient' ? 'warn' : 'error', title: reasonText(r.reason, r.balance) }, 2600);
        if (r.reason === 'insufficient' && stateRef.current.current) {
          setCurrent((c) => (c ? { ...c, lookup: { ...c.lookup, balance: r.balance ?? 0 } } : c));
        }
      }
    } catch {
      showFlash({ tone: 'error', title: k('failed') }, 2600);
    } finally {
      busyRef.current = false; setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, showFlash, reasonText]);

  const handleScan = useCallback(async (raw: string) => {
    const m = raw.trim().toLowerCase().match(/([a-f0-9]{40})(?:[/?#].*)?$/);
    const code = m ? m[1] : '';
    if (!code) { showFlash({ tone: 'error', title: k('not_a_token_qr') }); return; }
    const last = lastRef.current;
    if (last && last.code === code && Date.now() - last.at < COOLDOWN_MS) return;
    lastRef.current = { code, at: Date.now() };
    if (busyRef.current || stateRef.current.current) return;
    const ls = lastSpendRef.current;
    const repeat = !!ls && ls.code === code && Date.now() - ls.at < QUICK_REPEAT_MS;
    if (stateRef.current.quick && !repeat) { await spend(code, stateRef.current.amount); return; }
    busyRef.current = true; setBusy(true);
    try {
      const l = await call<Lookup>(token, { action: 'lookup', code });
      if (!l.found) showFlash({ tone: 'error', title: k('unknown') });
      else { setCurrent({ code, lookup: l }); doorFeedback('ok', stateRef.current.sound); }
    } catch {
      showFlash({ tone: 'error', title: k('failed') });
    } finally {
      busyRef.current = false; setBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, spend, showFlash]);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) { try { await s.stop(); } catch { /* al gestopt */ } try { s.clear(); } catch { /* noop */ } }
  }, []);

  const start = useCallback(async () => {
    unlockDoorAudio();
    setCameraError(null);
    setStarted(true);
    if (scannerRef.current) return;
    try {
      const s = new Html5Qrcode(VIDEO_ID, { verbose: false });
      scannerRef.current = s;
      await s.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: (w, h) => { const size = Math.floor(Math.min(w, h) * 0.7); return { width: size, height: size }; } },
        (decoded) => { void handleScan(decoded); },
        () => { /* frames zonder QR */ },
      );
    } catch (e) {
      scannerRef.current = null;
      setCameraError(e instanceof Error ? e.message : String(e));
    }
  }, [handleScan]);

  useEffect(() => { if (started) return keepScreenOn(); }, [started]);
  useEffect(() => () => { void stop(); if (flashTimer.current) window.clearTimeout(flashTimer.current); }, [stop]);

  const scanPhoto = async (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    unlockDoorAudio();
    try {
      const reader = new Html5Qrcode(FILE_ID, { verbose: false });
      const decoded = await reader.scanFile(file, false);
      try { reader.clear(); } catch { /* noop */ }
      lastRef.current = null;
      await handleScan(decoded);
    } catch {
      showFlash({ tone: 'error', title: k('photo_no_qr') });
    } finally { input.value = ''; }
  };

  const undo = async (r: Recent) => {
    try {
      const res = await call<{ success: boolean; reason?: string | null; balance?: number | null }>(token, { action: 'undo', transaction_id: r.tx });
      if (res.success) {
        setRecent((prev) => prev.map((x) => (x.tx === r.tx ? { ...x, undone: true } : x)));
        showFlash({ tone: 'ok', title: k('undone'), sub: k('balance_left', { balance: res.balance ?? 0, unit: unit(res.balance ?? 0) }) });
      } else {
        showFlash({ tone: 'warn', title: res.reason === 'too_late' ? k('undo_too_late') : res.reason === 'already_undone' ? k('undo_already') : k('failed') });
      }
    } catch { showFlash({ tone: 'error', title: k('failed') }); }
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* noop */ }
    if (next) unlockDoorAudio();
  };

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#1a1206] p-8 text-center text-white">
        <TriangleAlert className="h-10 w-10 text-amber-400" />
        <p className="text-lg font-semibold">{k('invalid_link_title')}</p>
        <p className="max-w-xs text-sm text-white/60">{k('invalid_link_text')}</p>
      </div>
    );
  }
  if (!info) return <div className="flex min-h-screen items-center justify-center bg-[#1a1206]"><Loader2 className="h-8 w-8 animate-spin text-white/60" /></div>;

  const bal = current?.lookup.balance ?? 0;
  const canSpend = !!current && current.lookup.status === 'active' && bal >= amount;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#1a1206] text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="flex items-center gap-3 px-4 py-3">
        {info.shop.logo_url ? <img src={info.shop.logo_url} alt="" className="h-9 w-9 rounded-md bg-white object-contain p-0.5" /> : <Coins className="h-8 w-8 text-amber-400" />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{info.shop.name ?? 'SellQo'}</p>
          <p className="truncate text-xs text-white/60">{info.bar.name}</p>
        </div>
        <button type="button" onClick={toggleSound} className="rounded-full p-2 text-white/70 hover:bg-white/10" aria-label={k('sound')}>
          {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </header>

      {/* Hoeveel munten */}
      <div className="px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-white/50">{k('amount')}</p>
          <button
            type="button" onClick={() => setQuick((q) => !q)}
            className={cn('flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold', quick ? 'bg-amber-400 text-black' : 'bg-white/10 text-white/80')}
          >
            <Zap className="h-3.5 w-3.5" /> {k('quick')}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n} type="button" onClick={() => setAmount(n)}
              className={cn('h-12 flex-1 rounded-xl text-lg font-bold tabular-nums', amount === n ? 'bg-amber-400 text-black' : 'bg-white/10')}
            >{n}</button>
          ))}
          <div className="flex h-12 items-center rounded-xl bg-white/10">
            <button type="button" className="px-2" onClick={() => setAmount((a) => Math.max(1, a - 1))} aria-label="-"><Minus className="h-4 w-4" /></button>
            <span className={cn('w-8 text-center font-bold tabular-nums', amount > 5 && 'text-amber-400')}>{amount > 5 ? amount : '…'}</span>
            <button type="button" className="px-2" onClick={() => setAmount((a) => Math.min(100, a + 1))} aria-label="+"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
        {quick && <p className="mt-2 text-xs text-amber-300">{k('quick_hint', { amount, unit: unit(amount) })}</p>}
      </div>

      {/* Camera */}
      <div className="relative mx-4 mt-4 aspect-square overflow-hidden rounded-2xl bg-black">
        <div id={VIDEO_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
        {!started && (
          <button type="button" onClick={() => void start()} className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Camera className="h-12 w-12 text-amber-400" />
            <span className="text-lg font-semibold">{k('start')}</span>
          </button>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center text-sm">
            <TriangleAlert className="h-8 w-8 text-amber-400" />
            <p>{k('camera_error')}</p>
          </div>
        )}

        {current && !flash && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1206]/95 p-6 text-center">
            <button type="button" className="absolute right-3 top-3 rounded-full p-2 text-white/60 hover:bg-white/10" onClick={() => { setCurrent(null); lastRef.current = null; }} aria-label={k('cancel')}><X className="h-5 w-5" /></button>
            {current.lookup.name && <p className="text-lg text-white/80">{current.lookup.name}</p>}
            <p className="text-6xl font-black tabular-nums">{bal}</p>
            <p className="text-sm text-white/60">{k('balance_label', { unit: unit(bal) })}</p>
            {current.lookup.status !== 'active' ? (
              <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{reasonText(`wallet_${current.lookup.status}`)}</p>
            ) : (
              <button
                type="button" disabled={!canSpend || busy} onClick={() => void spend(current.code, amount)}
                className="mt-2 w-full rounded-2xl bg-amber-400 py-4 text-xl font-black text-black disabled:opacity-40"
              >
                {busy ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : bal < amount ? k('insufficient', { balance: bal, unit: unit(bal) }) : k('spend', { amount, unit: unit(amount) })}
              </button>
            )}
          </div>
        )}

        {flash && (
          <div className={cn('absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center',
            flash.tone === 'ok' ? 'bg-emerald-600' : flash.tone === 'warn' ? 'bg-amber-500 text-black' : 'bg-red-600')}
          >
            {flash.tone === 'ok' ? <Check className="h-14 w-14" /> : <TriangleAlert className="h-14 w-14" />}
            <p className="text-3xl font-black">{flash.title}</p>
            {flash.sub && <p className="text-lg opacity-90">{flash.sub}</p>}
          </div>
        )}
      </div>
      <div id={FILE_ID} className="hidden" />

      <label className="mx-4 mt-3 block cursor-pointer text-center text-sm text-white/60 underline">
        {k('photo')}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void scanPhoto(e.target.files?.[0], e.target)} />
      </label>

      {/* Laatste afschrijvingen */}
      {recent.length > 0 && (
        <div className="mx-4 mt-4 space-y-2 pb-6">
          <p className="text-xs uppercase tracking-wide text-white/50">{k('recent')}</p>
          {recent.map((r) => (
            <div key={r.tx} className={cn('flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm', r.undone && 'opacity-50')}>
              <span className="min-w-0 truncate">
                <span className="font-bold">−{r.amount}</span> {r.name ? `· ${r.name}` : ''} <span className="text-white/50">· {new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
              {r.undone ? <span className="text-xs text-white/60">{k('undone')}</span> : Date.now() - r.at < 10 * 60 * 1000 && (
                <button type="button" onClick={() => void undo(r)} className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />{k('undo')}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
