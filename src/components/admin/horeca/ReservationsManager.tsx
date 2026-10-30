// RESERVATIE-1 — Bestellen › Reservaties: reservaties per dag en de instelling "paars vanaf".
// Eén plek voor het beheer; de kassa toont dezelfde reservaties op het zaalplan (lang drukken op een
// tafel of de knop Reservaties). Een reservatie raakt nooit een rekening.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/hooks/useTenant';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { ReservationDialog } from '@/components/horeca/ReservationDialog';
import { ReservationList } from '@/components/horeca/ReservationList';
import { OnlineReservationsCard } from './OnlineReservationsCard';
import {
  createReservation, fetchPendingRequests, fetchReservationSettings, fetchReservations, reservationsForDay, saveReservationSettings, updateReservation,
  type Reservation, type ReservationSettings, type ReservationStatus,
} from '@/lib/horeca/reservations';

const LEAD_OPTIONS = [15, 30, 60, 90, 120, 1440] as const;
const LATE_OPTIONS = [10, 15, 20, 30] as const;

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function ReservationsManager() {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const { data: plan } = useFloorPlan();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [edit, setEdit] = useState<{ reservation: Reservation | null } | null>(null);

  const listKey = ['reservations', tenantId, day.toISOString()];
  const { data: list, isLoading } = useQuery({
    queryKey: listKey,
    enabled: !!tenantId,
    queryFn: () => fetchReservations(tenantId!, day.toISOString(), addDays(day, 1).toISOString()),
  });
  // RESERVATIE-2: online aanvragen die op een antwoord wachten (alle dagen).
  const { data: pending } = useQuery({
    queryKey: ['reservations', tenantId, 'pending'],
    enabled: !!tenantId,
    queryFn: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return fetchPendingRequests(tenantId!, d.toISOString()); },
  });
  const settingsKey = ['reservation-settings', tenantId];
  const { data: settings } = useQuery({ queryKey: settingsKey, enabled: !!tenantId, queryFn: () => fetchReservationSettings(tenantId!) });

  const fail = (e: unknown) => toast.error(t('reservations.saveFailed', { detail: e instanceof Error ? e.message : String(e) }));
  const saveSettings = useMutation({
    mutationFn: (s: ReservationSettings) => saveReservationSettings(tenantId!, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: settingsKey }); toast.success(t('reservations.saved')); },
    onError: fail,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) => updateReservation(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations', tenantId] }),
    onError: fail,
  });

  const labels = new Map((plan?.tables ?? []).map((x) => [x.id, x.label]));
  const tables = (plan?.tables ?? []).map((x) => ({ id: x.id, label: x.label }));
  const s = settings ?? { lead_minutes: 60, late_minutes: 15 };
  const today = startOfDay(new Date()).getTime() === day.getTime();
  const dayLabel = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(day);
  const select = 'h-10 rounded-md border bg-background px-2 text-sm';

  return (
    <div className="space-y-6">
      {pending && pending.length > 0 && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle>{t('reservations.pendingTitle', { count: pending.length })}</CardTitle>
            <CardDescription>{t('reservations.pendingIntro')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReservationList list={pending} settings={s} tableLabel={(id) => (id ? labels.get(id) ?? null : null)} now={Date.now()} showDate emptyText=""
              onSeat={(r) => setStatus.mutate({ id: r.id, status: 'seated' })}
              onEdit={(r) => setEdit({ reservation: r })}
              onStatus={(r, status) => setStatus.mutate({ id: r.id, status })} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t('reservations.title')}</CardTitle>
          <CardDescription>{t('reservations.adminIntro')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" aria-label={t('reservations.prevDay')} onClick={() => setDay((d) => addDays(d, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-0 flex-1 text-center font-semibold capitalize sm:flex-none sm:px-2">{today ? `${t('reservations.todayShort')} · ${dayLabel}` : dayLabel}</span>
            <Button variant="outline" size="icon" aria-label={t('reservations.nextDay')} onClick={() => setDay((d) => addDays(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
            {!today && <Button variant="ghost" onClick={() => setDay(startOfDay(new Date()))}>{t('reservations.todayShort')}</Button>}
            <Button className="w-full sm:ml-auto sm:w-auto" onClick={() => setEdit({ reservation: null })}><Plus className="mr-1 h-4 w-4" />{t('reservations.new')}</Button>
          </div>
          {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label={t('common.loading')} /> : (
            <ReservationList list={reservationsForDay(list ?? [], day).filter((r) => r.status !== 'requested')} settings={s} tableLabel={(id) => (id ? labels.get(id) ?? null : null)} now={Date.now()}
              emptyText={t('reservations.emptyDay')}
              onSeat={(r) => setStatus.mutate({ id: r.id, status: 'seated' })}
              onEdit={(r) => setEdit({ reservation: r })}
              onStatus={(r, status) => setStatus.mutate({ id: r.id, status })} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('reservations.settingsTitle')}</CardTitle>
          <CardDescription>{t('reservations.settingsIntro')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-sm font-semibold">{t('reservations.leadLabel')}</span>
            <select className={select} value={s.lead_minutes} disabled={saveSettings.isPending}
              onChange={(e) => saveSettings.mutate({ ...s, lead_minutes: Number(e.target.value) })}>
              {LEAD_OPTIONS.map((m) => <option key={m} value={m}>{m === 1440 ? t('reservations.leadAllDay') : t('reservations.minutesBefore', { count: m })}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-semibold">{t('reservations.lateLabel')}</span>
            <select className={select} value={s.late_minutes} disabled={saveSettings.isPending}
              onChange={(e) => saveSettings.mutate({ ...s, late_minutes: Number(e.target.value) })}>
              {LATE_OPTIONS.map((m) => <option key={m} value={m}>{t('reservations.minutesAfter', { count: m })}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">{t('reservations.privacyNote')}</p>
        </CardContent>
      </Card>

      <OnlineReservationsCard />

      {edit && (
        <ReservationDialog initial={edit.reservation} tables={tables} defaultDate={day} onClose={() => setEdit(null)}
          onSave={async (input) => {
            if (edit.reservation) await updateReservation(edit.reservation.id, input);
            else await createReservation(tenantId!, input);
            await qc.invalidateQueries({ queryKey: ['reservations', tenantId] });
            toast.success(t('reservations.saved'));
          }} />
      )}
    </div>
  );
}
