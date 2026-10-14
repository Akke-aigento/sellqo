// ZAAL-2 — kaart "Zaalplan" op de eventpagina. Zonder zaal: een zaal kiezen en per
// prijsklasse een tickettype (bestaand of nieuw). Met zaal: de stand van de stoelen.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Armchair, Loader2, Pencil, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { bounds } from '@/lib/seatLayout';
import { useVenueData, useVenues } from '@/hooks/useVenues';
import {
  effectiveSeatStatus, seatingErrorCode, useEventSeating, useLinkVenue, useSeatTickets, useSetSeatsBlocked, useUnlinkVenue, type EventSeat,
} from '@/hooks/useEventSeating';
import { cn } from '@/lib/utils';
import { useSaveTicketType } from '@/hooks/useEventWorkspace';

const NEW = '__new__';
const SKIP = '__skip__';

interface TypeOption { product_id: string; name: string; price: number | null }

export function EventSeatingCard({
  eventId, mainProductId, ticketTypes, sold,
}: { eventId: string; mainProductId: string | null; ticketTypes: TypeOption[]; sold: number }) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.seating.${x}`, o);
  const { data: seating, isLoading } = useEventSeating(eventId);
  const { data: venues = [], isLoading: venuesLoading } = useVenues();
  const unlink = useUnlinkVenue(eventId);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  if (isLoading || venuesLoading || !seating) return null;

  const linked = seating.seats.length > 0;
  // Winkels zonder zalen (pubcrawls, festivals zonder zitplaatsen) zien deze kaart niet.
  if (!linked && venues.length === 0) return null;

  const doUnlink = async () => {
    try {
      await unlink.mutateAsync();
      toast.success(k('unlinked'));
    } catch (e) {
      toast.error(k(`err_${seatingErrorCode(e)}`));
    }
    setConfirmUnlink(false);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Armchair className="h-4 w-4" /> {k('title')}
          {linked && seating.venueName && <span className="font-normal text-muted-foreground">· {seating.venueName}</span>}
        </CardTitle>
        {linked && (
          <div className="flex gap-2">
            {seating.venueId && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/admin/events/venues/${seating.venueId}`}><Pencil className="mr-1 h-4 w-4" />{k('edit_venue')}</Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setConfirmUnlink(true)}><Unlink className="mr-1 h-4 w-4" />{k('unlink')}</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {linked
          ? <SeatOverview eventId={eventId} seats={seating.seats} ticketTypes={ticketTypes} k={k} />
          : <LinkVenueForm eventId={eventId} mainProductId={mainProductId} ticketTypes={ticketTypes} sold={sold} k={k} />}
      </CardContent>

      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{k('unlink_title')}</AlertDialogTitle>
            <AlertDialogDescription>{k('unlink_body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doUnlink()}>{k('unlink')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

type K = (x: string, o?: Record<string, unknown>) => string;

function LinkVenueForm({
  eventId, mainProductId, ticketTypes, sold, k,
}: { eventId: string; mainProductId: string | null; ticketTypes: TypeOption[]; sold: number; k: K }) {
  const { data: venues = [] } = useVenues();
  const [venueId, setVenueId] = useState<string>('');
  const { data: venue } = useVenueData(venueId || undefined);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const saveType = useSaveTicketType(eventId, mainProductId);
  const link = useLinkVenue(eventId);
  const [busy, setBusy] = useState(false);

  const classes = useMemo(() => {
    if (!venue) return [];
    return venue.classes.map((c) => ({ ...c, seats: venue.seats.filter((s) => s.price_class_id === c.id && s.sellable).length }))
      .filter((c) => c.seats > 0);
  }, [venue]);
  const choice = (classId: string) => mapping[classId] ?? NEW;

  if (sold > 0) return <p className="text-sm text-muted-foreground">{k('err_date_has_tickets')}</p>;

  const submit = async () => {
    if (!venue) return;
    setBusy(true);
    try {
      const map: Record<string, string> = {};
      for (const c of classes) {
        const v = choice(c.id);
        if (v === SKIP) continue;
        if (v === NEW) {
          const pid = await saveType.mutateAsync({
            existing: null, name: c.name, price: c.default_price, sub_capacity: null, sales_start: null, sales_end: null,
            reentry_policy: 'none', is_active: true, early_bird_price: null, apply_to_other_dates: false,
          });
          if (!pid) throw new Error('type_failed');
          map[c.id] = pid;
        } else {
          map[c.id] = v;
        }
      }
      const res = await link.mutateAsync({ venueId: venue.venue.id, mapping: map });
      toast.success(k('linked', { count: res?.seats ?? 0 }));
    } catch (e) {
      toast.error(k(`err_${seatingErrorCode(e)}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{k('intro')}</p>
      <div className="space-y-1">
        <Label>{k('venue')}</Label>
        <Select value={venueId} onValueChange={(v) => { setVenueId(v); setMapping({}); }}>
          <SelectTrigger className="max-w-sm"><SelectValue placeholder={k('choose_venue')} /></SelectTrigger>
          <SelectContent>
            {venues.map((v) => <SelectItem key={v.id} value={v.id} disabled={v.seats === 0}>{v.name} · {k('seat_count', { count: v.seats })}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {venue && (
        <>
          {classes.length === 0 ? (
            <p className="text-sm text-amber-600">{k('no_classes')}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">{k('mapping_title')}</p>
              {classes.map((c) => (
                <div key={c.id} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="shrink-0 text-muted-foreground">{k('seat_count', { count: c.seats })}</span>
                  </div>
                  <Select value={choice(c.id)} onValueChange={(v) => setMapping((m) => ({ ...m, [c.id]: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW}>{k('new_type', { name: c.name, price: c.default_price.toFixed(2) })}</SelectItem>
                      {ticketTypes.map((tt) => (
                        <SelectItem key={tt.product_id} value={tt.product_id}>
                          {tt.name}{tt.price != null ? ` · €${Number(tt.price).toFixed(2)}` : ''}
                        </SelectItem>
                      ))}
                      <SelectItem value={SKIP}>{k('not_for_sale')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{k('link_note')}</p>
          <Button onClick={() => void submit()} disabled={busy || classes.length === 0 || classes.every((c) => choice(c.id) === SKIP)}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{k('link')}
          </Button>
        </>
      )}
    </div>
  );
}

const CELL = 14;

function SeatOverview({ eventId, seats, ticketTypes, k }: { eventId: string; seats: EventSeat[]; ticketTypes: TypeOption[]; k: K }) {
  const nowMs = Date.now();
  const withStatus = seats.map((s) => ({ ...s, eff: effectiveSeatStatus(s, nowMs) }));
  const count = (st: EventSeat['status']) => withStatus.filter((s) => s.eff === st).length;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [infoId, setInfoId] = useState<string | null>(null);
  const block = useSetSeatsBlocked(eventId);
  const { data: tickets } = useSeatTickets(eventId, count('sold') > 0);

  const b = bounds(seats) ?? { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const w = (b.maxX - b.minX + 1) * CELL;
  const h = (b.maxY - b.minY + 1) * CELL;
  const perType = ticketTypes
    .map((tt) => {
      const mine = withStatus.filter((s) => s.product_id === tt.product_id);
      return { ...tt, total: mine.filter((s) => s.eff !== 'blocked').length, sold: mine.filter((s) => s.eff === 'sold').length, color: mine[0]?.color };
    })
    .filter((x) => x.total > 0);

  const sel = withStatus.filter((s) => selected.has(s.id));
  const canBlock = sel.some((s) => s.eff === 'available');
  const canUnblock = sel.some((s) => s.eff === 'blocked' && s.product_id);
  const info = infoId ? withStatus.find((s) => s.id === infoId) ?? null : null;
  const infoTicket = info?.ticket_instance_id ? tickets?.get(info.ticket_instance_id) : undefined;

  const click = (s: (typeof withStatus)[number]) => {
    if (s.eff === 'sold' || s.eff === 'held') { setInfoId(s.id); return; }
    setInfoId(null);
    setSelected((cur) => { const n = new Set(cur); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; });
  };
  const apply = async (blocked: boolean) => {
    try {
      const r = await block.mutateAsync({ seatIds: [...selected], blocked });
      toast.success(k(blocked ? 'blocked_done' : 'unblocked_done', { count: r?.changed ?? 0 }));
      setSelected(new Set());
    } catch (e) {
      toast.error(k(`err_${seatingErrorCode(e)}`));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['available', 'held', 'sold', 'blocked'] as const).map((st) => (
          <div key={st} className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">{k(`status_${st}`)}</p>
            <p className="text-lg font-bold">{count(st)}</p>
          </div>
        ))}
      </div>
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {selected.size === 0 ? (
          <p className="text-xs text-muted-foreground">{k('overview_hint')}</p>
        ) : (
          <>
            <span className="text-sm font-medium">{k('selected', { count: selected.size })}</span>
            <Button size="sm" variant="outline" className="h-8" disabled={!canBlock || block.isPending} onClick={() => void apply(true)}>{k('block')}</Button>
            <Button size="sm" variant="outline" className="h-8" disabled={!canUnblock || block.isPending} onClick={() => void apply(false)}>{k('unblock')}</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>{k('clear')}</Button>
          </>
        )}
      </div>
      <div className="overflow-auto rounded-md border bg-muted/30 p-3">
        <div className="relative mx-auto" style={{ width: w, height: h }}>
          {withStatus.map((s) => {
            const label = `${s.section_name} · ${s.row_label} ${s.seat_number}`;
            return (
              <button
                key={s.id} type="button" title={`${label} · ${k(`status_${s.eff}`)}`} aria-label={`${label} · ${k(`status_${s.eff}`)}`}
                aria-pressed={selected.has(s.id)} onClick={() => click(s)}
                className={cn('absolute rounded-[3px]', (selected.has(s.id) || infoId === s.id) && 'ring-2 ring-primary ring-offset-1')}
                style={{
                  left: (s.x - b.minX) * CELL + 1, top: (s.y - b.minY) * CELL + 1, width: CELL - 2, height: CELL - 2,
                  background: s.eff === 'sold' ? '#94A3B8' : s.eff === 'held' ? '#F59E0B' : s.eff === 'blocked' ? 'repeating-linear-gradient(45deg, #CBD5E1, #CBD5E1 2px, transparent 2px, transparent 4px)' : s.color,
                }}
              />
            );
          })}
        </div>
      </div>
      {info && (
        <div className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
          <div>
            <p className="font-semibold">{info.section_name} · {k('row')} {info.row_label} · {k('seat')} {info.seat_number}</p>
            <p className="text-muted-foreground">
              {info.eff === 'held'
                ? k('held_info')
                : [infoTicket?.attendee_name, infoTicket?.order_number, infoTicket ? k(`ticket_${infoTicket.status}`) : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setInfoId(null)}>{k('clear')}</Button>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {perType.map((tt) => (
          <span key={tt.product_id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: tt.color }} />
            {tt.name}: {k('sold_of', { sold: tt.sold, total: tt.total })}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />{k('status_held')}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />{k('status_sold')}</span>
      </div>
    </div>
  );
}
