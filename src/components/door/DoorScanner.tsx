// EVENT-SCAN-1 — "SellQo Deur": de scanner aan de deur, schermvullend en gemaakt voor
// een donkere ingang, een gsm in één hand en een rij mensen. Gedeeld door de crew-scanlink
// (/scan/:token, geen account) en de admin-scanner (/admin/checkin). Het verschil zit in
// de adapter: die zegt hoe er gescand, geteld en gezocht wordt.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ArrowLeft, Camera, Check, Flashlight, FlashlightOff, Loader2, RotateCcw, Search, Smartphone,
  TriangleAlert, Users, Volume2, VolumeX, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { doorFeedback, keepScreenOn, unlockDoorAudio, type DoorTone } from '@/lib/doorFeedback';
import { useHideAdminBottomNav } from '@/hooks/useAdminBottomNav';

export interface DoorScanResult {
  success: boolean;
  error?: string;
  result?: string;
  reason?: string;
  attendee?: string | null;
  seq?: number | null;
  checked_in_at?: string | null;
  /** ZAAL-3: stoel, alleen bij een datum met zaalplan. */
  seat?: string | null;
  expected_event?: { date: string | null; start_time: string | null; name: string | null };
}

export interface DoorSearchHit {
  qr_token: string;
  attendee: string | null;
  seq: number | null;
  status: string;
  checked_in_at: string | null;
  order_number: string | null;
  ticket_type: string | null;
}

export interface DoorAdapter {
  scan: (qrToken: string) => Promise<DoorScanResult>;
  stats: () => Promise<{ sold: number; inside: number }>;
  search: (q: string) => Promise<DoorSearchHit[]>;
  /** Alleen voor de host (admin): een check-in terugdraaien. */
  undo?: (qrToken: string) => Promise<DoorScanResult>;
}

interface Recent { id: string; token: string; result: string; attendee: string | null; seq: number | null; at: number; undone?: boolean }

const SCANNER_ID = 'door-scanner-video';
const FILE_SCAN_ID = 'door-scanner-file';
const SAME_TOKEN_COOLDOWN_MS = 4000;
const RESULT_MS = 1700;
const SOUND_KEY = 'sellqo.door.sound';

const toneOf = (r?: string): DoorTone =>
  r === 'ok' || r === 'undone' ? 'ok' : r === 'already' || r === 'reentry_blocked' || r === 'wrong_event' ? 'warn' : 'error';

const hhmm = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export function DoorScanner({ title, subtitle, logoUrl, adapter, onBack, backLabel, installHint = true, appUrl }: {
  title: string;
  subtitle?: string;
  logoUrl?: string | null;
  adapter: DoorAdapter;
  onBack?: () => void;
  backLabel?: string;
  installHint?: boolean;
  /** SCAN-APP-1 — admin-scanner: stuur de beginscherm-tip naar de scanlinkpagina van deze
   *  deur, want alleen dáár krijgt het icoon het token in de start_url mee. */
  appUrl?: string;
}) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`door.${x}`, o);
  // Schermvullende scanner: de navigatiepil van de admin hoort hier niet.
  useHideAdminBottomNav(true);
  const photoRef = useRef<HTMLInputElement>(null);

  const [started, setStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({ available: false, on: false });
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } });
  const [result, setResult] = useState<DoorScanResult | null>(null);
  const [stats, setStats] = useState<{ sold: number; inside: number } | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<DoorSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const pausedRef = useRef(false);
  const lastRef = useRef<{ token: string; at: number } | null>(null);
  const resultTimer = useRef<number | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  pausedRef.current = searchOpen;

  const refreshStats = useCallback(async () => {
    try { setStats(await adapter.stats()); } catch { /* teller is bijzaak */ }
  }, [adapter]);

  useEffect(() => {
    void refreshStats();
    const id = window.setInterval(() => void refreshStats(), 15000);
    return () => window.clearInterval(id);
  }, [refreshStats]);

  const showResult = useCallback((res: DoorScanResult, token: string) => {
    setResult(res);
    doorFeedback(res.success ? toneOf(res.result) : 'error', soundRef.current);
    if (resultTimer.current) window.clearTimeout(resultTimer.current);
    resultTimer.current = window.setTimeout(() => setResult(null), RESULT_MS);
    if (res.result) {
      setRecent((prev) => [{ id: `${token}-${Date.now()}`, token, result: res.result!, attendee: res.attendee ?? null, seq: res.seq ?? null, at: Date.now() }, ...prev].slice(0, 6));
    }
    if (res.result === 'ok') void refreshStats();
  }, [refreshStats]);

  const handle = useCallback(async (raw: string) => {
    const token = raw.trim();
    if (!token || busyRef.current || pausedRef.current) return;
    const last = lastRef.current;
    if (last && last.token === token && Date.now() - last.at < SAME_TOKEN_COOLDOWN_MS) return;
    lastRef.current = { token, at: Date.now() };
    busyRef.current = true;
    try {
      showResult(await adapter.scan(token), token);
    } catch (e) {
      showResult({ success: false, error: e instanceof Error ? e.message : String(e) }, token);
    } finally {
      if (lastRef.current?.token === token) lastRef.current = { token, at: Date.now() };
      window.setTimeout(() => { busyRef.current = false; }, 700);
    }
  }, [adapter, showResult]);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try { await s.stop(); } catch { /* al gestopt */ }
      try { s.clear(); } catch { /* noop */ }
    }
  }, []);

  const start = useCallback(async () => {
    unlockDoorAudio();
    setCameraError(null);
    setStarted(true);
    if (scannerRef.current) return;
    try {
      const s = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = s;
      await s.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: (w, h) => { const size = Math.floor(Math.min(w, h) * 0.7); return { width: size, height: size }; } },
        (decoded) => { void handle(decoded); },
        () => { /* frames zonder QR negeren */ },
      );
      try {
        const caps = s.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        setTorch({ available: !!caps?.torch, on: false });
      } catch { /* geen zaklamp-info */ }
    } catch (e) {
      scannerRef.current = null;
      setCameraError(e instanceof Error ? e.message : String(e));
    }
  }, [handle]);

  // Scherm aan zolang de scanner loopt; camera netjes stoppen bij verlaten.
  useEffect(() => {
    if (!started) return;
    return keepScreenOn();
  }, [started]);
  useEffect(() => () => { void stop(); if (resultTimer.current) window.clearTimeout(resultTimer.current); }, [stop]);

  // Terugval als de live camera niet wil (bv. sommige beginscherm-apps op iPhone):
  // een foto van de QR met de gewone camera-app, en die foto lezen we uit.
  const scanPhoto = async (file: File | undefined) => {
    if (!file) return;
    unlockDoorAudio();
    try {
      const reader = new Html5Qrcode(FILE_SCAN_ID, { verbose: false });
      const decoded = await reader.scanFile(file, false);
      try { reader.clear(); } catch { /* noop */ }
      lastRef.current = null;
      await handle(decoded);
    } catch {
      showResult({ success: false, error: k('photo_no_qr') }, 'photo');
    } finally {
      if (photoRef.current) photoRef.current.value = '';
    }
  };

  const toggleTorch = async () => {
    const s = scannerRef.current;
    if (!s) return;
    const on = !torch.on;
    try {
      await s.applyVideoConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ available: true, on });
    } catch { setTorch({ available: false, on: false }); }
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* noop */ }
    if (next) unlockDoorAudio();
  };

  // Zoeken met een kleine vertraging, zodat elke toetsaanslag geen request is.
  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    if (q.length < 2) { setHits(null); return; }
    setSearching(true);
    const id = window.setTimeout(async () => {
      try { setHits(await adapter.search(q)); } catch { setHits([]); } finally { setSearching(false); }
    }, 300);
    return () => window.clearTimeout(id);
  }, [query, searchOpen, adapter]);

  const checkInHit = async (hit: DoorSearchHit) => {
    unlockDoorAudio();
    setSearchOpen(false);
    setQuery('');
    setHits(null);
    lastRef.current = null;
    busyRef.current = true;
    try { showResult(await adapter.scan(hit.qr_token), hit.qr_token); }
    catch (e) { showResult({ success: false, error: e instanceof Error ? e.message : String(e) }, hit.qr_token); }
    finally { window.setTimeout(() => { busyRef.current = false; }, 700); }
  };

  const undo = async (r: Recent) => {
    if (!adapter.undo) return;
    try {
      const res = await adapter.undo(r.token);
      if (res.result === 'undone') {
        setRecent((prev) => prev.map((x) => (x.id === r.id ? { ...x, undone: true } : x)));
        void refreshStats();
      }
      doorFeedback(res.result === 'undone' ? 'ok' : 'warn', soundRef.current);
    } catch { doorFeedback('error', soundRef.current); }
  };

  const tone = result ? (result.success ? toneOf(result.result) : 'error') : null;
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

  const resultTitle = (r: DoorScanResult) => {
    if (!r.success) return k('result.failed');
    switch (r.result) {
      case 'ok': return r.attendee ? k('result.welcome_name', { name: r.attendee }) : k('result.welcome');
      case 'already': return k('result.already');
      case 'reentry_blocked': return k('result.reentry_blocked');
      case 'wrong_event': return k('result.wrong_event');
      case 'not_allowed_zone': return k('result.not_allowed');
      case 'zone_full': return k('result.full');
      case 'cancelled': case 'refunded': return k('result.cancelled');
      default: return k('result.invalid');
    }
  };
  const resultDetail = (r: DoorScanResult) => {
    if (!r.success) return r.error ?? '';
    if (r.result === 'already') return [r.checked_in_at ? k('result.at', { time: hhmm(r.checked_in_at) }) : '', r.attendee ?? ''].filter(Boolean).join(' · ');
    if (r.result === 'wrong_event' && r.expected_event?.date) {
      return k('result.for_date', { date: new Date(`${r.expected_event.date}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) });
    }
    if (r.result === 'ok' && r.seat) return r.seat;
    if (r.result === 'ok' && r.seq) return k('result.ticket_no', { n: r.seq });
    return r.attendee ?? '';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b1220] text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Kop */}
      <header className="flex items-center gap-3 px-4 py-3">
        {onBack ? (
          <button type="button" onClick={() => { void stop(); onBack(); }} aria-label={backLabel ?? k('back')}
            className="-ml-2 rounded-full p-2 text-white/80 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button>
        ) : logoUrl ? (
          <img src={logoUrl} alt="" className="h-8 w-8 rounded-md bg-white object-contain p-0.5" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs text-white/60">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm tabular-nums" aria-label={k('counter_label')}>
          <Users className="h-4 w-4 text-emerald-400" />
          <span className="font-semibold">{stats?.inside ?? '–'}</span>
          <span className="text-white/50">/ {stats?.sold ?? '–'}</span>
        </div>
      </header>

      {/* Camera */}
      <div className="relative mx-4 flex-1 overflow-hidden rounded-2xl bg-black">
        {/* html5-qrcode zet zelf de maten van video en kader; we centreren alleen, zodat het kader klopt met wat er gescand wordt. */}
        <div className="absolute inset-0 flex items-center"><div id={SCANNER_ID} className="w-full" /></div>
        <div id={FILE_SCAN_ID} className="hidden" />
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void scanPhoto(e.target.files?.[0])} />
        {!started && (
          <button type="button" onClick={() => void start()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0b1220] text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.45)]">
              <Camera className="h-10 w-10" />
            </span>
            <span className="text-xl font-bold">{k('start')}</span>
            <span className="max-w-[16rem] text-sm text-white/60">{k('start_hint')}</span>
          </button>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b1220] p-6 text-center">
            <TriangleAlert className="h-10 w-10 text-amber-400" />
            <p className="font-semibold">{k('camera_error')}</p>
            <p className="text-sm text-white/60">{k('camera_error_hint')}</p>
            <p className="max-w-xs break-words font-mono text-[11px] text-white/40">{cameraError}</p>
            <button type="button" onClick={() => photoRef.current?.click()} className="mt-2 rounded-lg bg-emerald-500 px-5 py-3 font-semibold">{k('photo_scan')}</button>
            <button type="button" onClick={() => void start()} className="rounded-lg bg-white/15 px-5 py-2.5 font-semibold">{k('retry')}</button>
          </div>
        )}

        {/* Resultaat: schermvullend, leesbaar van op een meter */}
        {result && (
          <button type="button" onClick={() => setResult(null)}
            className={cn('absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center',
              tone === 'ok' && 'bg-emerald-600', tone === 'warn' && 'bg-amber-500 text-black', tone === 'error' && 'bg-red-600')}>
            {tone === 'ok' ? <Check className="h-20 w-20" strokeWidth={3} /> : tone === 'warn' ? <TriangleAlert className="h-20 w-20" /> : <X className="h-20 w-20" strokeWidth={3} />}
            <p className="text-3xl font-extrabold leading-tight break-words">{resultTitle(result)}</p>
            {resultDetail(result) && <p className="text-lg font-medium opacity-90">{resultDetail(result)}</p>}
          </button>
        )}
      </div>

      {/* Bediening */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        <button type="button" onClick={() => { unlockDoorAudio(); setSearchOpen(true); }}
          className="col-span-2 flex h-14 items-center justify-center gap-2 rounded-xl bg-white text-base font-semibold text-[#0b1220]">
          <Search className="h-5 w-5" />{k('search')}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => void toggleTorch()} disabled={!torch.available}
            aria-label={k('torch')} className={cn('flex h-14 flex-1 items-center justify-center rounded-xl bg-white/10 disabled:opacity-30', torch.on && 'bg-amber-400 text-black')}>
            {torch.on ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
          </button>
          <button type="button" onClick={toggleSound} aria-label={k('sound')} className="flex h-14 flex-1 items-center justify-center rounded-xl bg-white/10">
            {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Laatste scans */}
      <ul className="mx-4 mt-3 max-h-36 space-y-1 overflow-y-auto pb-3">
        {recent.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', toneOf(r.result) === 'ok' ? 'bg-emerald-400' : toneOf(r.result) === 'warn' ? 'bg-amber-400' : 'bg-red-500')} />
            <span className="min-w-0 flex-1 truncate">{r.attendee || (r.seq ? k('ticket_no_short', { n: r.seq }) : k('unknown_ticket'))}</span>
            <span className="text-xs text-white/50">{r.undone ? k('undone') : new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {adapter.undo && r.result === 'ok' && !r.undone && (
              <button type="button" onClick={() => void undo(r)} aria-label={k('undo')} className="rounded p-1 text-white/70 hover:bg-white/10"><RotateCcw className="h-4 w-4" /></button>
            )}
          </li>
        ))}
        {appUrl && !standalone && recent.length === 0 && (
          <li>
            <button type="button" onClick={() => { window.location.href = appUrl; }} className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-left text-sm text-white/70">
              <Smartphone className="h-4 w-4 shrink-0" />{k('as_app_button')}
            </button>
            <p className="px-3 pt-2 text-xs leading-relaxed text-white/60">{k('as_app_hint')}</p>
          </li>
        )}
        {!appUrl && installHint && !standalone && recent.length === 0 && (
          <li>
            <button type="button" onClick={() => setHintOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-left text-sm text-white/70">
              <Smartphone className="h-4 w-4 shrink-0" />{k('install_title')}
            </button>
            {hintOpen && <p className="px-3 pt-2 text-xs leading-relaxed text-white/60">{isIos ? k('install_ios') : k('install_android')}</p>}
          </li>
        )}
      </ul>

      {/* Zoeken op naam of bestelnummer */}
      {searchOpen && (
        <div className="absolute inset-0 z-10 flex flex-col bg-[#0b1220]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-2 px-4 py-3">
            <button type="button" onClick={() => { setSearchOpen(false); setQuery(''); setHits(null); }} aria-label={k('close')} className="-ml-2 rounded-full p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={k('search_placeholder')}
              className="h-12 flex-1 rounded-xl bg-white/10 px-4 text-base outline-none placeholder:text-white/40 focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {searching && <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-white/60" />}
            {!searching && hits && hits.length === 0 && <p className="mt-6 text-center text-white/60">{k('no_results')}</p>}
            {!searching && !hits && <p className="mt-6 text-center text-sm text-white/50">{k('search_hint')}</p>}
            <ul className="space-y-2">
              {(hits ?? []).map((h) => {
                const inside = h.status === 'checked_in';
                const usable = h.status === 'valid' || inside;
                return (
                  <li key={h.qr_token} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{h.attendee || k('unknown_ticket')}</p>
                      <p className="truncate text-xs text-white/60">
                        {[h.order_number, h.ticket_type, h.seq ? k('ticket_no_short', { n: h.seq }) : null].filter(Boolean).join(' · ')}
                      </p>
                      {inside && <p className="text-xs text-amber-300">{k('inside_since', { time: hhmm(h.checked_in_at) })}</p>}
                      {!usable && <p className="text-xs text-red-300">{k('status_unusable')}</p>}
                    </div>
                    <button type="button" disabled={!usable} onClick={() => void checkInHit(h)}
                      className="h-11 shrink-0 rounded-lg bg-emerald-500 px-4 font-semibold disabled:bg-white/10 disabled:text-white/40">
                      {k('check_in')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
