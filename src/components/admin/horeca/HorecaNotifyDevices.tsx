// MELDING-1 — Kassa (POS) › Kassa's: alle toestellen die horeca-meldingen krijgen, met per
// toestel wat het ontvangt. De enige plek om dat aan te passen; inschrijven gebeurt op het toestel
// zelf ("Meldingen op dit toestel" in de kassa, op het keukenscherm, of hier "dit toestel toevoegen").
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { BellRing, Loader2, Plus, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTenant } from '@/hooks/useTenant';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { usePrepStations } from '@/hooks/usePrepStations';
import { getInstallId } from '@/lib/installId';
import { DEVICE_KINDS, HORECA_ALERT_EVENTS, listDevices, removeDevice, saveDevice, SHARED_KINDS, silenceDevice, type DeviceProfile, type HorecaAlertEvent } from '@/lib/deviceAlerts';
import { DeviceAlertsDialog } from '@/components/horeca/DeviceAlertsDialog';
import { cn } from '@/lib/utils';

const key = (tenantId: string | undefined) => ['horeca-notify-devices', tenantId] as const;

function DeviceCard({ d, tenantId, stations, onChanged }: {
  d: DeviceProfile; tenantId: string; stations: { id: string; name: string }[]; onChanged: () => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const [draft, setDraft] = useState<DeviceProfile>(d);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const dirty = JSON.stringify([draft.name, draft.kind, [...draft.events].sort(), [...draft.station_ids].sort(), draft.personal])
    !== JSON.stringify([d.name, d.kind, [...d.events].sort(), [...d.station_ids].sort(), d.personal]);
  const here = d.install_id === getInstallId();

  const toggleEvent = (e: HorecaAlertEvent, on: boolean) =>
    setDraft((x) => ({ ...x, events: on ? [...new Set([...x.events, e])] : x.events.filter((y) => y !== e) }));
  const toggleStation = (id: string) =>
    setDraft((x) => ({ ...x, station_ids: x.station_ids.includes(id) ? x.station_ids.filter((y) => y !== id) : [...x.station_ids, id] }));

  const save = async () => {
    if (!draft.name.trim()) { toast.error(t('deviceAlerts.manage.nameRequired')); return; }
    setBusy(true);
    try {
      await saveDevice(tenantId, { ...draft, name: draft.name.trim().slice(0, 60) });
      toast.success(t('deviceAlerts.manage.saved'));
      onChanged();
    } catch (e) {
      toast.error(t('deviceAlerts.manage.error'), { description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      // Een gedeeld toestel (kassa, post) wordt stilgezet in plaats van gewist: zo krijgt zijn push-
      // inschrijving ook geen persoonlijke meldingen van wie er aangemeld is.
      if (SHARED_KINDS.includes(d.kind)) await silenceDevice(tenantId, d);
      else await removeDevice(tenantId, d.install_id);
      toast.success(t('deviceAlerts.manage.removed'));
      onChanged();
    } catch (e) {
      toast.error(t('deviceAlerts.manage.error'), { description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); setConfirm(false); }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            aria-label={t('deviceAlerts.manage.name')} className="h-9 max-w-[14rem]" />
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DeviceProfile['kind'] })}
            aria-label={t('deviceAlerts.manage.kind')} className="h-9 rounded-md border bg-background px-2 text-sm">
            {DEVICE_KINDS.map((k) => <option key={k} value={k}>{t(`deviceAlerts.kind.${k}`)}</option>)}
          </select>
          {here ? <Badge variant="secondary">{t('deviceAlerts.manage.thisDevice')}</Badge> : null}
        </div>

        <p className={cn('text-xs', d.push ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400')}>
          {d.push
            ? t('deviceAlerts.manage.pushOn', { os: d.os ?? '—', when: d.last_seen_at ? formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true, locale: dateLocale }) : '—' })
            : t('deviceAlerts.manage.pushOff')}
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('deviceAlerts.manage.receives')}</legend>
          {HORECA_ALERT_EVENTS.map((e) => (
            <div key={e} className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.events.includes(e)} onCheckedChange={(v) => toggleEvent(e, v === true)} />
                {t(`deviceAlerts.event.${e}`)}
              </label>
              {e === 'ticket_new' && draft.events.includes('ticket_new') && stations.length > 1 ? (
                <div className="ml-6 flex flex-wrap gap-1.5" role="group" aria-label={t('deviceAlerts.manage.stations')}>
                  {stations.map((s) => (
                    <button key={s.id} type="button" onClick={() => toggleStation(s.id)} aria-pressed={draft.station_ids.includes(s.id)}
                      className={cn('rounded-full border px-2.5 py-1 text-xs', draft.station_ids.includes(s.id) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                      {s.name}
                    </button>
                  ))}
                  <span className="self-center text-xs text-muted-foreground">
                    {draft.station_ids.length === 0 ? t('deviceAlerts.manage.allStations') : null}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </fieldset>

        <label className="flex items-start justify-between gap-3">
          <span><span className="block text-sm font-medium">{t('deviceAlerts.manage.personal')}</span>
            <span className="block text-xs text-muted-foreground">{t('deviceAlerts.manage.personalHint')}</span></span>
          <Switch checked={draft.personal} onCheckedChange={(v) => setDraft({ ...draft, personal: v })} />
        </label>

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirm(true)} disabled={busy}>
            <Trash2 className="mr-1.5 h-4 w-4" />{t('deviceAlerts.manage.remove')}
          </Button>
          <Button size="sm" onClick={save} disabled={busy || !dirty}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{t('deviceAlerts.manage.save')}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deviceAlerts.manage.removeTitle', { name: d.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t(SHARED_KINDS.includes(d.kind) ? 'deviceAlerts.manage.removeTextShared' : 'deviceAlerts.manage.removeText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deviceAlerts.manage.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>{t('deviceAlerts.manage.remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function HorecaNotifyDevices() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: prep } = usePrepStations();
  const stations = useMemo(() => (prep?.stations ?? []).map((s) => ({ id: s.id, name: s.name })), [prep]);
  const stationNames = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);
  const { data, isLoading, error } = useQuery({
    queryKey: key(tenantId),
    enabled: !!tenantId,
    queryFn: () => listDevices(tenantId!),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key(tenantId) });
  if (!tenantId) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg"><BellRing className="h-5 w-5" aria-hidden />{t('deviceAlerts.manage.title')}</CardTitle>
          <CardDescription>{t('deviceAlerts.manage.intro')}</CardDescription>
        </div>
        <Button variant="outline" onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />{t('deviceAlerts.manage.addThis')}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('deviceAlerts.loading')} />
          : error ? <p role="alert" className="text-sm text-destructive">{t('deviceAlerts.manage.loadError')}</p>
          : !data?.length ? <p className="text-sm text-muted-foreground">{t('deviceAlerts.manage.empty')}</p>
          : (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.map((d) => <DeviceCard key={`${d.install_id}-${d.updated_at}`} d={d} tenantId={tenantId} stations={stations} onChanged={refresh} />)}
            </div>
          )}
      </CardContent>
      {adding ? (
        <DeviceAlertsDialog open={adding} onOpenChange={(o) => { setAdding(o); if (!o) void refresh(); }}
          tenantId={tenantId} kind="phone" defaultName={t('deviceAlerts.defaultName.phone')} stationNames={stationNames} manageHref="/admin/pos" />
      ) : null}
    </Card>
  );
}
