// KASSA-ACCOUNT-1 — het toestel heeft een eigen account (niet in user_roles). Koppelen met een code uit beheer,
// de context (zaak, kassa, toestel) uit kassa_device_context(), en ontkoppelen.
// Offline: de laatst gekende context blijft bewaard (zelfde toestel-user), zodat de kassa offline kan opstarten
// zoals vroeger met de eigenaarssessie. Intrekken werkt bij de eerstvolgende online-aanroep.
import { supabase } from '@/integrations/supabase/client';
import { forgetDevice, saveDevice, type DeviceConfig } from './runtime';
import { pairErrorOf, type PairError } from './setup';

export interface DeviceContext {
  device: { user_id: string; device_uuid: string; name: string; paired_at: string };
  terminal: { id: string; name: string; settings: unknown; status: string | null };
  tenant: {
    id: string; name: string; slug: string | null; language: string | null; business_modules: string[] | null;
    currency: string | null; logo_url: string | null; billing_company_name: string | null; address: string | null;
    postal_code: string | null; city: string | null; country: string | null; btw_number: string | null;
    iban: string | null; bic: string | null;
  };
}

const CTX_KEY = 'sq_kassa_ctx';

function readCache(userId: string): DeviceContext | null {
  try {
    const c = JSON.parse(localStorage.getItem(CTX_KEY) ?? 'null') as DeviceContext | null;
    return c?.device?.user_id === userId ? c : null;
  } catch { return null; }
}
function writeCache(c: DeviceContext | null) {
  try { if (c) localStorage.setItem(CTX_KEY, JSON.stringify(c)); else localStorage.removeItem(CTX_KEY); } catch { /* privémodus */ }
}

/** Netwerkhapering (geen antwoord van de server), geen weigering. */
export function isNetworkError(e: unknown): boolean {
  const msg = (e as { message?: string } | null)?.message ?? String(e ?? '');
  return /failed to fetch|network|load failed|timeout|aborted/i.test(msg);
}

export type ContextResult =
  | { kind: 'device'; ctx: DeviceContext; offline: boolean }
  | { kind: 'none' }
  | { kind: 'error' };

/** Context van het aangemelde toestel; 'none' = geen (actief) kassatoestel. */
export async function fetchDeviceContext(userId: string): Promise<ContextResult> {
  try {
    const { data, error } = await supabase.rpc('kassa_device_context' as never);
    if (error) throw error;
    const ctx = data as unknown as DeviceContext | null;
    if (!ctx?.device || !ctx.tenant || !ctx.terminal) { writeCache(null); return { kind: 'none' }; }
    writeCache(ctx);
    return { kind: 'device', ctx, offline: false };
  } catch (e) {
    const cached = readCache(userId);
    if (cached && isNetworkError(e)) return { kind: 'device', ctx: cached, offline: true };
    return { kind: 'error' };
  }
}

/** De bewaarde toestelinstelling (zaak, kassa, deviceId) gelijkzetten met de serverkoppeling. */
export function deviceConfigOf(ctx: DeviceContext): DeviceConfig {
  return saveDevice(ctx.tenant.id, ctx.terminal.id, ctx.device.device_uuid);
}

/** Koppelcode of QR-token inruilen en meteen aanmelden met de nieuwe toestelaccount. */
export async function pairThisDevice(secret: string, deviceUuid: string): Promise<{ ok: true } | { ok: false; error: PairError }> {
  let status: number | null = null;
  let body: { email?: string; password?: string; error?: string } | null = null;
  try {
    const { data, error } = await supabase.functions.invoke('kassa-device-pair', { body: { code: secret, device_uuid: deviceUuid } });
    if (error) {
      const res = (error as { context?: Response }).context;
      if (res && typeof res.status === 'number') {
        status = res.status;
        body = await res.json().catch(() => null);
      }
    } else {
      status = 200;
      body = data as typeof body;
    }
  } catch { status = null; }
  if (status !== 200 || !body?.email || !body.password) return { ok: false, error: pairErrorOf(status, body) };
  const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
  if (error) return { ok: false, error: isNetworkError(error) ? 'offline' : 'server' };
  return { ok: true };
}

/** "Ontkoppel dit toestel": koppeling intrekken (best effort), lokale kassagegevens weg. Afmelden doet de aanroeper. */
export async function unpairThisDevice(): Promise<void> {
  try { await supabase.rpc('kassa_device_unpair_self' as never); } catch { /* offline: beheer kan ontkoppelen */ }
  writeCache(null);
  forgetDevice();
}

/** Na afmelden of intrekken: niets van de vorige koppeling laten staan (de toestel-ID blijft, zie runtime). */
export function clearDeviceCache(): void {
  writeCache(null);
  forgetDevice();
}
