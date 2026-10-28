// PERSONEEL-1 — de kassa als app: aanmelden toestel → kassa kiezen → PIN → startscherm.
// Draait als eigen app-target (src/kassa/app/main.tsx) en op het web onder /kassa.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TenantProvider, useTenant } from '@/hooks/useTenant';
import { KassaSessionProvider, useKassaSession } from './session';
import { fiscalSettingsOf, forgetDevice, KassaRuntime, loadDevice, type DeviceConfig } from './runtime';
import { SignIn } from './screens/SignIn';
import { DeviceSetup } from './screens/DeviceSetup';
import { PinLock } from './screens/PinLock';
import { KassaHome } from './screens/KassaHome';
import { useKassaBackground } from './useKassaBackground';
import { useAppShell } from '@/hooks/useAppShell';
import { useHoreca } from './horeca/useHoreca';
import { useKassaSignals } from './useKassaSignals';
import { useWakeLock } from '@/hooks/useWakeLock';
import { readFlag } from '@/lib/ding';
import { KASSA_SOUND_KEY, KASSA_WAKE_KEY, type KassaAlerts } from './alerts';

function Spinner() {
  const { t } = useTranslation();
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" aria-label={t('kassa.common.loading')} /></div>;
}

function Device() {
  const { t } = useTranslation();
  const { tenants, loading, currentTenant, setCurrentTenant } = useTenant();
  const { staff } = useKassaSession();
  const [device, setDevice] = useState<DeviceConfig | null>(() => loadDevice());
  const [terminal, setTerminal] = useState<{ name: string; settings: unknown } | null>(null);
  const [terminalError, setTerminalError] = useState(false);

  // Een opgeslagen toestel van een zaak waar deze account niet (meer) bij hoort: opnieuw kiezen.
  const valid = device && !loading && tenants.some((x) => x.id === device.tenantId);
  // Het zaalplan en de kaart lezen de "huidige zaak": die moet de zaak van dit toestel zijn.
  useEffect(() => {
    if (!valid || !device || currentTenant?.id === device.tenantId) return;
    const tnt = tenants.find((x) => x.id === device.tenantId);
    if (tnt) setCurrentTenant(tnt);
  }, [valid, device, currentTenant, tenants, setCurrentTenant]);
  useEffect(() => {
    if (!device || !valid) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('pos_terminals').select('name, settings').eq('id', device.terminalRowId).maybeSingle();
      if (!alive) return;
      if (error || !data) setTerminalError(true); else setTerminal(data);
    })();
    return () => { alive = false; };
  }, [device, valid]);

  const runtime = useMemo(() => (device && terminal ? new KassaRuntime(device, fiscalSettingsOf(terminal.settings), 'NL') : null), [device, terminal]);
  // Ondertekende events/betalingen doorsturen en hartslag, ook op het PIN-scherm.
  useKassaBackground(runtime && currentTenant?.id === device?.tenantId ? runtime : null);
  const reset = () => { forgetDevice(); setDevice(null); setTerminal(null); setTerminalError(false); };

  if (loading) return <Spinner />;
  if (!device || !valid || terminalError) {
    return (
      <>
        {terminalError && <p role="alert" className="p-3 text-center text-sm text-destructive">{t('kassa.setup.terminalGone')}</p>}
        <DeviceSetup onDone={(d) => { setTerminalError(false); setDevice(d); }} />
      </>
    );
  }
  if (!runtime || !terminal || currentTenant?.id !== device.tenantId) return <Spinner />;
  return <KassaLive runtime={runtime} terminalName={terminal.name} onForgetDevice={reset} />;
}

/** MELDING-1 — draait zolang de kassa gekoppeld is, ook op het PIN-scherm: één poll (store), meldingen
 *  met geluid bij een QR-bestelling, klare bon of online betaling, en het scherm wakker houden. Een kassa
 *  die in rust vergrendeld staat, moet net dan blijven melden. */
function KassaLive({ runtime, terminalName, onForgetDevice }: { runtime: KassaRuntime; terminalName: string; onForgetDevice: () => void }) {
  const { staff } = useKassaSession();
  const store = useHoreca(runtime.device.tenantId, runtime.device.deviceUuid);
  const [sound, setSound] = useState(() => readFlag(KASSA_SOUND_KEY, true));
  const [wake, setWake] = useState(() => readFlag(KASSA_WAKE_KEY, true));
  const wakeActive = useWakeLock(wake);
  useKassaSignals(runtime.device.tenantId, store.requests, store.requestsLoaded, sound);
  const alerts: KassaAlerts = { sound, setSound, wake, setWake, wakeActive };
  if (!staff) return <div className="min-h-screen py-6" style={{ paddingTop: 'max(1.5rem, var(--safe-top))' }}><PinLock tenantId={runtime.device.tenantId} deviceUuid={runtime.device.deviceUuid} /></div>;
  return <KassaHome runtime={runtime} store={store} alerts={alerts} terminalName={terminalName} onForgetDevice={onForgetDevice} />;
}

export function KassaApp() {
  const { user, loading } = useAuth();
  // MELDING-1: "SellQo Kassa" als beginscherm-app (op iPad/iPhone nodig voor meldingen).
  useAppShell('/kassa.webmanifest', 'Kassa', '#0f172a');
  if (loading) return <Spinner />;
  if (!user) return <SignIn />;
  return (
    <TenantProvider>
      <KassaSessionProvider>
        <Device />
      </KassaSessionProvider>
    </TenantProvider>
  );
}
