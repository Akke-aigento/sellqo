// KASSA-ACCOUNT-1 — het toestel heeft een eigen account (niet in user_roles). Koppelen met een code uit beheer,
// de context (zaak, kassa, toestel) uit kassa_device_context(), en ontkoppelen.
// Offline: de laatst gekende context blijft bewaard (zelfde toestel-user), zodat de kassa offline kan opstarten
// zoals vroeger met de eigenaarssessie. Intrekken werkt bij de eerstvolgende online-aanroep.
// KASSA-MOBIEL-1: de kassa-client (eigen sessie van het toestel), niet de beheer-sessie.
import { kassaSupabase as supabase } from '@/kassa/app/kassaSupabase';
// KASSA-MOBIEL-1: enkel voor "Dit toestel nu koppelen" — de koppelcode maakt de beheer-sessie (tenant_admin).
import { supabase as beheerSupabase } from '@/integrations/supabase/client';
import type { Db } from '@/lib/supabaseScope';
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

export type QuickPairError = PairError | 'not_allowed';

/** KASSA-MOBIEL-1 — één tik: de eigenaar is op dit toestel in beheer aangemeld. De beheer-client maakt een koppelcode
 *  (bestaande RPC kassa_pair_code_create, enkel tenant_admin), de kassa-client ruilt het QR-token meteen in via
 *  kassa-device-pair. Geen code overtikken; de server doet exact hetzelfde als bij een gescande QR. */
export async function pairWithAdminSession(tenantId: string, terminalId: string, deviceUuid: string, adminDb: Db = beheerSupabase): Promise<{ ok: true } | { ok: false; error: QuickPairError }> {
  let token: string | undefined;
  try {
    const { data, error } = await adminDb.rpc('kassa_pair_code_create' as never, { p_tenant_id: tenantId, p_terminal_id: terminalId } as never);
    if (error) {
      if (isNetworkError(error)) return { ok: false, error: 'offline' };
      return { ok: false, error: (error as { code?: string }).code === '42501' ? 'not_allowed' : 'server' };
    }
    token = (data as { token?: string } | null)?.token;
  } catch (e) {
    return { ok: false, error: isNetworkError(e) ? 'offline' : 'server' };
  }
  if (!token) return { ok: false, error: 'server' };
  return pairThisDevice(token, deviceUuid);
}

/** "Ontkoppel dit toestel": koppeling intrekken (best effort), alle sessies van de toestel-user weg (global),
 *  lokale kassagegevens weg. KASSA-MOBIEL-1: enkel via de kassa-client — de beheer-sessie op dit toestel blijft
 *  staan. De aanroeper ruimt daarna de kassa-staat op (useKassaAuth().signOut). */
export async function unpairThisDevice(): Promise<void> {
  try { await supabase.rpc('kassa_device_unpair_self' as never); } catch { /* offline: beheer kan ontkoppelen */ }
  // Review 1: ook alle refresh-tokens van de toestel-user server-side intrekken.
  try { await supabase.auth.signOut({ scope: 'global' }); } catch { /* offline: de koppeling is wel ingetrokken */ }
  writeCache(null);
  forgetDevice();
}

/** Na afmelden of intrekken: niets van de vorige koppeling laten staan (de toestel-ID blijft, zie runtime). */
export function clearDeviceCache(): void {
  writeCache(null);
  forgetDevice();
}
