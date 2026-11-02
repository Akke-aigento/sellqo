// PERSONEEL-1 — de kassa als app: toestel koppelen → PIN → startscherm.
// Draait als eigen app-target (src/kassa/app/main.tsx) en op het web onder /kassa.
// KASSA-ACCOUNT-1 — het toestel meldt zich aan met een eigen gekoppelde account (code/QR uit beheer), niet
// meer met een SellQo-account: zaak, kassa en toestel-ID komen uit de serverkoppeling (kassa_device_context).
// De kassa krijgt een eigen TenantContext (enkel de velden die ze toont), geen tenants-select.
// KASSA-MOBIEL-1 — de kassa heeft een eigen aanmelding (kassa-client, eigen storageKey), los van beheer. Een
// eigenaar-sessie komt nooit in de kassa: geen kassa-sessie = koppelen (met één tik als beheer op dit toestel
// aangemeld is). Afmelden of ontkoppelen raakt de beheer-sessie niet.
import { useCallback, useEffect, useMemo, useState, type ContextType } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { TenantContext } from '@/hooks/useTenant';
import { KassaSessionProvider, useKassaSession } from './session';
import { fiscalSettingsOf, KassaRuntime, loadDevice } from './runtime';
import { PairDevice } from './screens/PairDevice';
import { NotADevice } from './screens/NotADevice';
import { PinLock } from './screens/PinLock';
import { KassaHome } from './screens/KassaHome';
import { useKassaBackground } from './useKassaBackground';
import { useAppShell } from '@/hooks/useAppShell';
import { useHoreca } from './horeca/useHoreca';
import { useKassaSignals } from './useKassaSignals';
import { useWakeLock } from '@/hooks/useWakeLock';
import { readFlag } from '@/lib/ding';
import { KASSA_SOUND_KEY, KASSA_WAKE_KEY, type KassaAlerts } from './alerts';
import { kassaLanguage } from './language';
import { useKassaLockMinutes } from './horeca/paySettings';
import { effectiveLockMinutes, revokeStaffToken } from './horeca/staffSession';
import { clearDeviceCache, deviceConfigOf, fetchDeviceContext, unpairThisDevice, type ContextResult, type DeviceContext } from './deviceAccount';
import { KassaAuthProvider, useKassaAuth } from './kassaAuth';
import { adminHref } from './horeca/quickTap';
import { PUBLIC_SITE_URL } from '@/lib/siteUrl';

function Spinner() {
  const { t } = useTranslation();
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" aria-label={t('kassa.common.loading')} /></div>;
}

type TenantCtx = NonNullable<ContextType<typeof TenantContext>>;

/** Gekoppeld toestel: eigen "huidige zaak" voor de gedeelde hooks (zaalplan, keukenbord, kaart), runtime, PIN. */
function Device({ ctx, onUnpair }: { ctx: DeviceContext; onUnpair: () => void }) {
  const { i18n } = useTranslation();
  const device = useMemo(() => deviceConfigOf(ctx), [ctx]);
  const tenantValue = useMemo<TenantCtx>(() => {
    const tenant = ctx.tenant as unknown as TenantCtx['currentTenant'];
    return { currentTenant: tenant, tenants: tenant ? [tenant] : [], loading: false, setCurrentTenant: () => {}, refreshTenants: async () => {} };
  }, [ctx]);
  // KASSA-UX-2: de kassa spreekt de taal van de zaak (of wat dit toestel koos in het ⋯-menu).
  useEffect(() => {
    const lang = kassaLanguage(ctx.tenant.language);
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
  }, [ctx.tenant.language, i18n]);
  const runtime = useMemo(() => new KassaRuntime(device, fiscalSettingsOf(ctx.terminal.settings), 'NL'), [device, ctx.terminal.settings]);
  // Ondertekende events/betalingen doorsturen en hartslag, ook op het PIN-scherm.
  useKassaBackground(runtime);
  return (
    <TenantContext.Provider value={tenantValue}>
      <KassaLive runtime={runtime} terminalName={ctx.terminal.name} onForgetDevice={onUnpair} />
    </TenantContext.Provider>
  );
}

/** MELDING-1 — draait zolang de kassa gekoppeld is, ook op het PIN-scherm: één poll (store), meldingen
 *  met geluid bij een QR-bestelling, klare bon of online betaling, en het scherm wakker houden. Een kassa
 *  die in rust vergrendeld staat, moet net dan blijven melden. */
function KassaLive({ runtime, terminalName, onForgetDevice }: { runtime: KassaRuntime; terminalName: string; onForgetDevice: () => void }) {
  const { staff, setIdleMs } = useKassaSession();
  // KASSA-UX-6: vergrendeltijd per zaak (Kassa › Personeel), 0 = nooit.
  // Review 1: eigenaar/verantwoordelijke altijd hoogstens 2 minuten.
  const lockMinutes = effectiveLockMinutes(useKassaLockMinutes(runtime.device.tenantId), staff?.role);
  useEffect(() => { setIdleMs(lockMinutes * 60_000); }, [lockMinutes, setIdleMs]);
  const store = useHoreca(runtime.device.tenantId, runtime.device.deviceUuid);
  const [sound, setSound] = useState(() => readFlag(KASSA_SOUND_KEY, true));
  const [wake, setWake] = useState(() => readFlag(KASSA_WAKE_KEY, true));
  const wakeActive = useWakeLock(wake);
  useKassaSignals(runtime.device.tenantId, store.requests, store.requestsLoaded, sound, store.callsLoaded ? store.calls : null);
  const alerts: KassaAlerts = { sound, setSound, wake, setWake, wakeActive };
  if (!staff) return <div className="min-h-screen py-6" style={{ paddingTop: 'max(1.5rem, var(--safe-top))' }}><PinLock tenantId={runtime.device.tenantId} deviceUuid={runtime.device.deviceUuid} /></div>;
  return <KassaHome runtime={runtime} store={store} alerts={alerts} terminalName={terminalName} onForgetDevice={onForgetDevice} />;
}

/** Kassa-sessie: is dit (nog) een gekoppeld toestel? Zo ja de kassa, anders opnieuw koppelen of opnieuw proberen. */
function DeviceGate({ userId, hasAdmin }: { userId: string; hasAdmin: boolean }) {
  const { signOut } = useKassaAuth();
  const [state, setState] = useState<ContextResult | null>(null);
  const load = useCallback(() => {
    let alive = true;
    setState(null);
    void fetchDeviceContext(userId).then((r) => { if (alive) setState(r); });
    return () => { alive = false; };
  }, [userId]);
  useEffect(() => load(), [load]);
  // Ingetrokken of onleesbaar: de bewaarde context weg en enkel de kassa-sessie afmelden (de toestel-ID blijft,
  // zodat opnieuw koppelen hetzelfde deviceId geeft). Beheer blijft aangemeld.
  const leave = async () => { clearDeviceCache(); await signOut(); };
  // Ontkoppelen: koppeling intrekken + alle sessies van de toestel-user (global, enkel via de kassa-client).
  const unpair = async () => { await unpairThisDevice(); await signOut(); };

  if (!state) return <Spinner />;
  if (state.kind === 'device') {
    return (
      <KassaSessionProvider onEnd={(token) => revokeStaffToken(loadDevice()?.tenantId, token)}>
        <Device ctx={state.ctx} onUnpair={() => void unpair()} />
      </KassaSessionProvider>
    );
  }
  return <NotADevice variant={state.kind === 'error' ? 'error' : 'revoked'} onSignOut={leave} onRetry={state.kind === 'error' ? load : undefined} hasAdmin={hasAdmin} />;
}

function KassaRoot() {
  const { user, loading } = useKassaAuth();
  // Beheer bestaat in dezelfde app (SellQo-app of web, route /kassa); in de aparte Kassa-app niet.
  const hasAdmin = !adminHref(window.location.pathname, PUBLIC_SITE_URL).external;
  if (loading) return <Spinner />;
  if (!user) return <PairDevice hasAdmin={hasAdmin} />;
  return <DeviceGate key={user.id} userId={user.id} hasAdmin={hasAdmin} />;
}

export function KassaApp() {
  // MELDING-1: "SellQo Kassa" als beginscherm-app (op iPad/iPhone nodig voor meldingen).
  useAppShell('/kassa.webmanifest', 'Kassa', '#0f172a');
  const standalone = adminHref(window.location.pathname, PUBLIC_SITE_URL).external;
  return (
    <KassaAuthProvider standalone={standalone}>
      <KassaRoot />
    </KassaAuthProvider>
  );
}
