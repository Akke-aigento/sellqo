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

function Spinner() {
  const { t } = useTranslation();
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" aria-label={t('kassa.common.loading')} /></div>;
}

function Device() {
  const { t } = useTranslation();
  const { tenants, loading } = useTenant();
  const { staff } = useKassaSession();
  const [device, setDevice] = useState<DeviceConfig | null>(() => loadDevice());
  const [terminal, setTerminal] = useState<{ name: string; settings: unknown } | null>(null);
  const [terminalError, setTerminalError] = useState(false);

  // Een opgeslagen toestel van een zaak waar deze account niet (meer) bij hoort: opnieuw kiezen.
  const valid = device && !loading && tenants.some((x) => x.id === device.tenantId);
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
  if (!runtime || !terminal) return <Spinner />;
  if (!staff) return <div className="min-h-screen py-6" style={{ paddingTop: 'max(1.5rem, var(--safe-top))' }}><PinLock tenantId={device.tenantId} deviceUuid={device.deviceUuid} /></div>;
  return <KassaHome runtime={runtime} terminalName={terminal.name} onForgetDevice={reset} />;
}

export function KassaApp() {
  const { user, loading } = useAuth();
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
