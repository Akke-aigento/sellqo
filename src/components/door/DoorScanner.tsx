// EVENT-SCAN-1 — "SellQo Deur": de scanner aan de deur, schermvullend en gemaakt voor
// een donkere ingang, een gsm in één hand en een rij mensen. Gedeeld door de crew-scanlink
// (/scan/:token, geen account) en de admin-scanner (/admin/checkin). Het verschil zit in
// de adapter: die zegt hoe er gescand, geteld en gezocht wordt.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ArrowLeft, Camera, Check, Flashlight, FlashlightOff, Loader2, RotateCcw, Search, Smartphone,
  TriangleAlert, Users, Volume2, VolumeX, Wifi, WifiOff, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { doorFeedback, keepScreenOn, unlockDoorAudio, type DoorTone } from '@/lib/doorFeedback';
import {
  DoorNetworkError, enqueueScan, invalidReasonKey, isNetworkError, recoverAlreadyInside, runWithRetry, withTimeout,
} from '@/lib/doorScanFlow';
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
  /** EVENT-SCAN-2 — geldig ticket, maar buiten het scanvenster; host mag forceren. */
  can_force?: boolean;
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

/** EVENT-DOOR-2 — elke oproep krijgt een AbortSignal: de scanner breekt na 8 s af
 *  (doorScanFlow.withTimeout). Een adapter die het signaal negeert werkt nog steeds,
 *  maar laat dan een hangende fetch op de achtergrond doorlopen. */
export interface DoorAdapter {
  scan: (qrToken: string, signal?: AbortSignal) => Promise<DoorScanResult>;
  /** EVENT-SCAN-2 — zelfde scan, maar het scanvenster negerend ("Toch inchecken"). */
  forceScan?: (qrToken: string, signal?: AbortSignal) => Promise<DoorScanResult>;
  stats: (signal?: AbortSignal) => Promise<{ sold: number; inside: number }>;
  search: (q: string, signal?: AbortSignal) => Promise<DoorSearchHit[]>;
  /** Alleen voor de host (admin): een check-in terugdraaien. */
  undo?: (qrToken: string, signal?: AbortSignal) => Promise<DoorScanResult>;
}

/** Wat het scherm toont: een serverantwoord, of (EVENT-DOOR-2) een netwerkfout waarvan
 *  de uitkomst onbekend is — die is NOOIT rood "ongeldig". */
type Shown = DoorScanResult & { net?: DoorNetworkError['kind']; recovered?: boolean };
type ScanMode = 'scan' | 'force';

interface Recent { id: string; token: string; result: string; attendee: string | null; seq: number | null; at: number; undone?: boolean }

const SCANNER_ID = 'door-scanner-video';
const FILE_SCAN_ID = 'door-scanner-file';
const SAME_TOKEN_COOLDOWN_MS = 4000;
/** EVENT-DOOR-2 — na een netwerkfout mag dezelfde QR meteen opnieuw; deze korte pauze
 *  voorkomt alleen dat de camera (12 beelden/s) een piepende lus maakt. */
const NET_RETRY_COOLDOWN_MS = 1200;
/** Pauze tussen het tonen van een resultaat en de volgende scan uit de wachtrij. */
const QUEUE_GAP_MS = 900;
const RESULT_MS = 1700;
const SOUND_KEY = 'sellqo.door.sound';

const toneOf = (r?: string): DoorTone =>
  r === 'ok' || r === 'undone' ? 'ok' : r === 'already' || r === 'reentry_blocked' || r === 'wrong_event' || r === 'outside_window' ? 'warn' : 'error';
/** Schermtint: naast groen/oranje/rood een vierde, grijze staat voor "geen verbinding". */
type ShownTone = DoorTone | 'net';
const shownTone = (r: Shown): ShownTone => (r.net ? 'net' : r.success ? toneOf(r.result) : 'error');
const isOnlineNow = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

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
  const [result, setResult] = useState<Shown | null>(null);
  const [stats, setStats] = useState<{ sold: number; inside: number } | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<DoorSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  // EVENT-DOOR-2 — netwerkstaat zichtbaar maken in plaats van stil te verbergen.
  const [online, setOnline] = useState(isOnlineNow);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [queued, setQueued] = useState(0);
  const [statsError, setStatsError] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const pausedRef = useRef(false);
  const lastRef = useRef<{ token: string; at: number; net?: boolean; mode?: ScanMode } | null>(null);
  const resultTimer = useRef<number | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  pausedRef.current = searchOpen;
  // EVENT-DOOR-2 — scans die binnenkomen terwijl er een oproep loopt, en per ticket de
  // starttijd van een poging waarvan de uitkomst onbekend bleef (antwoord verloren).
  const queueRef = useRef<string[]>([]);
  const currentRef = useRef<string | null>(null);
  const unresolvedRef = useRef<Map<string, number>>(new Map());

  const refreshStats = useCallback(async () => {
    try {
      setStats(await withTimeout((signal) => adapter.stats(signal)));
      setStatsError(false);
    } catch {
      // Teller is bijzaak, maar een verouderde teller moet je wél zien.
      setStatsError(true);
    }
  }, [adapter]);

  useEffect(() => {
    void refreshStats();
    const id = window.setInterval(() => void refreshStats(), 15000);
    return () => window.clearInterval(id);
  }, [refreshStats]);

  // Online/offline: navigator.onLine is alleen betrouwbaar als hij "offline" zegt, dus
  // dat is het enige wat we vooraf blokkeren; al de rest vangt de timeout op.
  useEffect(() => {
    const up = () => { setOnline(true); void refreshStats(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [refreshStats]);

  const showResult = useCallback((res: Shown, token: string) => {
    setResult(res);
    doorFeedback(res.net ? 'warn' : res.success ? toneOf(res.result) : 'error', soundRef.current);
    if (resultTimer.current) window.clearTimeout(resultTimer.current);
    // EVENT-SCAN-2 — buiten het venster blijft de kaart staan: er valt te beslissen.
    // EVENT-DOOR-2 — een netwerkfout ook: de portier moet "opnieuw proberen" kunnen.
    const ms = res.net ? 12000 : res.result === 'outside_window' ? 8000 : RESULT_MS;
    resultTimer.current = window.setTimeout(() => setResult(null), ms);
    const recentResult = res.net ? 'net' : res.result;
    if (recentResult) {
      // Een echt antwoord vervangt de grijze "niet geregistreerd"-regels van hetzelfde ticket.
      setRecent((prev) => [
        { id: `${token}-${Date.now()}`, token, result: recentResult, attendee: res.attendee ?? null, seq: res.seq ?? null, at: Date.now() },
        ...(res.net ? prev : prev.filter((x) => !(x.token === token && x.result === 'net'))),
      ].slice(0, 6));
    }
    if (res.result === 'ok') void refreshStats();
  }, [refreshStats]);

  /** Eén scan-oproep met timeout, één automatische herhaling en herstel van een
   *  verloren antwoord. Loopt er al een oproep, dan gaat de scan in de wachtrij. */
  const run = useCallback(async (token: string, mode: ScanMode = 'scan') => {
    const call = mode === 'force' ? adapter.forceScan : adapter.scan;
    if (!call) return;
    if (busyRef.current) {
      queueRef.current = enqueueScan(queueRef.current, token, currentRef.current);
      setQueued(queueRef.current.length);
      return;
    }
    busyRef.current = true;
    currentRef.current = token;
    lastRef.current = { token, at: Date.now(), mode };
    if (resultTimer.current) window.clearTimeout(resultTimer.current);
    setResult(null);
    setBusy(true);
    const startedAt = Date.now();
    let netFail = false;
    try {
      const { value, attempts } = await runWithRetry((signal) => call(token, signal), {
        isOnline: isOnlineNow,
        onRetry: () => setRetrying(true),
      });
      // Liep een eerdere poging (deze of een vorige) zonder antwoord af, dan kan de
      // server ons al ingecheckt hebben: dat "al binnen" is dan onze eigen check-in.
      const prior = unresolvedRef.current.get(token);
      const since = attempts > 1 ? Math.min(prior ?? startedAt, startedAt) : prior ?? null;
      unresolvedRef.current.delete(token);
      if (recoverAlreadyInside(value, since, Date.now())) {
        showResult({ ...value, result: 'ok', recovered: true }, token);
      } else {
        showResult(value, token);
      }
    } catch (e) {
      if (isNetworkError(e)) {
        netFail = true;
        const kind = e instanceof DoorNetworkError ? e.kind : 'network';
        // Offline = er ging niets de deur uit; anders is de uitkomst op de server onbekend.
        if (kind !== 'offline' && !unresolvedRef.current.has(token)) unresolvedRef.current.set(token, startedAt);
        showResult({ success: false, net: kind }, token);
      } else {
        showResult({ success: false, error: e instanceof Error ? e.message : String(e) }, token);
      }
    } finally {
      lastRef.current = { token, at: Date.now(), net: netFail, mode };
      currentRef.current = null;
      setBusy(false);
      setRetrying(false);
      window.setTimeout(() => {
        busyRef.current = false;
        const next = queueRef.current.shift();
        setQueued(queueRef.current.length);
        if (next && !pausedRef.current) void runRef.current(next);
        else if (pausedRef.current) { queueRef.current = []; setQueued(0); }
      }, queueRef.current.length > 0 ? QUEUE_GAP_MS : 700);
    }
  }, [adapter, showResult]);
  const runRef = useRef(run);
  runRef.current = run;

  const handle = useCallback(async (raw: string) => {
    const token = raw.trim();
    if (!token || pausedRef.current) return;
    if (token === currentRef.current) return;
    const last = lastRef.current;
    if (last && last.token === token) {
      // Offline: dezelfde QR voor de camera niet blijven herhalen (piepende lus); de
      // knop "Opnieuw proberen" of terug online komen lost dat op.
      if (last.net && !isOnlineNow()) return;
      const cooldown = last.net ? NET_RETRY_COOLDOWN_MS : SAME_TOKEN_COOLDOWN_MS;
      if (Date.now() - last.at < cooldown) return;
    }
    await runRef.current(token, 'scan');
  }, []);

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
      await run(decoded.trim(), 'scan');
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
    if (q.length < 2) { setHits(null); setSearchError(false); return; }
    setSearching(true);
    setSearchError(false);
    const id = window.setTimeout(async () => {
      // EVENT-DOOR-2 — een netwerkfout is géén "niet gevonden": toon hem als fout.
      try { setHits(await withTimeout((signal) => adapter.search(q, signal))); }
      catch { setHits(null); setSearchError(true); }
      finally { setSearching(false); }
    }, 300);
    return () => window.clearTimeout(id);
  }, [query, searchOpen, adapter, searchNonce]);

  const checkInHit = async (hit: DoorSearchHit) => {
    unlockDoorAudio();
    setSearchOpen(false);
    pausedRef.current = false;
    setQuery('');
    setHits(null);
    lastRef.current = null;
    await run(hit.qr_token, 'scan');
  };

  // EVENT-SCAN-2 — "Toch inchecken": zelfde token, venster genegeerd. Host beslist.
  const forceCheckin = async () => {
    const token = lastRef.current?.token;
    if (!token || !adapter.forceScan || busyRef.current) return;
    await run(token, 'force');
  };

  // EVENT-DOOR-2 — "Opnieuw proberen" na een netwerkfout: zelfde ticket, zelfde soort scan.
  const retryLast = async () => {
    const last = lastRef.current;
    if (!last) return;
    unlockDoorAudio();
    // Nog in de korte pauze na de vorige scan? Dan via de wachtrij, nooit stil negeren.
    await run(last.token, last.mode ?? 'scan');
  };

  const undo = async (r: Recent) => {
    if (!adapter.undo) return;
    const undoFn = adapter.undo;
    try {
      const res = await withTimeout((signal) => undoFn(r.token, signal));
      if (res.result === 'undone') {
        setRecent((prev) => prev.map((x) => (x.id === r.id ? { ...x, undone: true } : x)));
        void refreshStats();
      }
      doorFeedback(res.result === 'undone' ? 'ok' : 'warn', soundRef.current);
    } catch { doorFeedback('error', soundRef.current); }
  };

  const tone = result ? shownTone(result) : null;
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

  const resultTitle = (r: Shown) => {
    if (r.net === 'offline') return k('net.offline_title');
    if (r.net === 'timeout') return k('net.timeout_title');
    if (r.net) return k('net.network_title');
    if (!r.success) return k('result.failed');
    switch (r.result) {
      case 'ok': return r.attendee ? k('result.welcome_name', { name: r.attendee }) : k('result.welcome');
      case 'already': return k('result.already');
      case 'reentry_blocked': return k('result.reentry_blocked');
      case 'wrong_event': return k('result.wrong_event');
      case 'outside_window': return k('result.outside_window');
      case 'not_allowed_zone': return k('result.not_allowed');
      case 'zone_full': return k('result.full');
      // EVENT-DOOR-2 — de server antwoordt 'invalid' met reason ticket_cancelled/refunded.
      default: return k(invalidReasonKey(r.result, r.reason));
    }
  };
  const resultDetail = (r: Shown) => {
    if (r.net) return k('net.not_registered');
    if (r.recovered) return k('result.recovered');
    if (!r.success) return r.error ?? '';
    if (r.result === 'already') return [r.checked_in_at ? k('result.at', { time: hhmm(r.checked_in_at) }) : '', r.attendee ?? ''].filter(Boolean).join(' · ');
    if ((r.result === 'wrong_event' || r.result === 'outside_window') && r.expected_event?.date) {
      const d = new Date(`${r.expected_event.date}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
      const t0 = r.expected_event.start_time ? ` · ${String(r.expected_event.start_time).slice(0, 5)}` : '';
      return k('result.for_date', { date: `${d}${t0}` });
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
        <span
          role="status"
          aria-label={online ? k('net.online') : k('net.offline')}
          title={online ? k('net.online') : k('net.offline')}
          className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-400 text-black')}
        >
          {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        </span>
        <div
          className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm tabular-nums', statsError ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10')}
          aria-label={statsError ? k('stats_stale') : k('counter_label')}
          title={statsError ? k('stats_stale') : undefined}
        >
          {statsError ? <TriangleAlert className="h-4 w-4 text-amber-300" /> : <Users className="h-4 w-4 text-emerald-400" />}
          <span className="font-semibold">{stats?.inside ?? '–'}</span>
          <span className={statsError ? 'text-amber-200/70' : 'text-white/50'}>/ {stats?.sold ?? '–'}</span>
        </div>
      </header>

      {/* EVENT-DOOR-2 — offline of verouderde teller: altijd zichtbaar, nooit stil. */}
      {!online && (
        <div role="alert" className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-semibold text-black">
          <WifiOff className="h-4 w-4 shrink-0" />{k('net.offline_banner')}
        </div>
      )}
      {online && statsError && (
        <p className="mx-4 mb-2 text-xs text-amber-200">{k('stats_stale')}</p>
      )}

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

        {/* EVENT-DOOR-2 — bezig: de portier ziet dat er iets loopt, ook op traag 4G. */}
        {busy && !result && (
          <div role="status" aria-live="polite" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b1220]/95 p-6 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-white" />
            <p className="text-2xl font-bold">{retrying ? k('busy_retry') : k('busy')}</p>
            {queued > 0 && <p className="text-base text-white/70">{k('queued', { count: queued })}</p>}
          </div>
        )}

        {/* Resultaat: schermvullend, leesbaar van op een meter */}
        {result && (
          <button type="button" onClick={() => setResult(null)}
            className={cn('absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center',
              tone === 'ok' && 'bg-emerald-600', tone === 'warn' && 'bg-amber-500 text-black', tone === 'error' && 'bg-red-600',
              tone === 'net' && 'bg-slate-700')}>
            {tone === 'ok' ? <Check className="h-20 w-20" strokeWidth={3} />
              : tone === 'warn' ? <TriangleAlert className="h-20 w-20" />
              : tone === 'net' ? <WifiOff className="h-20 w-20 text-amber-400" />
              : <X className="h-20 w-20" strokeWidth={3} />}
            <p className="text-3xl font-extrabold leading-tight break-words">{resultTitle(result)}</p>
            {resultDetail(result) && <p className="text-lg font-medium opacity-90">{resultDetail(result)}</p>}
            {result.net && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); void retryLast(); }}
                className="mt-2 rounded-xl bg-amber-400 px-6 py-3.5 text-lg font-bold text-black"
              >{k('net.retry')}</span>
            )}
            {queued > 0 && <p className="text-sm opacity-80">{k('queued', { count: queued })}</p>}
            {result.result === 'outside_window' && result.can_force && adapter.forceScan && lastRef.current && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); void forceCheckin(); }}
                className="mt-2 rounded-xl bg-black/80 px-6 py-3.5 text-lg font-bold text-white"
              >{k('result.force_checkin')}</span>
            )}
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
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', r.result === 'net' ? 'bg-slate-400' : toneOf(r.result) === 'ok' ? 'bg-emerald-400' : toneOf(r.result) === 'warn' ? 'bg-amber-400' : 'bg-red-500')} />
            <span className="min-w-0 flex-1 truncate">{r.result === 'net' ? k('net.recent') : r.attendee || (r.seq ? k('ticket_no_short', { n: r.seq }) : k('unknown_ticket'))}</span>
            <span className="text-xs text-white/50">{r.undone ? k('undone') : new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {r.result === 'net' && (
              <button type="button" onClick={() => { unlockDoorAudio(); void run(r.token, 'scan'); }} aria-label={k('net.retry')} className="rounded p-1 text-amber-300 hover:bg-white/10"><RotateCcw className="h-4 w-4" /></button>
            )}
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
            {!searching && searchError && (
              <div role="alert" className="mt-6 flex flex-col items-center gap-3 text-center">
                <WifiOff className="h-8 w-8 text-amber-400" />
                <p className="font-semibold">{k('search_failed')}</p>
                <button type="button" onClick={() => setSearchNonce((n) => n + 1)} className="rounded-lg bg-white/15 px-5 py-2.5 font-semibold">{k('net.retry')}</button>
              </div>
            )}
            {!searching && !hits && !searchError && <p className="mt-6 text-center text-sm text-white/50">{k('search_hint')}</p>}
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
