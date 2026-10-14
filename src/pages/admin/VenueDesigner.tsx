// ZAAL-1 — zaalontwerper. Je tekent per sectie rijen met de generator, selecteert stoelen
// (klik, shift-klik of een kader slepen) en geeft ze een prijsklasse, een rolstoelplek of
// zet ze uit de verkoop. Alles blijft lokaal tot je op Bewaren drukt (useSaveVenue).
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Accessibility, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ban, Check, Loader2, Plus, Rows3, Save, Trash2, UserRound, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  bounds, generateSection, placeSection, rowWidth, seatLabel, type LayoutSeat, type Numbering, type SeatKind,
} from '@/lib/seatLayout';
import { CLASS_COLORS, useSaveVenue, useVenueData, type VenueData } from '@/hooks/useVenues';

const CELL = 28;
const NO_CLASS = '__none__';
const newId = () => crypto.randomUUID();
const clone = (d: VenueData): VenueData => ({
  venue: { ...d.venue },
  sections: d.sections.map((s) => ({ ...s })),
  classes: d.classes.map((c) => ({ ...c })),
  seats: d.seats.map((s) => ({ ...s })),
});
const posKey = (x: number, y: number) => `${x},${y}`;

export default function VenueDesigner() {
  const { venueId } = useParams<{ venueId: string }>();
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.venues.${x}`, o);
  const { data, isLoading } = useVenueData(venueId);
  const save = useSaveVenue(venueId);

  const [base, setBase] = useState<VenueData | null>(null);
  const [draft, setDraft] = useState<VenueData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Eén keer per zaal overnemen; een refetch mag niet-bewaarde wijzigingen niet wissen.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (data && loadedFor.current !== data.venue.id) {
      loadedFor.current = data.venue.id;
      setBase(clone(data));
      setDraft(clone(data));
      setActiveSection(data.sections[0]?.id ?? null);
    }
  }, [data]);

  const dirty = useMemo(() => !!base && !!draft && JSON.stringify(base) !== JSON.stringify(draft), [base, draft]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (isLoading || (data && !draft)) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data || !draft || !base) {
    return (
      <Card><CardContent className="py-10 text-center">
        <p className="mb-3">{k('not_found')}</p>
        <Button asChild variant="outline"><Link to="/admin/events/venues">{k('back_to_venues')}</Link></Button>
      </CardContent></Card>
    );
  }

  const update = (fn: (d: VenueData) => VenueData) => setDraft((d) => (d ? fn(d) : d));

  const onSave = async () => {
    const seen = new Set<string>();
    for (const s of draft.seats) {
      const p = posKey(s.x, s.y);
      if (seen.has(p)) { toast.error(k('overlap_error')); return; }
      seen.add(p);
    }
    if (!draft.venue.name.trim()) { toast.error(k('name_required')); return; }
    try {
      await save.mutateAsync({ before: base, after: draft });
      setBase(clone(draft));
      toast.success(k('saved'));
    } catch {
      toast.error(k('save_failed'));
    }
  };

  const sellable = draft.seats.filter((s) => s.sellable).length;

  return (
    <div className="space-y-4">
      <Link to="/admin/events/venues" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {k('back_to_venues')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl md:text-2xl font-bold">{draft.venue.name || k('untitled')}</h1>
          <p className="text-sm text-muted-foreground">
            {k('seat_count', { count: draft.seats.length })} · {k('sellable_count', { count: sellable })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="secondary">{k('unsaved')}</Badge>}
          <Button onClick={() => void onSave()} disabled={!dirty || save.isPending}>
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {k('save')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <VenueInfoCard draft={draft} update={update} k={k} />
          <SectionsCard
            draft={draft} update={update} k={k}
            active={activeSection} setActive={setActiveSection}
            clearSelection={() => setSelected(new Set())}
          />
        </div>
        <SeatCanvas draft={draft} update={update} k={k} selected={selected} setSelected={setSelected} />
        <PriceClassesCard draft={draft} update={update} k={k} />
      </div>
    </div>
  );
}

type K = (x: string, o?: Record<string, unknown>) => string;
type Update = (fn: (d: VenueData) => VenueData) => void;

function VenueInfoCard({ draft, update, k }: { draft: VenueData; update: Update; k: K }) {
  const set = (patch: Partial<VenueData['venue']>) => update((d) => ({ ...d, venue: { ...d.venue, ...patch } }));
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{k('venue_card')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="v-name">{k('name')}</Label>
          <Input id="v-name" value={draft.venue.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="v-addr">{k('address')}</Label>
          <Input id="v-addr" value={draft.venue.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="v-stage">{k('stage_label')}</Label>
          <Input id="v-stage" value={draft.venue.stage_label} onChange={(e) => set({ stage_label: e.target.value })} />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionsCard({
  draft, update, k, active, setActive, clearSelection,
}: {
  draft: VenueData; update: Update; k: K; active: string | null;
  setActive: (id: string | null) => void; clearSelection: () => void;
}) {
  const [rows, setRows] = useState('10');
  const [perRow, setPerRow] = useState('20');
  const [aisles, setAisles] = useState('10');
  const [startLabel, setStartLabel] = useState('A');
  const [numbering, setNumbering] = useState<Numbering>('ltr');
  const [classId, setClassId] = useState<string>(draft.classes[0]?.id ?? NO_CLASS);

  const section = draft.sections.find((s) => s.id === active) ?? null;
  const sectionSeats = section ? draft.seats.filter((s) => s.section_id === section.id).length : 0;

  const addSection = () => {
    const id = newId();
    update((d) => ({ ...d, sections: [...d.sections, { id, name: k('section_n', { n: d.sections.length + 1 }), sort_order: d.sections.length }] }));
    setActive(id);
  };

  const removeSection = (id: string) => {
    update((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id), seats: d.seats.filter((s) => s.section_id !== id) }));
    clearSelection();
    if (active === id) setActive(draft.sections.find((s) => s.id !== id)?.id ?? null);
  };

  const generate = () => {
    if (!section) return;
    const r = Math.floor(Number(rows));
    const p = Math.floor(Number(perRow));
    if (!(r >= 1 && r <= 100 && p >= 1 && p <= 150)) { toast.error(k('gen_invalid')); return; }
    const aisleAfter = aisles.split(/[,\s;]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    const own = draft.seats.filter((s) => s.section_id === section.id);
    const others = draft.seats.filter((s) => s.section_id !== section.id);
    const keepY = own.length ? Math.min(...own.map((s) => s.y)) : null;
    const width = rowWidth(p, aisleAfter);
    const spot = placeSection(others, width, keepY);
    const seats = generateSection({
      sectionId: section.id, rows: r, perRow: p, aisleAfter, startLabel, numbering,
      startY: spot.startY, offsetX: spot.offsetX, priceClassId: classId === NO_CLASS ? null : classId, newId,
    });
    const taken = new Set(others.map((s) => posKey(s.x, s.y)));
    if (seats.some((s) => taken.has(posKey(s.x, s.y)) || s.x >= 400 || s.y >= 400)) { toast.error(k('gen_overlap')); return; }
    update((d) => ({ ...d, seats: [...others, ...seats] }));
    clearSelection();
    toast.success(k('gen_done', { count: seats.length }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{k('sections')}</CardTitle>
        <Button size="sm" variant="outline" onClick={addSection}><Plus className="mr-1 h-4 w-4" />{k('add_section')}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {draft.sections.map((s) => (
            <div key={s.id} className={cn('flex items-center gap-2 rounded-md border p-1.5', s.id === active && 'border-primary bg-primary/5')}>
              <button type="button" className="shrink-0 px-1" aria-label={k('select_section')} onClick={() => setActive(s.id)}>
                <span className={cn('block h-3 w-3 rounded-full border', s.id === active ? 'border-primary bg-primary' : 'border-muted-foreground')} />
              </button>
              <Input
                className="h-8" value={s.name} onFocus={() => setActive(s.id)}
                onChange={(e) => update((d) => ({ ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) }))}
              />
              <span className="shrink-0 text-xs text-muted-foreground">{draft.seats.filter((x) => x.section_id === s.id).length}</span>
              <Button
                size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={k('remove_section')}
                disabled={draft.sections.length <= 1} onClick={() => removeSection(s.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {section && (
          <div className="space-y-3 rounded-md bg-muted/50 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium"><Rows3 className="h-4 w-4" />{k('generator_for', { name: section.name })}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label htmlFor="g-rows" className="text-xs">{k('rows')}</Label><Input id="g-rows" className="h-8" inputMode="numeric" value={rows} onChange={(e) => setRows(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="g-per" className="text-xs">{k('per_row')}</Label><Input id="g-per" className="h-8" inputMode="numeric" value={perRow} onChange={(e) => setPerRow(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="g-aisle" className="text-xs">{k('aisle_after')}</Label><Input id="g-aisle" className="h-8" placeholder="10" value={aisles} onChange={(e) => setAisles(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="g-start" className="text-xs">{k('first_row')}</Label><Input id="g-start" className="h-8" value={startLabel} onChange={(e) => setStartLabel(e.target.value)} /></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{k('numbering')}</Label>
              <Select value={numbering} onValueChange={(v) => setNumbering(v as Numbering)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ltr">{k('numbering_ltr')}</SelectItem>
                  <SelectItem value="rtl">{k('numbering_rtl')}</SelectItem>
                  <SelectItem value="oddeven">{k('numbering_oddeven')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{k('price_class')}</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLASS}>{k('no_class')}</SelectItem>
                  {draft.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {sectionSeats > 0 && <p className="text-xs text-muted-foreground">{k('gen_replaces', { count: sectionSeats })}</p>}
            <Button size="sm" className="w-full" onClick={generate}>{sectionSeats > 0 ? k('regenerate') : k('generate')}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SeatCanvas({
  draft, update, k, selected, setSelected,
}: {
  draft: VenueData; update: Update; k: K; selected: Set<string>; setSelected: (s: Set<string>) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const colorOf = useMemo(() => new Map(draft.classes.map((c) => [c.id, c.color])), [draft.classes]);

  const b = bounds(draft.seats) ?? { minX: 0, maxX: 9, minY: 0, maxY: 4 };
  // Eén cel marge links en rechts voor de rijletters.
  const ox = b.minX - 1;
  const oy = b.minY;
  const cols = b.maxX - b.minX + 3;
  const rowsN = b.maxY - b.minY + 1;
  const width = cols * CELL;
  const height = rowsN * CELL;
  const STAGE = 56;

  const rowLabels = useMemo(() => {
    const m = new Map<string, { label: string; y: number; minX: number; maxX: number }>();
    for (const s of draft.seats) {
      const key = `${s.section_id}|${s.y}|${s.row_label}`;
      const cur = m.get(key);
      if (!cur) m.set(key, { label: s.row_label, y: s.y, minX: s.x, maxX: s.x });
      else { cur.minX = Math.min(cur.minX, s.x); cur.maxX = Math.max(cur.maxX, s.x); }
    }
    return [...m.values()];
  }, [draft.seats]);

  const toggle = (id: string, additive: boolean) => {
    const next = new Set(additive ? selected : []);
    if (selected.has(id) && (additive || selected.size === 1)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const local = (e: ReactPointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top - STAGE };
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-seat]')) return;
    const p = local(e);
    wrapRef.current?.setPointerCapture(e.pointerId);
    setRect({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!rect) return;
    const p = local(e);
    setRect({ ...rect, x1: p.x, y1: p.y });
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!rect) return;
    const xa = Math.min(rect.x0, rect.x1), xb = Math.max(rect.x0, rect.x1);
    const ya = Math.min(rect.y0, rect.y1), yb = Math.max(rect.y0, rect.y1);
    const tiny = xb - xa < 4 && yb - ya < 4;
    const next = new Set(e.shiftKey ? selected : []);
    if (!tiny) {
      for (const s of draft.seats) {
        const cx = (s.x - ox + 0.5) * CELL, cy = (s.y - oy + 0.5) * CELL;
        if (cx >= xa && cx <= xb && cy >= ya && cy <= yb) next.add(s.id);
      }
    }
    setSelected(next);
    setRect(null);
  };

  const sel = draft.seats.filter((s) => selected.has(s.id));
  const patch = (fn: (s: LayoutSeat) => LayoutSeat) =>
    update((d) => ({ ...d, seats: d.seats.map((s) => (selected.has(s.id) ? fn(s) : s)) }));
  const setKind = (kind: SeatKind) => patch((s) => ({ ...s, kind }));
  const allBlocked = sel.length > 0 && sel.every((s) => !s.sellable);
  const remove = () => {
    update((d) => ({ ...d, seats: d.seats.filter((s) => !selected.has(s.id)) }));
    setSelected(new Set());
  };
  const nudge = (dx: number, dy: number) => {
    const taken = new Set(draft.seats.filter((s) => !selected.has(s.id)).map((s) => posKey(s.x, s.y)));
    const moved = sel.map((s) => ({ x: s.x + dx, y: s.y + dy }));
    if (moved.some((p) => p.x < 0 || p.y < 0 || p.x >= 400 || p.y >= 400 || taken.has(posKey(p.x, p.y)))) {
      toast.error(k('nudge_blocked'));
      return;
    }
    patch((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
  };

  return (
    <Card className="min-w-0">
      <CardContent className="space-y-3 p-3">
        <div className="flex min-h-9 flex-wrap items-center gap-1.5">
          {sel.length === 0 ? (
            <p className="text-sm text-muted-foreground">{k('select_hint')}</p>
          ) : (
            <>
              <span className="mr-1 text-sm font-medium">{k('selected', { count: sel.length })}</span>
              {draft.classes.map((c) => (
                <Button key={c.id} size="sm" variant="outline" className="h-8" onClick={() => patch((s) => ({ ...s, price_class_id: c.id }))}>
                  <span className="mr-1.5 h-3 w-3 rounded-full" style={{ background: c.color }} />{c.name}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="h-8" onClick={() => setKind('seat')}><UserRound className="mr-1 h-4 w-4" />{k('kind_seat')}</Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setKind('wheelchair')}><Accessibility className="mr-1 h-4 w-4" />{k('kind_wheelchair')}</Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setKind('companion')}><Users className="mr-1 h-4 w-4" />{k('kind_companion')}</Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => patch((s) => ({ ...s, sellable: allBlocked }))}>
                {allBlocked ? <Check className="mr-1 h-4 w-4" /> : <Ban className="mr-1 h-4 w-4" />}{allBlocked ? k('unblock') : k('block')}
              </Button>
              <div className="flex items-center">
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={k('move_left')} onClick={() => nudge(-1, 0)}><ArrowLeft className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={k('move_up')} onClick={() => nudge(0, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={k('move_down')} onClick={() => nudge(0, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={k('move_right')} onClick={() => nudge(1, 0)}><ArrowRight className="h-4 w-4" /></Button>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={remove}><Trash2 className="mr-1 h-4 w-4" />{k('remove_seats')}</Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={k('clear_selection')} onClick={() => setSelected(new Set())}><X className="h-4 w-4" /></Button>
            </>
          )}
        </div>

        <div className="overflow-auto rounded-md border bg-muted/30 p-4">
          {draft.seats.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{k('canvas_empty')}</p>
          ) : (
            <div
              ref={wrapRef}
              className="relative mx-auto touch-none select-none"
              style={{ width, height: height + STAGE }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
            >
              <div
                className="absolute left-1/2 top-0 flex h-9 -translate-x-1/2 items-center justify-center rounded-b-2xl bg-foreground/85 text-xs font-semibold tracking-[0.2em] text-background"
                style={{ width: Math.max(160, width * 0.6) }}
              >
                {draft.venue.stage_label || 'PODIUM'}
              </div>
              <div className="absolute left-0" style={{ top: STAGE, width, height }}>
                {rowLabels.map((r) => (
                  <span key={`${r.label}-${r.y}-${r.minX}`}>
                    <span className="pointer-events-none absolute flex items-center justify-center text-[10px] font-semibold text-muted-foreground"
                      style={{ left: (r.minX - ox - 1) * CELL, top: (r.y - oy) * CELL, width: CELL, height: CELL }}>{r.label}</span>
                    <span className="pointer-events-none absolute flex items-center justify-center text-[10px] font-semibold text-muted-foreground"
                      style={{ left: (r.maxX - ox + 1) * CELL, top: (r.y - oy) * CELL, width: CELL, height: CELL }}>{r.label}</span>
                  </span>
                ))}
                {draft.seats.map((s) => {
                  const color = s.price_class_id ? colorOf.get(s.price_class_id) ?? '#94A3B8' : '#94A3B8';
                  const isSel = selected.has(s.id);
                  return (
                    <button
                      key={s.id} type="button" data-seat
                      title={`${seatLabel(s)}${s.sellable ? '' : ` · ${k('blocked')}`}`}
                      aria-label={seatLabel(s)} aria-pressed={isSel}
                      onClick={(e) => toggle(s.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                      className={cn(
                        'absolute flex items-center justify-center rounded-t-md rounded-b-sm text-[9px] font-semibold leading-none text-white transition-shadow',
                        isSel && 'ring-2 ring-offset-1 ring-foreground',
                        !s.sellable && 'opacity-35',
                      )}
                      style={{
                        left: (s.x - ox) * CELL + 2, top: (s.y - oy) * CELL + 2, width: CELL - 4, height: CELL - 4,
                        background: s.sellable ? color : `repeating-linear-gradient(45deg, ${color}, ${color} 3px, #fff 3px, #fff 5px)`,
                      }}
                    >
                      {s.kind === 'wheelchair' ? <Accessibility className="h-3.5 w-3.5" /> : s.kind === 'companion' ? <Users className="h-3 w-3" /> : s.seat_number}
                    </button>
                  );
                })}
                {rect && (
                  <div className="pointer-events-none absolute border border-primary bg-primary/10"
                    style={{ left: Math.min(rect.x0, rect.x1), top: Math.min(rect.y0, rect.y1), width: Math.abs(rect.x1 - rect.x0), height: Math.abs(rect.y1 - rect.y0) }} />
                )}
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{k('canvas_help')}</p>
      </CardContent>
    </Card>
  );
}

function PriceClassesCard({ draft, update, k }: { draft: VenueData; update: Update; k: K }) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of draft.seats) if (s.price_class_id && s.sellable) m[s.price_class_id] = (m[s.price_class_id] ?? 0) + 1;
    return m;
  }, [draft.seats]);
  const unassigned = draft.seats.filter((s) => !s.price_class_id && s.sellable).length;

  const add = () => update((d) => ({
    ...d,
    classes: [...d.classes, {
      id: newId(), name: k('class_n', { n: d.classes.length + 1 }),
      color: CLASS_COLORS[d.classes.length % CLASS_COLORS.length], default_price: 0, sort_order: d.classes.length,
    }],
  }));
  const set = (id: string, patch: Partial<VenueData['classes'][number]>) =>
    update((d) => ({ ...d, classes: d.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const remove = (id: string) => update((d) => ({
    ...d,
    classes: d.classes.filter((c) => c.id !== id),
    seats: d.seats.map((s) => (s.price_class_id === id ? { ...s, price_class_id: null } : s)),
  }));
  const nextColor = (c: string) => CLASS_COLORS[(CLASS_COLORS.indexOf(c) + 1) % CLASS_COLORS.length];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{k('price_classes')}</CardTitle>
        <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-4 w-4" />{k('add_class')}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.classes.map((c) => (
          <div key={c.id} className="space-y-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <button
                type="button" aria-label={k('change_color')} title={k('change_color')}
                className="h-6 w-6 shrink-0 rounded-full border" style={{ background: c.color }}
                onClick={() => set(c.id, { color: nextColor(c.color) })}
              />
              <Input className="h-8" value={c.name} onChange={(e) => set(c.id, { name: e.target.value })} />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={k('remove_class')} onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor={`p-${c.id}`} className="text-xs text-muted-foreground">{k('default_price')}</Label>
                <PriceInput id={`p-${c.id}`} value={c.default_price} onChange={(n) => set(c.id, { default_price: n })} />
              </div>
              <span className="pb-2 text-xs text-muted-foreground">{k('seat_count', { count: counts[c.id] ?? 0 })}</span>
            </div>
          </div>
        ))}
        {unassigned > 0 && <p className="text-xs text-amber-600">{k('unassigned', { count: unassigned })}</p>}
        <p className="text-xs text-muted-foreground">{k('classes_help')}</p>
      </CardContent>
    </Card>
  );
}

function PriceInput({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { if (Number(text.replace(',', '.')) !== value) setText(String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Input
      id={id} className="h-8" inputMode="decimal" value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value.replace(',', '.'));
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= 0) onChange(Math.round(n * 100) / 100);
      }}
    />
  );
}
