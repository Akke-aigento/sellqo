import { useState } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CalendarIcon, Plus, Pencil, Trash2, Loader2, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useEventDetails, useCreateEventDate, useUpdateEventDate, useDeleteEventDate,
  type EventDetail, type EventStatus,
} from '@/hooks/useEventDetails';

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'scheduled', label: 'Gepland' },
  { value: 'confirmed', label: 'Bevestigd' },
  { value: 'cancelled', label: 'Geannuleerd' },
  { value: 'completed', label: 'Afgerond' },
];

const statusLabel = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'confirmed') return 'default';
  if (status === 'cancelled') return 'destructive';
  if (status === 'completed') return 'secondary';
  return 'outline';
};

interface FormState {
  event_date: Date | undefined;
  start_time: string;
  capacity: string;
  min_attendees: string;
  status: EventStatus;
  meeting_point: string;
  location_name: string;
}

const emptyForm = (): FormState => ({
  event_date: undefined,
  start_time: '21:00',
  capacity: '',
  min_attendees: '0',
  status: 'scheduled',
  meeting_point: '',
  location_name: '',
});

export function ProductEventDatesTab({ productId }: { productId: string }) {
  const { data: dates = [], isLoading } = useEventDetails(productId);
  const createDate = useCreateEventDate(productId);
  const updateDate = useUpdateEventDate(productId);
  const deleteDate = useDeleteEventDate(productId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<EventDetail | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: EventDetail) => {
    setEditing(row);
    setForm({
      event_date: row.event_date ? new Date(`${row.event_date}T00:00:00`) : undefined,
      start_time: (row.start_time || '21:00').slice(0, 5),
      capacity: String(row.capacity ?? ''),
      min_attendees: String(row.min_attendees ?? 0),
      status: (STATUS_OPTIONS.find((s) => s.value === row.status)?.value ?? 'scheduled') as EventStatus,
      meeting_point: row.meeting_point || '',
      location_name: row.location_name || '',
    });
    setDialogOpen(true);
  };

  const canSave = !!form.event_date && form.capacity !== '' && Number(form.capacity) > 0;

  const handleSubmit = async () => {
    if (!form.event_date) return;
    const payload = {
      event_date: format(form.event_date, 'yyyy-MM-dd'),
      start_time: form.start_time || '21:00',
      capacity: Number(form.capacity),
      min_attendees: Number(form.min_attendees || 0),
      status: form.status,
      meeting_point: form.meeting_point.trim() || null,
      location_name: form.location_name.trim() || null,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {dates.length === 0 ? 'Nog geen datums gepland.' : `${dates.length} datum(s) gepland.`}
        </p>
        <Button type="button" onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Datum toevoegen
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {dates.map((row) => (
            <div key={row.id} className="rounded-lg border p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {format(new Date(`${row.event_date}T00:00:00`), 'EEE d MMM yyyy', { locale: nl })}
                    </span>
                    <span className="text-sm text-muted-foreground">{(row.start_time || '').slice(0, 5)}</span>
                    <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Capaciteit {row.capacity} · min. {row.min_attendees}
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
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                    <Pencil className="h-4 w-4" />
                    <span className="ml-2 sm:hidden">Bewerken</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(row)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="ml-2 sm:hidden">Verwijderen</span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
