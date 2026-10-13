// FOOD-2 — keukenscherm voor pizzeria's, kebabzaken en frituren. Webshop-, kassa- en
// telefoonbestellingen in één overzicht, gesorteerd op afhaal-/levertijd. Gemaakt voor
// een tablet aan de muur: grote knoppen, belletje bij een nieuwe bestelling.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Bike, ChevronDown, Maximize2, Phone, Store, Undo2, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useKitchenBoard } from '@/components/admin/kitchen/useKitchenBoard';
import { minutesLeft, NEXT_STATUS, PREV_STATUS, type KitchenCard, type KitchenStatus } from '@/components/admin/kitchen/kitchenModel';

const COLUMNS: { status: KitchenStatus; title: string }[] = [
  { status: 'new', title: 'Nieuw' },
  { status: 'preparing', title: 'In bereiding' },
  { status: 'ready', title: 'Klaar' },
];
const SERVICE = {
  pickup: { label: 'Afhalen', icon: Store, cls: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' },
  local_delivery: { label: 'Levering', icon: Bike, cls: 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100' },
  eat_in: { label: 'Ter plaatse', icon: UtensilsCrossed, cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' },
} as const;
const SOUND_KEY = 'sq_kitchen_sound';

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
const euro = (n: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(n);

function actionLabel(c: KitchenCard): string {
  if (c.status === 'new') return 'Start';
  if (c.status === 'preparing') return 'Klaar';
  return c.service === 'local_delivery' ? 'Meegegeven' : c.service === 'eat_in' ? 'Opgediend' : 'Afgehaald';
}

function Countdown({ card, now }: { card: KitchenCard; now: number }) {
  const m = minutesLeft(card, now);
  if (!card.requestedTime) {
    const waited = -m;
    return <span className={cn('text-sm font-semibold', waited >= 20 ? 'text-red-600' : 'text-muted-foreground')}>Zo snel mogelijk · {waited} min geleden besteld</span>;
  }
  if (m < 0) return <span className="text-sm font-bold text-red-600">{-m} min te laat</span>;
  if (m === 0) return <span className="text-sm font-bold text-orange-600">Nu</span>;
  return <span className={cn('text-sm font-semibold', m <= 10 ? 'text-orange-600' : 'text-muted-foreground')}>over {m >= 90 ? `${Math.floor(m / 60)} u ${m % 60} min` : `${m} min`}</span>;
}

function TicketCard({ card, now, onAdvance, onBack, busy, fresh }: {
  card: KitchenCard; now: number; onAdvance: () => void; onBack: () => void; busy: boolean; fresh: boolean;
}) {
  const svc = card.service ? SERVICE[card.service] : null;
  const late = card.requestedTime ? minutesLeft(card, now) < 0 : false;
  return (
    <article className={cn('flex flex-col gap-3 rounded-xl border-2 bg-card p-4 shadow-sm transition-colors',
      late && card.status !== 'ready' ? 'border-red-500' : 'border-border', fresh && 'animate-pulse border-primary')}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-3xl font-bold tabular-nums leading-none">{card.requestedTime ? hhmm(card.requestedTime) : hhmm(card.createdAt)}</div>
          <Countdown card={card} now={now} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {svc ? <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', svc.cls)}><svc.icon className="h-3.5 w-3.5" />{svc.label}</span> : null}
          {card.orderId ? (
            <Link to={`/admin/orders/${card.orderId}`} className="text-xs font-semibold text-muted-foreground hover:underline">Webshop {card.label}</Link>
          ) : <span className="text-xs font-semibold text-muted-foreground">{card.label}</span>}
        </div>
      </header>

      {card.customer || card.phone ? (
        <div className="text-sm">
          {card.customer ? <span className="font-semibold">{card.customer}</span> : null}
          {card.phone ? <a href={`tel:${card.phone}`} className="ml-2 inline-flex items-center gap-1 text-muted-foreground hover:underline"><Phone className="h-3 w-3" />{card.phone}</a> : null}
          {card.address ? <div className="text-muted-foreground">{card.address}</div> : null}
        </div>
      ) : null}

      <ul className="space-y-1.5">
        {card.items.map((it, i) => (
          <li key={i} className="leading-tight">
            <span className="text-lg font-bold">{it.quantity}×</span> <span className="text-lg font-semibold">{it.name}</span>
            {it.detail ? <span className="block pl-7 text-sm text-muted-foreground">{it.detail}</span> : null}
            {it.addons.length ? <span className="block pl-7 text-sm font-semibold text-primary">+ {it.addons.join(', + ')}</span> : null}
          </li>
        ))}
      </ul>

      {card.note ? <p className="rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 dark:bg-amber-900/40 dark:text-amber-100">“{card.note}”</p> : null}

      <footer className="mt-auto flex items-center gap-2">
        <span className={cn('mr-auto text-xs font-bold', card.paid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
          {card.paid ? 'Betaald' : card.total != null ? `Nog te betalen ${euro(card.total)}` : 'Nog te betalen'}
        </span>
        {PREV_STATUS[card.status] ? (
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onBack} disabled={busy} aria-label="Terugzetten"><Undo2 className="h-4 w-4" /></Button>
        ) : null}
        {NEXT_STATUS[card.status] ? (
          <Button className={cn('h-11 min-w-28 text-base font-bold', card.status === 'preparing' && 'bg-emerald-600 hover:bg-emerald-700')} onClick={onAdvance} disabled={busy}>
            {actionLabel(card)}
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

// Kort belletje met WebAudio (geen bestand nodig).
function ding() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.18].forEach((t, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = i ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.55);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* geen audio beschikbaar */ }
}

export default function KitchenPage() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const { cards, isLoading, error, setStatus } = useKitchenBoard(now);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; } });
  const [tab, setTab] = useState<KitchenStatus>('new');
  const [showDone, setShowDone] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);

  // Nieuwe bestelling: belletje en even laten oplichten. De eerste lading telt niet.
  useEffect(() => {
    if (isLoading) return;
    const open = cards.filter((c) => c.status === 'new').map((c) => c.key);
    if (seen.current === null) { seen.current = new Set(cards.map((c) => c.key)); return; }
    const added = open.filter((k) => !seen.current!.has(k));
    cards.forEach((c) => seen.current!.add(c.key));
    if (!added.length) return;
    if (sound) ding();
    setFresh((f) => new Set([...f, ...added]));
    setTimeout(() => setFresh((f) => { const n = new Set(f); added.forEach((k) => n.delete(k)); return n; }), 20_000);
  }, [cards, isLoading, sound]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, next ? '1' : '0'); } catch { /* privémodus */ }
    if (next) ding(); // ook om de browser audio te laten toestaan
  };

  const byStatus = useMemo(() => {
    const m: Record<KitchenStatus, KitchenCard[]> = { new: [], preparing: [], ready: [], done: [], cancelled: [] };
    cards.forEach((c) => m[c.status].push(c));
    m.done.sort((a, b) => new Date(b.statusAt).getTime() - new Date(a.statusAt).getTime());
    return m;
  }, [cards]);
  const nextHour = cards.filter((c) => c.status !== 'done' && c.requestedTime && minutesLeft(c, now) >= 0 && minutesLeft(c, now) <= 60).length;

  const move = (card: KitchenCard, status: KitchenStatus | null) => { if (status) setStatus.mutate({ card, status }); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted/40">
      <header className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-3">
        <Button asChild variant="ghost" size="icon" aria-label="Terug naar de admin"><Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <h1 className="text-xl font-bold">Keuken</h1>
        <span className="text-2xl font-bold tabular-nums">{new Date(now).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {byStatus.new.length} nieuw · {byStatus.preparing.length} bezig · {byStatus.ready.length} klaar · {nextHour} het komende uur
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant={sound ? 'secondary' : 'outline'} size="sm" onClick={toggleSound}>
            {sound ? <Bell className="mr-1.5 h-4 w-4" /> : <BellOff className="mr-1.5 h-4 w-4" />}{sound ? 'Geluid aan' : 'Geluid uit'}
          </Button>
          <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label="Volledig scherm"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Gsm: tabbladen per kolom */}
      <div className="flex gap-1 border-b bg-background px-2 py-2 md:hidden">
        {COLUMNS.map((c) => (
          <button key={c.status} type="button" onClick={() => setTab(c.status)}
            className={cn('flex-1 rounded-md px-2 py-2 text-sm font-semibold', tab === c.status ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
            {c.title} ({byStatus[c.status].length})
          </button>
        ))}
      </div>

      {error ? <p className="m-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">Bestellingen laden lukte niet. Het scherm probeert het opnieuw.</p> : null}

      <main className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <section key={col.status} className={cn('min-h-0 flex-col gap-3', tab === col.status ? 'flex' : 'hidden md:flex')}>
            <h2 className="hidden items-center justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground md:flex">
              {col.title}<span className="rounded-full bg-background px-2 py-0.5">{byStatus[col.status].length}</span>
            </h2>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-6">
              {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p> : null}
              {!isLoading && byStatus[col.status].length === 0 ? (
                <p className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                  {col.status === 'new' ? 'Nog geen nieuwe bestellingen.' : col.status === 'preparing' ? 'Niets in bereiding.' : 'Niets klaar om mee te geven.'}
                </p>
              ) : null}
              {byStatus[col.status].map((c) => (
                <TicketCard key={c.key} card={c} now={now} busy={setStatus.isPending} fresh={fresh.has(c.key)}
                  onAdvance={() => move(c, NEXT_STATUS[c.status])} onBack={() => move(c, PREV_STATUS[c.status])} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {byStatus.done.length ? (
        <footer className="max-h-[40vh] overflow-y-auto border-t bg-background px-4 py-2">
          <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
            <ChevronDown className={cn('h-4 w-4 transition-transform', showDone && 'rotate-180')} />Afgerond ({byStatus.done.length})
          </button>
          {showDone ? (
            <ul className="mt-2 divide-y text-sm">
              {byStatus.done.map((c) => (
                <li key={c.key} className="flex items-center gap-3 py-1.5">
                  <span className="w-12 font-semibold tabular-nums">{hhmm(c.requestedTime || c.createdAt)}</span>
                  <span className="flex-1 truncate">{c.label} · {c.customer || '—'} · {c.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</span>
                  <Button variant="ghost" size="sm" onClick={() => move(c, 'ready')}><Undo2 className="mr-1 h-3.5 w-3.5" />Terug</Button>
                </li>
              ))}
            </ul>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
