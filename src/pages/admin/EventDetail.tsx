// EVENT-DETAIL (fase 4a/4b) — event-pagina met tabs.
//
// Extractie van de voormalige in-page detailview van EventDashboard.tsx naar een
// eigen route (/admin/events/:eventId). Overzicht/Deelnemers/Scan-log zijn read-only;
// de Tickettypes-tab (4b) schrijft op event_ticket_types — de tabel waar de betaalflow
// live tegen valideert. Data via directe client-queries met expliciete tenant-scope;
// RLS dwingt isolatie af op DB-niveau.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Users, Ticket, MapPin, CalendarDays, ScanLine, LogIn, LogOut,
  Plus, Pencil, Trash2, Power, PowerOff, Tags, KeyRound, QrCode, Ban, Settings2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TicketTypeDialog, type TicketTypeEditable } from '@/components/admin/events/TicketTypeDialog';
import {
  useTicketProducts, useCreateTicketType, useUpdateTicketType,
  useToggleTicketTypeActive, useDeleteTicketType, isDuplicateProductError,
  type ReentryPolicy, type TicketTypeFormData,
} from '@/hooks/useEventTicketTypes';
import {
  useScannerAccesses, useCreateScannerAccess, useRevokeScannerAccess,
  useDeleteScannerAccess, useEnsureDefaultZone, isExpired,
  type ScannerAccessFormData, type ScannerAccessRow,
} from '@/hooks/useEventScannerAccess';
import { ScannerAccessDialog } from '@/components/admin/events/ScannerAccessDialog';
import { ScannerQrDialog } from '@/components/admin/events/ScannerQrDialog';
import { EventCoreSettingsCard } from '@/components/admin/events/EventCoreSettingsCard';

interface EventRow {
  id: string;
  product_id: string | null;
  event_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  location_name: string | null;
  meeting_point: string | null;
  capacity: number | null;
  min_attendees: number;
  product_name: string;
}

interface Attendee {
  id: string;
  seq: number | null;
  attendee_name: string | null;
  status: string;
  checked_in_at: string | null;
  product_id: string | null;
  order_number: string | null;
  customer_email: string | null;
}

interface TicketTypeRow {
  id: string;
  product_id: string;
  name: string;
  price: number | null;
  sub_capacity: number | null;
  is_active: boolean;
  sales_start: string | null;
  sales_end: string | null;
  sort_order: number;
  reentry_policy: ReentryPolicy;
}

interface ScanRow {
  id: string;
  ticket_instance_id: string;
  direction: string;
  result: string;
  scanned_at: string;
  zone_id: string | null;
  scanner_access_id: string | null;
  note: string | null;
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
const fmtTime = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '');
const fmtStamp = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtFull = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('nl-NL', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—';

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [liveScan, setLiveScan] = useState(false);

  // --- Tickettype-beheer (4b) ---
  const [ttDialogOpen, setTtDialogOpen] = useState(false);
  const [ttEditing, setTtEditing] = useState<TicketTypeEditable | null>(null);
  const [ttDeleteTarget, setTtDeleteTarget] = useState<TicketTypeRow | null>(null);
  const { data: ticketProducts = [] } = useTicketProducts();
  const createTicketType = useCreateTicketType(eventId);
  const updateTicketType = useUpdateTicketType(eventId);
  const toggleTicketType = useToggleTicketTypeActive(eventId);
  const deleteTicketType = useDeleteTicketType(eventId);

  // --- Deur-toegangen (4c) ---
  const [saDialogOpen, setSaDialogOpen] = useState(false);
  const [saQrTarget, setSaQrTarget] = useState<ScannerAccessRow | null>(null);
  const [saRevokeTarget, setSaRevokeTarget] = useState<ScannerAccessRow | null>(null);
  const [saDeleteTarget, setSaDeleteTarget] = useState<ScannerAccessRow | null>(null);
  const { data: accesses = [] } = useScannerAccesses(eventId);
  const createAccess = useCreateScannerAccess(eventId);
  const revokeAccess = useRevokeScannerAccess(eventId);
  const deleteAccess = useDeleteScannerAccess(eventId);
  const ensureZone = useEnsureDefaultZone(eventId);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event-detail', currentTenant?.id, eventId],
    queryFn: async (): Promise<EventRow | null> => {
      if (!currentTenant || !eventId) return null;
      const { data, error } = await supabase
        .from('event_details')
        .select('id, product_id, event_date, start_time, end_time, status, location_name, meeting_point, capacity, min_attendees, products(name)')
        .eq('id', eventId)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id as string,
        product_id: (data.product_id as string | null) ?? null,
        event_date: data.event_date as string,
        start_time: data.start_time as string,
        end_time: (data.end_time as string | null) ?? null,
        status: data.status as string,
        location_name: (data.location_name as string | null) ?? null,
        meeting_point: (data.meeting_point as string | null) ?? null,
        capacity: (data.capacity as number | null) ?? null,
        min_attendees: (data.min_attendees as number) ?? 0,
        product_name: ((data as { products?: { name?: string } }).products?.name) ?? 'Event',
      };
    },
    enabled: !!currentTenant && !!eventId,
  });

  const { data: attendees = [], isLoading: attendeesLoading } = useQuery({
    queryKey: ['event-detail-attendees', currentTenant?.id, eventId],
    queryFn: async (): Promise<Attendee[]> => {
      if (!currentTenant || !eventId) return [];
      const { data, error } = await supabase
        .from('ticket_instances')
        .select('id, seq, attendee_name, status, checked_in_at, product_id, orders(order_number, customer_email)')
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', eventId)
        .order('seq', { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const order = (row as { orders?: { order_number?: string | null; customer_email?: string | null } }).orders;
        return {
          id: row.id as string,
          seq: (row.seq as number | null) ?? null,
          attendee_name: (row.attendee_name as string | null) ?? null,
          status: row.status as string,
          checked_in_at: (row.checked_in_at as string | null) ?? null,
          product_id: (row.product_id as string | null) ?? null,
          order_number: order?.order_number ?? null,
          customer_email: order?.customer_email ?? null,
        };
      });
    },
    enabled: !!currentTenant && !!eventId,
    refetchInterval: 30000,
  });

  const { data: ticketTypes = [] } = useQuery({
    queryKey: ['event-detail-ticket-types', currentTenant?.id, eventId],
    queryFn: async (): Promise<TicketTypeRow[]> => {
      if (!currentTenant || !eventId) return [];
      const { data, error } = await supabase
        .from('event_ticket_types')
        .select('id, product_id, sub_capacity, is_active, sales_start, sales_end, sort_order, reentry_policy, products!event_ticket_types_product_id_fkey(name, price)')
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', eventId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const p = (row as { products?: { name?: string | null; price?: number | null } }).products;
        return {
          id: row.id as string,
          product_id: row.product_id as string,
          name: p?.name ?? '—',
          price: p?.price ?? null,
          sub_capacity: (row.sub_capacity as number | null) ?? null,
          is_active: Boolean(row.is_active),
          sales_start: (row.sales_start as string | null) ?? null,
          sales_end: (row.sales_end as string | null) ?? null,
          sort_order: (row.sort_order as number) ?? 0,
          reentry_policy: ((row.reentry_policy as ReentryPolicy | null) ?? 'none'),
        };
      });
    },
    enabled: !!currentTenant && !!eventId,
  });

  const { data: scans = [] } = useQuery({
    queryKey: ['event-detail-scans', currentTenant?.id, eventId],
    queryFn: async (): Promise<ScanRow[]> => {
      if (!currentTenant || !eventId) return [];
      const { data, error } = await supabase
        .from('ticket_scans')
        .select('id, ticket_instance_id, direction, result, scanned_at, zone_id, scanner_access_id, note')
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', eventId)
        .order('scanned_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ScanRow[];
    },
    enabled: !!currentTenant && !!eventId,
    refetchInterval: 30000,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['event-detail-zones', currentTenant?.id, eventId],
    queryFn: async () => {
      if (!currentTenant || !eventId) return [];
      const { data, error } = await supabase
        .from('event_zones')
        .select('id, name')
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', eventId);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!currentTenant && !!eventId,
  });

  const { data: scanners = [] } = useQuery({
    queryKey: ['event-detail-scanners', currentTenant?.id, eventId],
    queryFn: async () => {
      if (!currentTenant || !eventId) return [];
      const { data, error } = await supabase
        .from('event_scanner_access')
        .select('id, name')
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', eventId);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!currentTenant && !!eventId,
  });

  const zoneName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const z of zones) m[z.id] = z.name;
    return m;
  }, [zones]);

  const scannerName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of scanners) m[s.id] = s.name;
    return m;
  }, [scanners]);

  // Laatste scan per ticket → presence-status (binnen/buiten/niet gescand).
  const lastScan = useMemo(() => {
    const m: Record<string, ScanRow> = {};
    // `scans` is nieuwste-eerst; eerste hit per ticket is dus de laatste scan.
    for (const s of scans) {
      if (!m[s.ticket_instance_id]) m[s.ticket_instance_id] = s;
    }
    return m;
  }, [scans]);

  const attendeeName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of attendees) {
      m[a.id] = a.attendee_name || a.customer_email || `#${a.seq ?? '—'}`;
    }
    return m;
  }, [attendees]);

  const productName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const tt of ticketTypes) m[tt.product_id] = tt.name;
    return m;
  }, [ticketTypes]);

  const sold = attendees.filter((a) => a.status === 'valid' || a.status === 'checked_in').length;
  const inside = attendees.filter((a) => {
    const s = lastScan[a.id];
    return s ? s.direction === 'in' : false;
  }).length;
  const capacity = event?.capacity ?? null;
  const unlimitedLabel = '\u221E';
  const capacityLabel = capacity == null ? unlimitedLabel : String(capacity);
  const freeLabel = capacity == null ? unlimitedLabel : String(Math.max(0, capacity - sold));
  const pct = capacity && capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;

  // Live bezetting (4d): elke nieuwe scan invalideert de tellers van deze pagina.
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`event-scans-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_scans',
          filter: `event_detail_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['event-detail-scans', currentTenant?.id, eventId] });
          queryClient.invalidateQueries({ queryKey: ['event-detail-attendees', currentTenant?.id, eventId] });
        },
      )
      .subscribe((status) => setLiveScan(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, currentTenant?.id, queryClient]);

  const soldPerProduct = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of attendees) {
      if (a.status !== 'valid' && a.status !== 'checked_in') continue;
      if (!a.product_id) continue;
      m[a.product_id] = (m[a.product_id] ?? 0) + 1;
    }
    return m;
  }, [attendees]);

  const isOnSale = (tt: TicketTypeRow) => {
    const now = Date.now();
    if (!tt.is_active) return false;
    if (tt.sales_start && now < new Date(tt.sales_start).getTime()) return false;
    if (tt.sales_end && now > new Date(tt.sales_end).getTime()) return false;
    return true;
  };

  const presenceBadge = (ticketId: string) => {
    const s = lastScan[ticketId];
    if (!s) return <Badge variant="secondary">{t('events.presence.never')}</Badge>;
    if (s.direction === 'in') {
      return <Badge variant="default">{t('events.presence.inside')} · {fmtStamp(s.scanned_at)}</Badge>;
    }
    return <Badge variant="outline">{t('events.presence.outside')} · {fmtStamp(s.scanned_at)}</Badge>;
  };

  // ---- Tickettype-acties (4b) ----
  const usedProductIds = ticketTypes.map((tt) => tt.product_id);
  const capacitySum = ticketTypes.reduce((acc, tt) => acc + (tt.sub_capacity ?? 0), 0);
  const capacityOverflow = capacity != null && capacity > 0 && capacitySum > capacity;

  const handleTicketTypeSubmit = async (form: TicketTypeFormData) => {
    try {
      if (ttEditing) {
        await updateTicketType.mutateAsync({ id: ttEditing.id, form });
      } else {
        await createTicketType.mutateAsync(form);
      }
      toast({ title: t('events.ticketTypes.toast.saved') });
      setTtDialogOpen(false);
      setTtEditing(null);
    } catch (error) {
      toast({
        title: isDuplicateProductError(error)
          ? t('events.ticketTypes.toast.duplicate')
          : t('events.ticketTypes.toast.error'),
        description: isDuplicateProductError(error) ? undefined : (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (tt: TicketTypeRow) => {
    const typeSold = soldPerProduct[tt.product_id] ?? 0;
    if (tt.is_active && typeSold > 0) {
      const ok = window.confirm(t('events.ticketTypes.guards.deactivateWithSales', { sold: typeSold }));
      if (!ok) return;
    }
    try {
      await toggleTicketType.mutateAsync({ id: tt.id, is_active: !tt.is_active });
      toast({ title: t('events.ticketTypes.toast.saved') });
    } catch (error) {
      toast({
        title: t('events.ticketTypes.toast.error'),
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!ttDeleteTarget) return;
    try {
      await deleteTicketType.mutateAsync(ttDeleteTarget.id);
      toast({ title: t('events.ticketTypes.toast.deleted') });
    } catch (error) {
      toast({
        title: t('events.ticketTypes.toast.error'),
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setTtDeleteTarget(null);
    }
  };

  const openNewTicketType = () => { setTtEditing(null); setTtDialogOpen(true); };
  const openEditTicketType = (tt: TicketTypeRow) => {
    setTtEditing({
      id: tt.id,
      product_id: tt.product_id,
      sub_capacity: tt.sub_capacity,
      sales_start: tt.sales_start,
      sales_end: tt.sales_end,
      sort_order: tt.sort_order,
      is_active: tt.is_active,
      reentry_policy: tt.reentry_policy,
    });
    setTtDialogOpen(true);
  };

  // ---- Toegang-acties (4c) ----
  const scopeLabel = (row: ScannerAccessRow): string => {
    const ids = row.allowed_product_ids;
    if (!ids || ids.length === 0) return t('events.access.allTypes');
    return ids.map((id) => productName[id] ?? id.slice(0, 8)).join(', ');
  };

  const accessStatus = (row: ScannerAccessRow) => {
    if (!row.is_active) return { key: 'revoked', variant: 'outline' as const };
    if (isExpired(row)) return { key: 'expired', variant: 'secondary' as const };
    return { key: 'active', variant: 'default' as const };
  };

  const handleCreateAccess = async (form: ScannerAccessFormData) => {
    try {
      const zoneId =
        form.zone_id ?? (await ensureZone.mutateAsync(t('events.access.defaultZoneName')));
      const row = await createAccess.mutateAsync({ ...form, zone_id: zoneId });
      setSaDialogOpen(false);
      setSaQrTarget(row);
      toast({ title: t('events.access.toast.created') });
    } catch (error) {
      toast({
        title: t('events.access.toast.error'),
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleRevokeAccess = async () => {
    if (!saRevokeTarget) return;
    try {
      await revokeAccess.mutateAsync(saRevokeTarget.id);
      toast({ title: t('events.access.toast.revoked') });
    } catch (error) {
      toast({
        title: t('events.access.toast.error'),
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSaRevokeTarget(null);
    }
  };

  const handleDeleteAccess = async () => {
    if (!saDeleteTarget) return;
    try {
      await deleteAccess.mutateAsync(saDeleteTarget.id);
      toast({ title: t('events.access.toast.deleted') });
    } catch (error) {
      toast({
        title: t('events.access.toast.error'),
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSaDeleteTarget(null);
    }
  };

  if (eventLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/events')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('events.back')}
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('events.notFound')}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/events')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> {t('events.back')}
      </Button>

      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold break-words">{event.product_name}</h1>
        <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {fmtDate(event.event_date)} · {fmtTime(event.start_time)}
            {event.end_time ? `–${fmtTime(event.end_time)}` : ''}
          </span>
          {(event.location_name || event.meeting_point) && (
            <span className="flex items-center gap-1 break-words">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {event.location_name || event.meeting_point}
            </span>
          )}
          <Badge variant="secondary">{t(`events.status.${event.status}`, event.status)}</Badge>
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-2">
            <Ticket className="h-4 w-4" /> {t('events.tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="ticket_types" className="gap-2">
            <Tags className="h-4 w-4" /> {t('events.tabs.ticketTypes')}
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <KeyRound className="h-4 w-4" /> {t('events.tabs.access')}
          </TabsTrigger>
          <TabsTrigger value="attendees" className="gap-2">
            <Users className="h-4 w-4" /> {t('events.tabs.attendees')}
          </TabsTrigger>
          <TabsTrigger value="scans" className="gap-2">
            <ScanLine className="h-4 w-4" /> {t('events.tabs.scanLog')}
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Overzicht ---------------- */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{t('events.stats.capacity')}</p>
              <p className="text-xl font-bold">{capacity}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{t('events.stats.sold')}</p>
              <p className="text-xl font-bold">{sold}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{t('events.stats.inside')}</p>
              <p className="text-xl font-bold">{inside}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{t('events.stats.free')}</p>
              <p className="text-xl font-bold">{free}</p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('events.stats.occupancy')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground tabular-nums">
                {sold} / {capacity} ({pct}%)
                {event.min_attendees > 0
                  ? ` · ${t('events.stats.minimum')}: ${event.min_attendees}`
                  : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-4 w-4" /> {t('events.ticketTypes.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticketTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('events.ticketTypes.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {ticketTypes.map((tt) => {
                    const typeSold = soldPerProduct[tt.product_id] ?? 0;
                    return (
                      <div key={tt.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="break-words">{tt.name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {typeSold}{tt.sub_capacity != null ? ` / ${tt.sub_capacity}` : ''}
                        </span>
                      </div>
                    );
                  })}
                  <Button variant="outline" size="sm" className="mt-2" onClick={openNewTicketType}>
                    <Tags className="h-4 w-4 mr-1" /> {t('events.ticketTypes.manage')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Tickettypes (4b, bewerkbaar) ---------------- */}
        <TabsContent value="ticket_types" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Tags className="h-4 w-4" /> {t('events.ticketTypes.title')} ({ticketTypes.length})
              </CardTitle>
              <Button size="sm" onClick={openNewTicketType}>
                <Plus className="h-4 w-4 mr-1" /> {t('events.ticketTypes.add')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {capacityOverflow && (
                <p className="text-xs text-muted-foreground">
                  {t('events.ticketTypes.guards.capacityCeiling', { capacity })}
                </p>
              )}
              {ticketTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('events.ticketTypes.empty')}</p>
              ) : (
                <>
                  {/* Mobiel: kaarten */}
                  <div className="space-y-2 md:hidden">
                    {ticketTypes.map((tt) => {
                      const typeSold = soldPerProduct[tt.product_id] ?? 0;
                      return (
                        <div key={tt.id} className="rounded-lg border p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm break-words">{tt.name}</span>
                            {tt.is_active ? (
                              <Badge variant={isOnSale(tt) ? 'default' : 'secondary'}>
                                {isOnSale(tt) ? t('events.ticketTypes.onSale') : t('events.ticketTypes.notOnSale')}
                              </Badge>
                            ) : (
                              <Badge variant="outline">{t('events.ticketTypes.inactive')}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {tt.price != null ? `€ ${Number(tt.price).toFixed(2)}` : '—'}
                            {' · '}{t('events.ticketTypes.sold')}: {typeSold}
                            {tt.sub_capacity != null ? ` / ${tt.sub_capacity}` : ` / ${t('events.ticketTypes.form.unlimited')}`}
                            {tt.sub_capacity != null
                              ? ` · ${t('events.ticketTypes.spotsLeft')}: ${Math.max(0, tt.sub_capacity - typeSold)}`
                              : ''}
                          </p>
                          {(tt.sales_start || tt.sales_end) && (
                            <p className="text-xs text-muted-foreground">
                              {t('events.ticketTypes.salesWindow')}: {fmtFull(tt.sales_start)} → {fmtFull(tt.sales_end)}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditTicketType(tt)}>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> {t('events.ticketTypes.edit')}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleToggleActive(tt)}>
                              {tt.is_active
                                ? <><PowerOff className="h-3.5 w-3.5 mr-1" /> {t('events.ticketTypes.deactivate')}</>
                                : <><Power className="h-3.5 w-3.5 mr-1" /> {t('events.ticketTypes.activate')}</>}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setTtDeleteTarget(tt)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('events.ticketTypes.delete')}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop: tabel */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">#</th>
                          <th className="py-2 pr-3 font-medium">{t('events.ticketTypes.columns.name')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.ticketTypes.columns.price')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.ticketTypes.columns.capacity')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.ticketTypes.sold')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.ticketTypes.spotsLeft')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.ticketTypes.salesWindow')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.ticketTypes.columns.status')}</th>
                          <th className="py-2 font-medium text-right">{t('events.ticketTypes.columns.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ticketTypes.map((tt) => {
                          const typeSold = soldPerProduct[tt.product_id] ?? 0;
                          return (
                            <tr key={tt.id} className="border-b last:border-0">
                              <td className="py-2 pr-3 tabular-nums">{tt.sort_order}</td>
                              <td className="py-2 pr-3">{tt.name}</td>
                              <td className="py-2 pr-3 tabular-nums">
                                {tt.price != null ? `€ ${Number(tt.price).toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2 pr-3 tabular-nums">
                                {tt.sub_capacity ?? t('events.ticketTypes.form.unlimited')}
                              </td>
                              <td className="py-2 pr-3 tabular-nums">{typeSold}</td>
                              <td className="py-2 pr-3 tabular-nums">
                                {tt.sub_capacity != null ? Math.max(0, tt.sub_capacity - typeSold) : '—'}
                              </td>
                              <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                                {tt.sales_start || tt.sales_end
                                  ? `${fmtFull(tt.sales_start)} → ${fmtFull(tt.sales_end)}`
                                  : '—'}
                              </td>
                              <td className="py-2 pr-3">
                                {tt.is_active ? (
                                  <Badge variant={isOnSale(tt) ? 'default' : 'secondary'}>
                                    {isOnSale(tt) ? t('events.ticketTypes.onSale') : t('events.ticketTypes.notOnSale')}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">{t('events.ticketTypes.inactive')}</Badge>
                                )}
                              </td>
                              <td className="py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditTicketType(tt)}
                                    aria-label={t('events.ticketTypes.edit')}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleToggleActive(tt)}
                                    aria-label={tt.is_active
                                      ? t('events.ticketTypes.deactivate')
                                      : t('events.ticketTypes.activate')}
                                  >
                                    {tt.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive"
                                    onClick={() => setTtDeleteTarget(tt)}
                                    aria-label={t('events.ticketTypes.delete')}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Deur-toegangen (4c) ---------------- */}
        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> {t('events.access.title')} ({accesses.length})
              </CardTitle>
              <Button size="sm" onClick={() => setSaDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> {t('events.access.add')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{t('events.access.intro')}</p>
              {ticketTypes.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('events.access.noTypesHint')}</p>
              )}
              {accesses.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('events.access.empty')}</p>
              ) : (
                <>
                  {/* Mobiel: kaarten */}
                  <div className="space-y-2 md:hidden">
                    {accesses.map((a) => {
                      const st = accessStatus(a);
                      return (
                        <div key={a.id} className="rounded-lg border p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm break-words">{a.name}</span>
                            <Badge variant={st.variant}>{t(`events.access.status.${st.key}`)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground break-words">
                            {zoneName[a.zone_id] ?? '—'} · {t(`events.access.direction.${a.direction}`)} ·{' '}
                            {t(`events.access.scanMode.${a.scan_mode}`)}
                          </p>
                          <p className="text-xs text-muted-foreground break-words">{scopeLabel(a)}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.use_count > 0
                              ? t('events.access.usage', { count: a.use_count, at: fmtFull(a.last_used_at) })
                              : t('events.access.neverUsed')}
                            {a.expires_at ? ` · ${t('events.access.expiresOn')}: ${fmtFull(a.expires_at)}` : ''}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSaQrTarget(a)}>
                              <QrCode className="h-3.5 w-3.5 mr-1" /> {t('events.access.showQr')}
                            </Button>
                            {a.is_active && (
                              <Button variant="outline" size="sm" onClick={() => setSaRevokeTarget(a)}>
                                <Ban className="h-3.5 w-3.5 mr-1" /> {t('events.access.revoke')}
                              </Button>
                            )}
                            {a.use_count === 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => setSaDeleteTarget(a)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('events.access.delete')}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop: tabel */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">{t('events.access.columns.name')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.access.columns.zone')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.access.columns.direction')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.access.columns.scanMode')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.access.columns.scope')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.access.columns.usage')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.access.columns.expires')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.access.columns.status')}</th>
                          <th className="py-2 font-medium text-right">{t('events.access.columns.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accesses.map((a) => {
                          const st = accessStatus(a);
                          return (
                            <tr key={a.id} className="border-b last:border-0">
                              <td className="py-2 pr-3">{a.name}</td>
                              <td className="py-2 pr-3">{zoneName[a.zone_id] ?? '—'}</td>
                              <td className="py-2 pr-3">{t(`events.access.direction.${a.direction}`)}</td>
                              <td className="py-2 pr-3">{t(`events.access.scanMode.${a.scan_mode}`)}</td>
                              <td className="py-2 pr-3">{scopeLabel(a)}</td>
                              <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap tabular-nums">
                                {a.use_count > 0
                                  ? `${a.use_count}× · ${fmtFull(a.last_used_at)}`
                                  : t('events.access.neverUsed')}
                              </td>
                              <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                                {a.expires_at ? fmtFull(a.expires_at) : '—'}
                              </td>
                              <td className="py-2 pr-3">
                                <Badge variant={st.variant}>{t(`events.access.status.${st.key}`)}</Badge>
                              </td>
                              <td className="py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSaQrTarget(a)}
                                    aria-label={t('events.access.showQr')}
                                  >
                                    <QrCode className="h-4 w-4" />
                                  </Button>
                                  {a.is_active && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setSaRevokeTarget(a)}
                                      aria-label={t('events.access.revoke')}
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {a.use_count === 0 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive"
                                      onClick={() => setSaDeleteTarget(a)}
                                      aria-label={t('events.access.delete')}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Deelnemers ---------------- */}
        <TabsContent value="attendees">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> {t('events.tabs.attendees')} ({attendees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendeesLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : attendees.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('events.attendees.empty')}</p>
              ) : (
                <>
                  {/* Mobiel: kaarten */}
                  <div className="space-y-2 md:hidden">
                    {attendees.map((a) => (
                      <div key={a.id} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm break-words">
                            {a.attendee_name || a.customer_email || '—'}
                          </span>
                          {presenceBadge(a.id)}
                        </div>
                        <p className="text-xs text-muted-foreground break-all">
                          {a.order_number ?? '—'}{a.customer_email ? ` · ${a.customer_email}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          #{a.seq ?? '—'}
                          {a.product_id && productName[a.product_id] ? ` · ${productName[a.product_id]}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: tabel */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">#</th>
                          <th className="py-2 pr-3 font-medium">{t('events.attendees.name')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.attendees.email')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.attendees.ticketType')}</th>
                          <th className="py-2 pr-3 font-medium">{t('events.attendees.order')}</th>
                          <th className="py-2 font-medium">{t('events.attendees.presence')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendees.map((a) => (
                          <tr key={a.id} className="border-b last:border-0">
                            <td className="py-2 pr-3 tabular-nums">{a.seq ?? '—'}</td>
                            <td className="py-2 pr-3">{a.attendee_name || '—'}</td>
                            <td className="py-2 pr-3 break-all text-muted-foreground">{a.customer_email ?? '—'}</td>
                            <td className="py-2 pr-3">
                              {a.product_id && productName[a.product_id] ? productName[a.product_id] : '—'}
                            </td>
                            <td className="py-2 pr-3">{a.order_number ?? '—'}</td>
                            <td className="py-2">{presenceBadge(a.id)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Scan-log ---------------- */}
        <TabsContent value="scans">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ScanLine className="h-4 w-4" /> {t('events.tabs.scanLog')} ({scans.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scans.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('events.scanLog.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {scans.map((s) => (
                    <div key={s.id} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm break-words">
                          {attendeeName[s.ticket_instance_id] ?? s.ticket_instance_id.slice(0, 8)}
                        </span>
                        <Badge variant={s.direction === 'in' ? 'default' : 'outline'} className="gap-1">
                          {s.direction === 'in'
                            ? <><LogIn className="h-3 w-3" /> {t('events.scanLog.in')}</>
                            : <><LogOut className="h-3 w-3" /> {t('events.scanLog.out')}</>}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fmtFull(s.scanned_at)} · {t(`events.scanResult.${s.result}`, s.result)}
                        {s.zone_id && zoneName[s.zone_id] ? ` · ${zoneName[s.zone_id]}` : ''}
                        {' · '}
                        {s.scanner_access_id
                          ? (scannerName[s.scanner_access_id] ?? t('events.scanLog.scanner'))
                          : t('events.scanLog.host')}
                      </p>
                      {s.note && <p className="text-xs text-muted-foreground break-words">{s.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TicketTypeDialog
        open={ttDialogOpen}
        onOpenChange={(o) => { setTtDialogOpen(o); if (!o) setTtEditing(null); }}
        editing={ttEditing}
        products={ticketProducts}
        usedProductIds={usedProductIds}
        soldForProduct={(pid) => soldPerProduct[pid] ?? 0}
        saving={createTicketType.isPending || updateTicketType.isPending}
        onSubmit={handleTicketTypeSubmit}
      />

      <AlertDialog
        open={!!ttDeleteTarget}
        onOpenChange={(o) => { if (!o) setTtDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('events.ticketTypes.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {ttDeleteTarget && (soldPerProduct[ttDeleteTarget.product_id] ?? 0) > 0
                ? t('events.ticketTypes.guards.deleteBlocked')
                : t('events.ticketTypes.guards.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('events.ticketTypes.form.cancel')}</AlertDialogCancel>
            {ttDeleteTarget && (soldPerProduct[ttDeleteTarget.product_id] ?? 0) === 0 && (
              <AlertDialogAction onClick={handleDelete}>
                {t('events.ticketTypes.delete')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScannerAccessDialog
        open={saDialogOpen}
        onOpenChange={setSaDialogOpen}
        zones={zones}
        ticketTypes={ticketTypes.map((tt) => ({ product_id: tt.product_id, name: tt.name }))}
        saving={createAccess.isPending || ensureZone.isPending}
        onSubmit={handleCreateAccess}
      />

      <ScannerQrDialog
        access={saQrTarget}
        onOpenChange={(o) => { if (!o) setSaQrTarget(null); }}
        zoneName={saQrTarget ? (zoneName[saQrTarget.zone_id] ?? '—') : '—'}
        scopeLabel={saQrTarget ? scopeLabel(saQrTarget) : ''}
      />

      <AlertDialog
        open={!!saRevokeTarget}
        onOpenChange={(o) => { if (!o) setSaRevokeTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('events.access.revokeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('events.access.guards.revokeConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('events.access.form.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeAccess}>
              {t('events.access.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!saDeleteTarget}
        onOpenChange={(o) => { if (!o) setSaDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('events.access.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('events.access.guards.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('events.access.form.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccess}>
              {t('events.access.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
