// RESERVATIE-2 — online reserveren door gasten: aan/uit, uren per weekdag, maximum per tijdstip,
// grootste gezelschap, termijn. De regels worden in de databank afgedwongen (reservation_slots).
// Eén plek: Bestellen › Reservaties. De gast reserveert op <winkel>.sellqo.shop/reserveren.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTenant } from '@/hooks/useTenant';
import { DEFAULT_ONLINE_SETTINGS, fetchOnlineSettings, saveOnlineSettings, validRange, type OnlineReservationSettings } from '@/lib/horeca/reservations';

// Maandag eerst; sleutel = weekdag zoals in de databank (0 = zondag).
const DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const NOTICE = [0, 30, 60, 120, 240, 1440] as const;

export function OnlineReservationsCard() {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const key = ['reservation-online-settings', tenantId];
  const { data, isLoading } = useQuery({ queryKey: key, enabled: !!tenantId, queryFn: () => fetchOnlineSettings(tenantId!) });
  const [s, setS] = useState<OnlineReservationSettings>(DEFAULT_ONLINE_SETTINGS);
  useEffect(() => { if (data) setS(data); }, [data]);
  const save = useMutation({
    mutationFn: (next: OnlineReservationSettings) => saveOnlineSettings(tenantId!, next),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success(t('reservations.saved')); },
    onError: (e: unknown) => toast.error(t('reservations.saveFailed', { detail: e instanceof Error ? e.message : String(e) })),
  });

  const dayName = (d: number) => new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(new Date(2026, 10, 1 + d)); // 1 nov 2026 = zondag
  const ranges = (d: number) => s.online_hours[String(d)] ?? [];
  const setRanges = (d: number, r: [string, string][]) => setS((x) => ({ ...x, online_hours: { ...x.online_hours, [String(d)]: r } }));
  const invalid = Object.values(s.online_hours).some((r) => r.some((x) => !validRange(x)));
  const noHours = !Object.values(s.online_hours).some((r) => r.some(validRange));
  const url = currentTenant?.slug ? `https://${currentTenant.slug}.sellqo.shop/reserveren` : null;
  const num = 'h-10 w-24 rounded-md border bg-background px-2 text-sm';
  const select = 'h-10 rounded-md border bg-background px-2 text-sm';

  if (isLoading) return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" aria-label={t('common.loading')} /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('reservations.onlineTitle')}</CardTitle>
        <CardDescription>{t('reservations.onlineIntro')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex items-center gap-3">
          <Switch checked={s.online_enabled} onCheckedChange={(v) => setS((x) => ({ ...x, online_enabled: v }))} />
          <span className="text-sm font-semibold">{t('reservations.onlineEnabled')}</span>
        </label>
        {url ? (
          <p className="text-sm text-muted-foreground">
            {t('reservations.onlineLink')}{' '}
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{url.replace('https://', '')}<ExternalLink className="h-3 w-3" /></a>
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('reservations.hoursTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('reservations.hoursHint')}</p>
          <ul className="divide-y rounded-md border">
            {DAYS.map((d) => (
              <li key={d} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="w-28 shrink-0 text-sm font-medium capitalize">{dayName(d)}</span>
                {ranges(d).length === 0 ? <span className="text-sm text-muted-foreground">{t('reservations.closed')}</span> : null}
                {ranges(d).map((r, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <input type="time" step={900} value={r[0]} aria-label={t('reservations.from')} className={select}
                      onChange={(e) => setRanges(d, ranges(d).map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} />
                    <span aria-hidden>–</span>
                    <input type="time" step={900} value={r[1]} aria-label={t('reservations.to')} className={select}
                      onChange={(e) => setRanges(d, ranges(d).map((x, j) => (j === i ? [x[0], e.target.value] : x)))} />
                    <Button variant="ghost" size="icon" aria-label={t('reservations.removeRange')} onClick={() => setRanges(d, ranges(d).filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                  </span>
                ))}
                {ranges(d).length < 3 && (
                  <Button variant="outline" size="sm" onClick={() => setRanges(d, [...ranges(d), ranges(d).length ? ['18:00', '21:00'] : ['12:00', '14:00']])}>
                    <Plus className="mr-1 h-3.5 w-3.5" />{t('reservations.addRange')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {invalid ? <p role="alert" className="text-sm text-destructive">{t('reservations.rangeInvalid')}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-sm font-semibold">{t('reservations.slotLabel')}</span>
            <select className={select} value={s.slot_minutes} onChange={(e) => setS((x) => ({ ...x, slot_minutes: Number(e.target.value) as 15 | 30 | 60 }))}>
              {[15, 30, 60].map((m) => <option key={m} value={m}>{t('reservations.everyMinutes', { count: m })}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-semibold">{t('reservations.maxPerSlot')}</span>
            <input type="number" min={1} max={500} className={num} value={s.max_guests_per_slot}
              onChange={(e) => setS((x) => ({ ...x, max_guests_per_slot: Math.min(500, Math.max(1, Number(e.target.value) || 1)) }))} />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-semibold">{t('reservations.maxParty')}</span>
            <input type="number" min={1} max={99} className={num} value={s.max_party}
              onChange={(e) => setS((x) => ({ ...x, max_party: Math.min(99, Math.max(1, Number(e.target.value) || 1)) }))} />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-semibold">{t('reservations.daysAhead')}</span>
            <input type="number" min={1} max={365} className={num} value={s.days_ahead}
              onChange={(e) => setS((x) => ({ ...x, days_ahead: Math.min(365, Math.max(1, Number(e.target.value) || 1)) }))} />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-semibold">{t('reservations.minNotice')}</span>
            <select className={select} value={s.min_notice_minutes} onChange={(e) => setS((x) => ({ ...x, min_notice_minutes: Number(e.target.value) }))}>
              {NOTICE.map((m) => <option key={m} value={m}>{m === 0 ? t('reservations.noticeNone') : m >= 1440 ? t('reservations.noticeDay') : t('reservations.minutesBefore', { count: m })}</option>)}
            </select>
          </label>
        </div>
        {s.online_enabled && noHours ? <p className="text-sm text-amber-700 dark:text-amber-300">{t('reservations.noHoursWarning')}</p> : null}
        <p className="text-xs text-muted-foreground">{t('reservations.onlineHow')}</p>
        <Button disabled={save.isPending || invalid} onClick={() => save.mutate(s)}>
          {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{t('reservations.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
