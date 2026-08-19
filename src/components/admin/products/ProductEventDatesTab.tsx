import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addWeeks, getDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  CalendarIcon, Plus, Pencil, Trash2, Loader2, MapPin, Users,
  CalendarClock, SkipForward, RotateCcw, CalendarPlus, Merge, X, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { zonedToUtc, utcToZonedParts } from '@/lib/eventTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useEventDetails, useCreateEventDate, useUpdateEventDate, useDeleteEventDate,
  useBulkCreateEventDates, useEventSignupCounts,
  type EventDetail, type EventStatus,
} from '@/hooks/useEventDetails';

/** Handmatig kiesbare statussen. skipped/merged worden enkel via acties gezet. */
const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'scheduled', label: 'Gepland' },
  { value: 'confirmed', label: 'Bevestigd' },
  { value: 'cancelled', label: 'Geannuleerd' },
  { value: 'completed', label: 'Afgerond' },
];

const ALL_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Gepland',
  confirmed: 'Bevestigd',
  cancelled: 'Geannuleerd',
  completed: 'Afgerond',
  skipped: 'Overgeslagen',
  merged: 'Samengevoegd',
};

const statusLabel = (status: string) => ALL_STATUS_LABELS[status] ?? status;

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'confirmed') return 'default';
  if (status === 'cancelled') return 'destructive';
  if (status === 'completed') return 'secondary';
  if (status === 'skipped') return 'secondary';
  if (status === 'merged') return 'outline';
  return 'outline';
};

const WEEKDAYS = [
  { value: '1', label: 'Maandag' },
  { value: '2', label: 'Dinsdag' },
  { value: '3', label: 'Woensdag' },
  { value: '4', label: 'Donderdag' },
  { value: '5', label: 'Vrijdag' },
  { value: '6', label: 'Zaterdag' },
  { value: '0', label: 'Zondag' },
];

const MERGEABLE = new Set(['scheduled', 'confirmed', 'skipped']);
const COMMS_NOTE = 'Kopers worden pas in een latere fase automatisch verwittigd.';

const toDate = (iso: string) => new Date(`${iso}T00:00:00`);
const fmtDate = (iso: string) => format(toDate(iso), 'EEE d MMM yyyy', { locale: nl });

/** Inschrijvingsteller: balk + tekst. Puur presentatie. */
function SignupMeter({ signed, capacity, minAttendees }: { signed: number; capacity: number; minAttendees: number }) {
  const cap = Math.max(1, capacity || 0);
  const pct = Math.min(100, (signed / cap) * 100);
  const minPct = minAttendees > 0 ? Math.min(100, (minAttendees / cap) * 100) : null;
  const isFull = capacity > 0 && signed >= capacity;
  const minReached = minAttendees <= 0 || signed >= minAttendees;

  const barColor = isFull ? 'bg-destructive' : minReached ? 'bg-emerald-500' : 'bg-amber-500';

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
        <span>
          {signed} / {capacity} ingeschreven
        </span>
        {minAttendees > 0 && (
          minReached ? (
            <span className="text-emerald-600 dark:text-emerald-400">· min. {minAttendees} gehaald</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-500">· nog {minAttendees - signed} tot minimum</span>
          )
        )}
        {isFull && <span className="text-destructive">· uitverkocht</span>}
      </div>
      <div className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
        {minPct !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/40"
            style={{ left: `${minPct}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

/** Icoon-actieknop met desktop-tooltip. */
function ActionTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface FormState {
  event_date: Date | undefined;
  start_time: string;
  capacity: string;
  min_attendees: string;
  status: EventStatus;
  meeting_point: string;
  location_name: string;
  early_bird_price: string;
  early_bird_deadline_date: Date | undefined;
  early_bird_deadline_time: string;
  early_bird_quantity: string;
}

const emptyForm = (): FormState => ({
  event_date: undefined,
  start_time: '21:00',
  capacity: '',
  min_attendees: '0',
  status: 'scheduled',
  meeting_point: '',
  location_name: '',
  early_bird_price: '',
  early_bird_deadline_date: undefined,
  early_bird_deadline_time: '23:59',
  early_bird_quantity: '',
});

const DEFAULT_EVENT_TZ = 'Europe/Brussels';

export function ProductEventDatesTab({ productId, regularPrice = 0 }: { productId: string; regularPrice?: number }) {
  const { data: dates = [], isLoading } = useEventDetails(productId);
  const navigate = useNavigate();
  const createDate = useCreateEventDate(productId);
  const updateDate = useUpdateEventDate(productId);
  const deleteDate = useDeleteEventDate(productId);
  const bulkCreate = useBulkCreateEventDates(productId);
  const eventIds = useMemo(() => dates.map((d) => d.id), [dates]);
  const { data: signupCounts = {} } = useEventSignupCounts(productId, eventIds);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formTz, setFormTz] = useState<string>(DEFAULT_EVENT_TZ);
  const [deleteTarget, setDeleteTarget] = useState<EventDetail | null>(null);

  // Verplaatsen
  const [moveTarget, setMoveTarget] = useState<EventDetail | null>(null);
  const [moveDate, setMoveDate] = useState<Date | undefined>(undefined);

  // Bulk plannen
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStart, setBulkStart] = useState<Date | undefined>(undefined);
  const [bulkWeeks, setBulkWeeks] = useState('6');
  const [bulkWeekday, setBulkWeekday] = useState<string>('6');
  const [bulkTime, setBulkTime] = useState('21:00');
  const [bulkCapacity, setBulkCapacity] = useState('');
  const [bulkMin, setBulkMin] = useState('0');
  const [bulkUnchecked, setBulkUnchecked] = useState<Set<string>>(new Set());

  // Merge
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeWinner, setMergeWinner] = useState<string>('');

  const existingDates = useMemo(() => new Set(dates.map((d) => d.event_date)), [dates]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormTz(DEFAULT_EVENT_TZ);
    setDialogOpen(true);
  };

  const openEdit = (row: EventDetail) => {
    setEditing(row);
    const tz = row.timezone || DEFAULT_EVENT_TZ;
    setFormTz(tz);
    const parts = utcToZonedParts(row.early_bird_deadline, tz);
    setForm({
      event_date: row.event_date ? toDate(row.event_date) : undefined,
      start_time: (row.start_time || '21:00').slice(0, 5),
      capacity: String(row.capacity ?? ''),
      min_attendees: String(row.min_attendees ?? 0),
      status: (STATUS_OPTIONS.find((s) => s.value === row.status)?.value ?? 'scheduled') as EventStatus,
      meeting_point: row.meeting_point || '',
      location_name: row.location_name || '',
      early_bird_price: row.early_bird_price === null || row.early_bird_price === undefined ? '' : String(row.early_bird_price),
      early_bird_deadline_date: parts ? toDate(parts.dateStr) : undefined,
      early_bird_deadline_time: parts ? parts.timeStr : '23:59',
      early_bird_quantity:
        row.early_bird_quantity === null || row.early_bird_quantity === undefined ? '' : String(row.early_bird_quantity),
    });
    setDialogOpen(true);
  };

  // ---- Early-bird validatie (inline, geen zod) ----------------------------
  const ebPriceNum = form.early_bird_price.trim() === '' ? null : Number(form.early_bird_price);
  const ebQtyNum = form.early_bird_quantity.trim() === '' ? null : Number(form.early_bird_quantity);
  const ebDeadlineMs = form.early_bird_deadline_date
    ? zonedToUtc(
        format(form.early_bird_deadline_date, 'yyyy-MM-dd'),
        form.early_bird_deadline_time || '23:59',
        formTz,
      )
    : null;

  const ebPriceError =
    ebPriceNum !== null && (!Number.isFinite(ebPriceNum) || ebPriceNum < 0)
      ? 'Early-bird prijs moet 0 of hoger zijn.'
      : null;
  const ebQtyError =
    ebQtyNum !== null && (!Number.isFinite(ebQtyNum) || ebQtyNum <= 0)
      ? 'Aantal moet groter zijn dan 0.'
      : null;
  const ebDeadlineError =
    ebDeadlineMs !== null && ebDeadlineMs <= Date.now() ? 'Deadline moet in de toekomst liggen.' : null;
  const ebPriceWarning =
    ebPriceNum !== null && !ebPriceError && regularPrice > 0 && ebPriceNum >= regularPrice
      ? 'Early-bird prijs is niet lager dan de reguliere prijs.'
      : null;

  const canSave =
    !!form.event_date &&
    form.capacity !== '' &&
    Number(form.capacity) > 0 &&
    !ebPriceError &&
    !ebQtyError &&
    !ebDeadlineError;

  const handleSubmit = async () => {
    if (!form.event_date) return;
    // Early-bird: expliciet null sturen zodat de tenant het kan uitzetten.
    const hasEb = ebPriceNum !== null;
    const payload = {
      event_date: format(form.event_date, 'yyyy-MM-dd'),
      start_time: form.start_time || '21:00',
      capacity: Number(form.capacity),
      min_attendees: Number(form.min_attendees || 0),
      status: form.status,
      meeting_point: form.meeting_point.trim() || null,
      location_name: form.location_name.trim() || null,
      early_bird_price: hasEb ? ebPriceNum : null,
      early_bird_deadline: hasEb && ebDeadlineMs !== null ? new Date(ebDeadlineMs).toISOString() : null,
      early_bird_quantity: hasEb && ebQtyNum !== null ? ebQtyNum : null,
    };
    if (editing) {
      await updateDate.mutateAsync({ id: editing.id, data: payload });
    } else {
      await createDate.mutateAsync(payload);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const saving = createDate.isPending || updateDate.isPending;

  // ---- Bulk plannen -------------------------------------------------------
  const openBulk = () => {
    setBulkStart(undefined);
    setBulkWeeks('6');
    setBulkWeekday('6');
    setBulkTime('21:00');
    setBulkCapacity('');
    setBulkMin('0');
    setBulkUnchecked(new Set());
    setBulkOpen(true);
  };

  const bulkPreview = useMemo(() => {
    if (!bulkStart) return { rows: [] as string[], skipped: 0 };
    const weeks = Math.max(1, Math.min(52, Number(bulkWeeks) || 0));
    const targetDow = Number(bulkWeekday);
    // eerste voorkomen van de gekozen weekdag vanaf startdatum (inclusief)
    let first = new Date(bulkStart);
    const diff = (targetDow - getDay(first) + 7) % 7;
    first = new Date(first.getFullYear(), first.getMonth(), first.getDate() + diff);

    const rows: string[] = [];
    let skipped = 0;
    for (let i = 0; i < weeks; i++) {
      const iso = format(addWeeks(first, i), 'yyyy-MM-dd');
      if (existingDates.has(iso)) {
        skipped++;
        continue;
      }
      rows.push(iso);
    }
    return { rows, skipped };
  }, [bulkStart, bulkWeeks, bulkWeekday, existingDates]);

  const bulkChecked = bulkPreview.rows.filter((iso) => !bulkUnchecked.has(iso));
  const canBulk = bulkChecked.length > 0 && bulkCapacity !== '' && Number(bulkCapacity) > 0;

  const handleBulkCreate = async () => {
    if (!canBulk) return;
    await bulkCreate.mutateAsync(
      bulkChecked.map((iso) => ({
        event_date: iso,
        start_time: bulkTime || '21:00',
        capacity: Number(bulkCapacity),
        min_attendees: Number(bulkMin || 0),
        status: 'scheduled' as EventStatus,
      })),
    );
    setBulkOpen(false);
  };

  // ---- Verplaatsen --------------------------------------------------------
  const openMove = (row: EventDetail) => {
    setMoveTarget(row);
    setMoveDate(toDate(row.event_date));
  };

  const handleMove = async () => {
    if (!moveTarget || !moveDate) return;
    await updateDate.mutateAsync({
      id: moveTarget.id,
      data: { event_date: format(moveDate, 'yyyy-MM-dd') },
    });
    setMoveTarget(null);
  };

  // ---- Overslaan / terugzetten -------------------------------------------
  const handleSkip = (row: EventDetail) =>
    updateDate.mutate({ id: row.id, data: { status: 'skipped' } });

  const handleUnskip = (row: EventDetail) =>
    updateDate.mutate({ id: row.id, data: { status: 'scheduled' } });

  // ---- Mergen -------------------------------------------------------------
  const toggleMergeMode = () => {
    setMergeSelected(new Set());
    setMergeMode((m) => !m);
  };

  const toggleMergeSelect = (id: string) => {
    setMergeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mergeCandidates = dates.filter((d) => mergeSelected.has(d.id));

  const openMergeDialog = () => {
    setMergeWinner(mergeCandidates[0]?.id ?? '');
    setMergeDialogOpen(true);
  };

  const handleMerge = async () => {
    if (!mergeWinner) return;
    const losers = mergeCandidates.filter((d) => d.id !== mergeWinner);
    for (const loser of losers) {
      try {
        await updateDate.mutateAsync({
          id: loser.id,
          data: { status: 'merged', merged_into_event_id: mergeWinner },
        });
      } catch {
        // per-rij fout wordt al getoast; overige rijen blijven doorgaan
      }
    }
    setMergeDialogOpen(false);
    setMergeMode(false);
    setMergeSelected(new Set());
  };

  const dateById = (id: string | null) => dates.find((d) => d.id === id) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {dates.length === 0 ? 'Nog geen datums gepland.' : `${dates.length} datum(s) gepland.`}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={toggleMergeMode} className="w-full sm:w-auto">
            {mergeMode ? <X className="mr-2 h-4 w-4" /> : <Merge className="mr-2 h-4 w-4" />}
            {mergeMode ? 'Samenvoegen annuleren' : 'Datums samenvoegen'}
          </Button>
          <Button type="button" variant="outline" onClick={openBulk} className="w-full sm:w-auto">
            <CalendarPlus className="mr-2 h-4 w-4" />
            Plan meerdere datums
          </Button>
          <Button type="button" onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Datum toevoegen
          </Button>
        </div>
      </div>

      {mergeMode && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Selecteer 2 of meer datums om samen te voegen. {mergeSelected.size} geselecteerd.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={openMergeDialog}
            disabled={mergeCandidates.length < 2}
            className="w-full sm:w-auto"
          >
            <Merge className="mr-2 h-4 w-4" />
            Samenvoegen
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <TooltipProvider delayDuration={200}>
        <div className="space-y-3">
          {dates.map((row) => {
            const isSkipped = row.status === 'skipped';
            const isMerged = row.status === 'merged';
            const dimmed = isSkipped || isMerged;
            const canSkip = row.status === 'scheduled' || row.status === 'confirmed';
            const selectable = MERGEABLE.has(row.status);
            const winner = isMerged ? dateById(row.merged_into_event_id) : null;

            return (
              <div key={row.id} className={cn('rounded-lg border p-3', dimmed && 'opacity-60')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    {mergeMode && (
                      <Checkbox
                        className="mt-1 shrink-0"
                        checked={mergeSelected.has(row.id)}
                        disabled={!selectable}
                        onCheckedChange={() => toggleMergeSelect(row.id)}
                        aria-label="Selecteer datum om samen te voegen"
                      />
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('font-medium', dimmed && 'line-through')}>
                          {fmtDate(row.event_date)}
                        </span>
                        <span className="text-sm text-muted-foreground">{(row.start_time || '').slice(0, 5)}</span>
                        <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                        {isMerged && winner && (
                          <span className="text-xs text-muted-foreground">→ {fmtDate(winner.event_date)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Capaciteit {row.capacity == null ? '\u221E' : row.capacity} · min. {row.min_attendees}
                        </span>
                        {(row.location_name || row.meeting_point) && (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {[row.location_name, row.meeting_point].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        )}
                      </div>
                      {!dimmed && (
                        <SignupMeter
                          signed={signupCounts[row.id] ?? 0}
                          capacity={row.capacity ?? 0}
                          minAttendees={row.min_attendees ?? 0}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <ActionTooltip label="Verplaatsen naar andere dag">
                      <Button type="button" variant="outline" size="sm" onClick={() => openMove(row)}>
                        <CalendarClock className="h-4 w-4" />
                        <span className="ml-2 sm:hidden">Verplaatsen</span>
                      </Button>
                    </ActionTooltip>
                    {canSkip && (
                      <ActionTooltip label="Overslaan">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleSkip(row)}>
                          <SkipForward className="h-4 w-4" />
                          <span className="ml-2 sm:hidden">Overslaan</span>
                        </Button>
                      </ActionTooltip>
                    )}
                    {isSkipped && (
                      <ActionTooltip label="Terugzetten">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleUnskip(row)}>
                          <RotateCcw className="h-4 w-4" />
                          <span className="ml-2 sm:hidden">Terugzetten</span>
                        </Button>
                      </ActionTooltip>
                    )}
                    <ActionTooltip label="Bewerken op de event-pagina">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/events/${row.id}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="ml-2 sm:hidden">Bewerken op de event-pagina</span>
                      </Button>
                    </ActionTooltip>
                    <ActionTooltip label="Vroegboekkorting">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                        <span className="ml-2 sm:hidden">Vroegboekkorting</span>
                      </Button>
                    </ActionTooltip>
                    <ActionTooltip label="Verwijderen">
                      <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(row)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="ml-2 sm:hidden">Verwijderen</span>
                      </Button>
                    </ActionTooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </TooltipProvider>
      )}

      {/* Toevoegen / bewerken */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Datum bewerken' : 'Datum toevoegen'}</DialogTitle>
            <DialogDescription>Stel datum, tijd en capaciteit in voor dit evenement.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Datum *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !form.event_date && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.event_date ? format(form.event_date, 'd MMM yyyy', { locale: nl }) : 'Kies een datum'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.event_date}
                      onSelect={(d) => setForm((f) => ({ ...f, event_date: d }))}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Starttijd</Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Capaciteit *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum deelnemers</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.min_attendees}
                  onChange={(e) => setForm((f) => ({ ...f, min_attendees: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as EventStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Locatie (optioneel)</Label>
              <Input
                value={form.location_name}
                onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))}
                placeholder="Bijv. Stadspark"
              />
            </div>

            <div className="space-y-2">
              <Label>Verzamelpunt (optioneel)</Label>
              <Input
                value={form.meeting_point}
                onChange={(e) => setForm((f) => ({ ...f, meeting_point: e.target.value }))}
                placeholder="Bijv. hoofdingang aan de fontein"
              />
            </div>

            {/* EARLY-BIRD fase D — vroegboekkorting per event */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <Label className="text-sm font-medium">Vroegboekkorting (optioneel)</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Laat de prijs leeg voor geen vroegboekkorting. Deadline en aantal zijn beide optioneel:
                  leeg betekent geen grens.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Early-bird prijs</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.early_bird_price}
                  onChange={(e) => setForm((f) => ({ ...f, early_bird_price: e.target.value }))}
                  placeholder="Bijv. 12.00"
                />
                {ebPriceError && <p className="text-xs text-destructive">{ebPriceError}</p>}
                {ebPriceWarning && <p className="text-xs text-amber-600 dark:text-amber-500">{ebPriceWarning}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Deadline datum (Europe/Brussels)</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            'min-w-0 flex-1 justify-start text-left font-normal',
                            !form.early_bird_deadline_date && 'text-muted-foreground',
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {form.early_bird_deadline_date
                              ? format(form.early_bird_deadline_date, 'd MMM yyyy', { locale: nl })
                              : 'Geen deadline'}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.early_bird_deadline_date}
                          onSelect={(d) => setForm((f) => ({ ...f, early_bird_deadline_date: d }))}
                          initialFocus
                          className={cn('p-3 pointer-events-auto')}
                        />
                      </PopoverContent>
                    </Popover>
                    {form.early_bird_deadline_date && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        aria-label="Deadline wissen"
                        onClick={() => setForm((f) => ({ ...f, early_bird_deadline_date: undefined }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {ebDeadlineError && <p className="text-xs text-destructive">{ebDeadlineError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Deadline tijd (Europe/Brussels)</Label>
                  <Input
                    type="time"
                    value={form.early_bird_deadline_time}
                    onChange={(e) => setForm((f) => ({ ...f, early_bird_deadline_time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max. tickets aan early-bird prijs</Label>
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={form.early_bird_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, early_bird_quantity: e.target.value }))}
                  placeholder="Leeg = geen grens"
                />
                {ebQtyError && <p className="text-xs text-destructive">{ebQtyError}</p>}
              </div>

              {ebPriceNum !== null && (ebDeadlineMs !== null || ebQtyNum !== null) && (
                <p className="text-xs text-muted-foreground">
                  De vroegste grens wint: zodra de deadline of het aantal bereikt is, geldt de reguliere prijs.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
              Annuleren
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSave || saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Opslaan' : 'Toevoegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk plannen */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plan meerdere datums</DialogTitle>
            <DialogDescription>
              Genereer wekelijkse datums en vink uit wat niet past.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Startdatum *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !bulkStart && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {bulkStart ? format(bulkStart, 'd MMM yyyy', { locale: nl }) : 'Kies een datum'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={bulkStart}
                      onSelect={(d) => {
                        setBulkStart(d);
                        setBulkUnchecked(new Set());
                        if (d) setBulkWeekday(String(getDay(d)));
                      }}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Aantal weken</Label>
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={bulkWeeks}
                  onChange={(e) => setBulkWeeks(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Weekdag</Label>
                <Select value={bulkWeekday} onValueChange={(v) => { setBulkWeekday(v); setBulkUnchecked(new Set()); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>Elke {d.label.toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Starttijd</Label>
                <Input type="time" value={bulkTime} onChange={(e) => setBulkTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Capaciteit *</Label>
                <Input
                  type="number"
                  min={1}
                  value={bulkCapacity}
                  onChange={(e) => setBulkCapacity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum deelnemers</Label>
                <Input type="number" min={0} value={bulkMin} onChange={(e) => setBulkMin(e.target.value)} />
              </div>
            </div>

            {bulkStart && (
              <div className="space-y-2">
                <Label>Voorbeeld ({bulkChecked.length} van {bulkPreview.rows.length} aangevinkt)</Label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {bulkPreview.rows.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">Geen nieuwe datums om aan te maken.</p>
                  ) : (
                    bulkPreview.rows.map((iso) => (
                      <label key={iso} className="flex items-center gap-2 rounded p-1 text-sm hover:bg-muted/50">
                        <Checkbox
                          checked={!bulkUnchecked.has(iso)}
                          onCheckedChange={() =>
                            setBulkUnchecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(iso)) next.delete(iso);
                              else next.add(iso);
                              return next;
                            })
                          }
                        />
                        <span className="truncate">{fmtDate(iso)}</span>
                      </label>
                    ))
                  )}
                </div>
                {bulkPreview.skipped > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {bulkPreview.skipped} datum(s) bestonden al en zijn overgeslagen.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setBulkOpen(false)} className="w-full sm:w-auto">
              Annuleren
            </Button>
            <Button
              type="button"
              onClick={handleBulkCreate}
              disabled={!canBulk || bulkCreate.isPending}
              className="w-full sm:w-auto"
            >
              {bulkCreate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aanmaken ({bulkChecked.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verplaatsen */}
      <Dialog open={!!moveTarget} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Datum verplaatsen</DialogTitle>
            <DialogDescription>
              Kies de nieuwe dag voor deze datum. {COMMS_NOTE}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Nieuwe datum</Label>
            <Calendar
              mode="single"
              selected={moveDate}
              onSelect={setMoveDate}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setMoveTarget(null)} className="w-full sm:w-auto">
              Annuleren
            </Button>
            <Button
              type="button"
              onClick={handleMove}
              disabled={!moveDate || updateDate.isPending}
              className="w-full sm:w-auto"
            >
              {updateDate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verplaatsen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mergen */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Datums samenvoegen</DialogTitle>
            <DialogDescription>
              Kies welke datum blijft doorgaan. De overige datums worden gemarkeerd als samengevoegd. {COMMS_NOTE}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={mergeWinner} onValueChange={setMergeWinner} className="space-y-2">
            {mergeCandidates.map((d) => (
              <label key={d.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <RadioGroupItem value={d.id} />
                <span className="truncate">
                  {fmtDate(d.event_date)} · {(d.start_time || '').slice(0, 5)}
                </span>
              </label>
            ))}
          </RadioGroup>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setMergeDialogOpen(false)} className="w-full sm:w-auto">
              Annuleren
            </Button>
            <Button
              type="button"
              onClick={handleMerge}
              disabled={!mergeWinner || updateDate.isPending}
              className="w-full sm:w-auto"
            >
              {updateDate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Samenvoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Datum verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze datum wordt definitief verwijderd. Dit kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteTarget) await deleteDate.mutateAsync(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
