// MELDING-1 — "Meldingen op dit toestel": geluid en scherm wakker (enkel dit scherm) en push als
// het scherm dicht is (profiel per toestel). Gebruikt in de kassa, het keukenscherm en Kassa ›
// Kassa (POS) › Kassa's ("dit toestel toevoegen", bv. de gsm van de eigenaar).
//
// Inschrijven moet op het toestel zelf (de browser of het OS vraagt toestemming). Wat een toestel
// ontvangt, pas je aan op één plek: Kassa (POS) › Kassa's. Hier staat enkel de samenvatting.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { wakeLockSupported } from '@/hooks/useWakeLock';
import { ding, readFlag, writeFlag } from '@/lib/ding';
import { getInstallId } from '@/lib/installId';
import {
  DEFAULT_EVENTS, DEFAULT_PERSONAL, defaultDeviceName, disablePushHere, enablePushHere, isSilenced, loadThisDevice, pushStateHere, removeDevice, saveDevice, SHARED_KINDS, silenceDevice,
  type DeviceKind, type DeviceProfile, type PushHere,
} from '@/lib/deviceAlerts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  kind: DeviceKind;
  /** Naam voor een nieuw profiel (kassanaam, postnaam …). */
  defaultName: string;
  /** Post van dit scherm (keukenscherm), voor een nieuw profiel. */
  stationId?: string | null;
  /** Postnamen, voor de samenvatting. */
  stationNames?: Map<string, string>;
  /** Toon de schakelaar voor geluid (enkel waar dit venster het geluid regelt). */
  soundKey?: string;
  soundDefault?: boolean;
  onSoundChange?: (on: boolean) => void;
  /** Schakelaar "scherm wakker houden" van dit scherm. */
  wakeKey?: string;
  wakeDefault?: boolean;
  onWakeChange?: (on: boolean) => void;
  /** Wordt de schakelaar al gebruikt (useWakeLock geeft true)? */
  wakeActive?: boolean;
  /** Link naar Kassa (POS) › Kassa's; leeg in de aparte Kassa-app (daar is geen admin). */
  manageHref?: string;
}

export function DeviceAlertsDialog(p: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [state, setState] = useState<PushHere | null>(null);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(() => (p.soundKey ? readFlag(p.soundKey, p.soundDefault ?? true) : false));
  const [wake, setWake] = useState(() => (p.wakeKey ? readFlag(p.wakeKey, p.wakeDefault ?? true) : false));

  const refresh = useCallback(async () => {
    const [s, prof] = await Promise.all([
      pushStateHere(user?.id ?? null).catch(() => 'unsupported' as PushHere),
      loadThisDevice(p.tenantId).catch(() => null),
    ]);
    setState(s);
    // Een stilgezet gedeeld toestel (op afstand verwijderd) telt hier als "geen profiel": aanzetten
    // bewaart dan opnieuw de standaarden voor dit soort toestel.
    setProfile(prof && isSilenced(prof) ? null : prof);
  }, [user?.id, p.tenantId]);
  useEffect(() => { if (p.open) void refresh(); }, [p.open, refresh]);

  const enable = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // Eerst het profiel (met "persoonlijke meldingen uit" op een gedeeld toestel), dan pas inschrijven:
      // mag deze account geen profiel bewaren, dan schrijven we ook niet in. Anders krijgt een gedeelde
      // kassa of keukenscherm de persoonlijke meldingen van wie er aangemeld is.
      if (!profile) {
        await saveDevice(p.tenantId, {
          install_id: getInstallId(),
          name: defaultDeviceName(p.kind, p.defaultName).slice(0, 60),
          kind: p.kind,
          events: DEFAULT_EVENTS[p.kind],
          station_ids: p.kind === 'station' && p.stationId ? [p.stationId] : [],
          personal: DEFAULT_PERSONAL[p.kind],
          lang: (i18n.language || 'nl').slice(0, 2),
        });
      }
      const r = await enablePushHere(user.id);
      if (r !== 'on') {
        toast.error(t(r === 'denied' ? 'deviceAlerts.push.deniedToast' : 'deviceAlerts.push.errorToast'));
        await refresh();
        return;
      }
      toast.success(t('deviceAlerts.push.enabledToast'));
      await refresh();
    } catch (e) {
      toast.error(t('deviceAlerts.push.errorToast'), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      // Een gedeeld toestel ook uitschrijven: zonder profiel zou het de persoonlijke meldingen van de
      // aangemelde account krijgen. Een gsm houdt zijn inschrijving (persoonlijke meldingen).
      // De native app schrijft zich bij elke start opnieuw in: een gedeeld toestel daarom stilzetten
      // (profiel blijft, zonder meldingen) in plaats van het profiel te wissen.
      if (SHARED_KINDS.includes(profile.kind)) {
        await disablePushHere();
        await silenceDevice(p.tenantId, profile);
      } else {
        await removeDevice(p.tenantId, profile.install_id);
      }
      toast.success(t('deviceAlerts.push.disabledToast'));
      await refresh();
    } catch (e) {
      toast.error(t('deviceAlerts.push.errorToast'), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const summary = profile
    ? profile.events.map((e) => {
        if (e !== 'ticket_new') return t(`deviceAlerts.event.${e}`);
        const names = profile.station_ids.map((id) => p.stationNames?.get(id)).filter(Boolean);
        return names.length ? t('deviceAlerts.event.ticket_new_for', { stations: names.join(', ') }) : t('deviceAlerts.event.ticket_new');
      })
    : [];

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" aria-hidden />{t('deviceAlerts.title')}</DialogTitle>
          <DialogDescription>{t('deviceAlerts.intro')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {p.soundKey ? (
            <label className="flex items-start justify-between gap-3">
              <span><span className="block text-sm font-medium">{t('deviceAlerts.sound.label')}</span>
                <span className="block text-xs text-muted-foreground">{t('deviceAlerts.sound.hint')}</span></span>
              <Switch checked={sound} onCheckedChange={(v) => { setSound(v); writeFlag(p.soundKey!, v); p.onSoundChange?.(v); if (v) ding(); }} />
            </label>
          ) : null}

          {p.wakeKey ? (
            <label className="flex items-start justify-between gap-3">
              <span><span className="block text-sm font-medium">{t('deviceAlerts.wake.label')}</span>
                <span className="block text-xs text-muted-foreground">
                  {!wakeLockSupported() ? t('deviceAlerts.wake.unsupported') : wake && !p.wakeActive ? t('deviceAlerts.wake.blocked') : t('deviceAlerts.wake.hint')}
                </span></span>
              <Switch checked={wake} disabled={!wakeLockSupported()} onCheckedChange={(v) => { setWake(v); writeFlag(p.wakeKey!, v); p.onWakeChange?.(v); }} />
            </label>
          ) : null}

          <section className="space-y-2 rounded-md border p-3">
            <h3 className="text-sm font-semibold">{t('deviceAlerts.push.title')}</h3>
            {state === null ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-label={t('deviceAlerts.loading')} />
            ) : state === 'needs-install' || state === 'unsupported' || state === 'denied' ? (
              <>
                <p className="text-sm text-muted-foreground">{t(state === 'needs-install' ? 'deviceAlerts.push.needsInstall' : state === 'denied' ? 'deviceAlerts.push.denied' : 'deviceAlerts.push.unsupported')}</p>
                {profile ? <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>{t('deviceAlerts.push.disable')}</Button> : null}
              </>
            ) : profile && state === 'on' ? (
              <>
                <p className="text-sm">{t('deviceAlerts.push.onAs', { name: profile.name })}</p>
                {summary.length ? (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">{summary.map((s) => <li key={s}>{s}</li>)}</ul>
                ) : <p className="text-sm text-muted-foreground">{t('deviceAlerts.push.nothing')}</p>}
                <p className="text-xs text-muted-foreground">{t(profile.personal ? 'deviceAlerts.push.personalOn' : 'deviceAlerts.push.personalOff')}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {p.manageHref
                    ? <Button asChild variant="outline" size="sm"><a href={p.manageHref}>{t('deviceAlerts.push.manage')}</a></Button>
                    : <p className="w-full text-xs text-muted-foreground">{t('deviceAlerts.push.manageElsewhere')}</p>}
                  <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>{t('deviceAlerts.push.disable')}</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t(`deviceAlerts.push.offHint.${p.kind}`)}</p>
                <Button onClick={enable} disabled={busy || !user}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}{t('deviceAlerts.push.enable')}
                </Button>
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
