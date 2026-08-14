// TICKET-1 fase 5 — check-in PWA (QR-scannen aan de deur).
//
// MIDDERNACHT-PRINCIPE: de host kiest BEWUST een event_detail. Er wordt nergens
// "vandaag" afgeleid — events lopen over middernacht (crawl 21:00 → 03:00).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, Camera, CameraOff, Check, AlertTriangle, X, RotateCcw, CalendarDays, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth, type AppRole } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type CheckinResult = 'ok' | 'already' | 'invalid' | 'wrong_event' | 'undone' | 'not_checked_in';

interface CheckinResponse {
  success: boolean;
  error?: string;
  result?: CheckinResult;
  reason?: string;
  attendee?: string | null;
  seq?: number | null;
  checked_in_at?: string | null;
  expected_event?: { date: string | null; start_time: string | null; name: string | null };
}

interface EventOption {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  location_name: string | null;
  product_name: string;
}

interface ScanEntry {
  id: string;
  token: string;
  result: CheckinResult;
  attendee: string | null;
  seq: number | null;
  at: string;
  undone?: boolean;
}

const SCANNER_ID = 'ticket-checkin-scanner';

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
const fmtTime = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '');
const fmtStamp = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';

export default function TicketCheckin() {
  const { currentTenant } = useTenant();
  const { roles, isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<CheckinResponse | null>(null);
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [undoTarget, setUndoTarget] = useState<ScanEntry | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);

  // host = tenant_admin voor deze tenant OF platform_admin. staff = crew.
  const isHost = useMemo(() => {
    if (isPlatformAdmin) return true;
    return (roles ?? []).some(
      (r) => (r.role as AppRole) === 'tenant_admin' && (!r.tenant_id || r.tenant_id === currentTenant?.id),
    );
  }, [roles, isPlatformAdmin, currentTenant?.id]);

  // Lopende/eerstvolgende events — bewuste keuze door de host, geen auto-selectie.
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['checkin-events', currentTenant?.id],
    queryFn: async (): Promise<EventOption[]> => {
      if (!currentTenant) return [];
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('event_details')
        .select('id, event_date, start_time, end_time, status, location_name, products(name)')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['scheduled', 'confirmed'])
        .gte('event_date', since)
        .order('event_date', { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((e) => ({
        id: e.id as string,
        event_date: e.event_date as string,
        start_time: e.start_time as string,
        end_time: (e.end_time as string | null) ?? null,
        status: e.status as string,
        location_name: (e.location_name as string | null) ?? null,
        product_name: ((e as { products?: { name?: string } }).products?.name) ?? 'Event',
      }));
    },
    enabled: !!currentTenant,
  });

  // Live teller voor het gekozen event.
  const { data: counts } = useQuery({
    queryKey: ['checkin-counts', selectedEvent?.id],
    queryFn: async () => {
      if (!selectedEvent || !currentTenant) return { checked: 0, total: 0 };
      const base = supabase
        .from('ticket_instances')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', selectedEvent.id);
      const [{ count: total }, { count: checked }] = await Promise.all([
        base.in('status', ['valid', 'checked_in']),
        supabase
          .from('ticket_instances')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .eq('event_detail_id', selectedEvent.id)
          .eq('status', 'checked_in'),
      ]);
      return { checked: checked ?? 0, total: total ?? 0 };
    },
    enabled: !!selectedEvent && !!currentTenant,
    refetchInterval: 15000,
  });

  const stopScanner = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (s) {
      try { await s.stop(); } catch { /* al gestopt */ }
      try { s.clear(); } catch { /* noop */ }
    }
  };

  useEffect(() => () => { void stopScanner(); }, []);

  const callCheckin = async (token: string, action: 'checkin' | 'undo'): Promise<CheckinResponse> => {
    const { data, error } = await supabase.functions.invoke('ticket-checkin', {
      body: { qr_token: token, event_detail_id: selectedEvent?.id, action },
    });
    if (error) throw error;
    return data as CheckinResponse;
  };

  const handleToken = async (token: string) => {
    if (busyRef.current || !selectedEvent) return;
    // Debounce: dezelfde QR blijft in beeld bij een continue scan.
    const last = lastTokenRef.current;
    if (last && last.token === token && Date.now() - last.at < 3000) return;
    lastTokenRef.current = { token, at: Date.now() };
    busyRef.current = true;
    try {
      const res = await callCheckin(token, 'checkin');
      setFeedback(res);
      if (res.result) {
        setScans((prev) => [
          {
            id: `${token}-${Date.now()}`, token, result: res.result!,
            attendee: res.attendee ?? null, seq: res.seq ?? null,
            at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 25));
      }
      if (res.result === 'ok') {
        void queryClient.invalidateQueries({ queryKey: ['checkin-counts', selectedEvent.id] });
      }
      if (!res.success) toast.error(res.error ?? 'Check-in mislukt');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Check-in mislukt: ${msg}`);
    } finally {
      setTimeout(() => { busyRef.current = false; }, 600);
    }
  };

  const startScanner = async () => {
    if (!selectedEvent || scannerRef.current) return;
    setFeedback(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => { void handleToken(decoded.trim()); },
        () => { /* per-frame misses negeren */ },
      );
    } catch (e) {
      scannerRef.current = null;
      setScanning(false);
      toast.error(`Camera niet beschikbaar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const confirmUndo = async () => {
    const target = undoTarget;
    setUndoTarget(null);
    if (!target) return;
    try {
      const res = await callCheckin(target.token, 'undo');
      if (res.result === 'undone') {
        toast.success(`Check-in teruggedraaid${res.attendee ? ` — ${res.attendee}` : ''}`);
        setScans((prev) => prev.map((s) => (s.id === target.id ? { ...s, undone: true } : s)));
        void queryClient.invalidateQueries({ queryKey: ['checkin-counts', selectedEvent?.id] });
      } else if (res.result === 'not_checked_in') {
        toast.info('Dit ticket stond niet op ingecheckt.');
      } else {
        toast.error(res.error ?? 'Terugdraaien mislukt');
      }
    } catch (e) {
      toast.error(`Terugdraaien mislukt: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // --- Event-keuze ---
  if (!selectedEvent) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl font-semibold">Ticket check-in</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Kies bewust het event dat je aan de deur scant. Events die over middernacht lopen
          blijven op hun eigen datum staan — er wordt niets automatisch gekozen.
        </p>
        {eventsLoading && <p className="text-sm text-muted-foreground">Events laden…</p>}
        {!eventsLoading && events.length === 0 && (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">
            Geen geplande of bevestigde events gevonden.
          </CardContent></Card>
        )}
        <div className="space-y-2">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedEvent(e)}
              className="w-full text-left rounded-lg border bg-card p-4 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmtDate(e.event_date)} · {fmtTime(e.start_time)}
                    {e.end_time ? `–${fmtTime(e.end_time)}` : ''}
                  </p>
                  {e.location_name && (
                    <p className="text-xs text-muted-foreground truncate">{e.location_name}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">{e.status}</Badge>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const pct = counts && counts.total > 0 ? Math.round((counts.checked / counts.total) * 100) : 0;

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">
      {/* Gekozen event, altijd zichtbaar bovenaan */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{selectedEvent.product_name}</CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                {fmtDate(selectedEvent.event_date)} · {fmtTime(selectedEvent.start_time)}
                {selectedEvent.end_time ? `–${fmtTime(selectedEvent.end_time)}` : ''}
              </p>
            </div>
            <Button
              variant="outline" size="sm" className="shrink-0"
              onClick={async () => { await stopScanner(); setSelectedEvent(null); setFeedback(null); setScans([]); }}
            >
              Wissel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" /> Ingecheckt
            </span>
            <span className="font-semibold tabular-nums">
              {counts?.checked ?? 0} / {counts?.total ?? 0}
            </span>
          </div>
          <Progress value={pct} />
          <p className="text-xs text-muted-foreground">
            {isHost ? 'Host — je kunt check-ins terugdraaien.' : 'Crew — scannen en inchecken.'}
          </p>
        </CardContent>
      </Card>

      {/* Feedback-vlak: groot, leesbaar in het donker */}
      {feedback?.result && (
        <div
          className={
            'rounded-xl p-5 text-center border-2 ' +
            (feedback.result === 'ok'
              ? 'bg-green-600 border-green-700 text-white'
              : feedback.result === 'already'
              ? 'bg-orange-500 border-orange-600 text-white'
              : feedback.result === 'wrong_event'
              ? 'bg-yellow-400 border-yellow-500 text-black'
              : 'bg-destructive border-destructive text-destructive-foreground')
          }
        >
          <div className="flex justify-center mb-2">
            {feedback.result === 'ok' ? <Check className="h-10 w-10" />
              : feedback.result === 'invalid' ? <X className="h-10 w-10" />
              : <AlertTriangle className="h-10 w-10" />}
          </div>
          {feedback.result === 'ok' && (
            <p className="text-2xl font-bold break-words">Welkom{feedback.attendee ? `, ${feedback.attendee}` : ''}</p>
          )}
          {feedback.result === 'already' && (
            <>
              <p className="text-2xl font-bold">Al ingecheckt</p>
              <p className="text-sm mt-1">
                om {fmtStamp(feedback.checked_in_at)}{feedback.attendee ? ` — ${feedback.attendee}` : ''}
              </p>
            </>
          )}
          {feedback.result === 'invalid' && (
            <>
              <p className="text-2xl font-bold">Ongeldig ticket</p>
              {feedback.reason && <p className="text-sm mt-1">{feedback.reason}</p>}
            </>
          )}
          {feedback.result === 'wrong_event' && (
            <>
              <p className="text-2xl font-bold">Ander event</p>
              <p className="text-sm mt-1">
                Dit ticket is voor{' '}
                {feedback.expected_event?.date ? fmtDate(feedback.expected_event.date) : 'een andere datum'}
                {feedback.expected_event?.start_time ? ` · ${fmtTime(feedback.expected_event.start_time)}` : ''}
              </p>
            </>
          )}
        </div>
      )}

      {/* Scanner */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div id={SCANNER_ID} className="w-full overflow-hidden rounded-lg bg-muted min-h-[120px]" />
          {scanning ? (
            <Button variant="outline" className="w-full h-12" onClick={() => void stopScanner()}>
              <CameraOff className="h-5 w-5 mr-2" /> Scanner stoppen
            </Button>
          ) : (
            <Button className="w-full h-12" onClick={() => void startScanner()}>
              <Camera className="h-5 w-5 mr-2" /> Scanner starten
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recente scans */}
      {scans.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent gescand</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {scans.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {s.attendee || (s.seq ? `Ticket #${s.seq}` : 'Onbekend ticket')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtStamp(s.at)} · {s.undone ? 'teruggedraaid' : s.result}
                    </p>
                  </div>
                  {isHost && s.result === 'ok' && !s.undone && (
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setUndoTarget(s)}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Terugdraaien
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!undoTarget} onOpenChange={(o) => !o && setUndoTarget(null)}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Check-in terugdraaien?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoTarget?.attendee
                ? `${undoTarget.attendee} wordt weer als niet-ingecheckt gemarkeerd.`
                : 'Dit ticket wordt weer als niet-ingecheckt gemarkeerd.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmUndo()}>Terugdraaien</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
