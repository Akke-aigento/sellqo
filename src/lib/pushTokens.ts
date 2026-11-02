// KASSA-MOBIEL-1 — een pushtoken (web-abonnement of FCM-token) van dit toestel bewaren voor wie nu aangemeld is.
//
// Waarom niet meer de gewone upsert(onConflict: 'token'): device_tokens heeft UNIQUE(token) en RLS "enkel je eigen
// rij". Staat het token van dit toestel nog op een andere account (iemand anders meldde zich eerder in dezelfde
// browser of app aan), dan weigert de UPDATE-policy de upsert (42501) en kon niemand nog meldingen aanzetten.
// De RPC device_token_claim zet het token server-side over, maar enkel met bewijs van bezit (web: dezelfde
// p256dh/auth-sleutels; native: het token zelf). Bestaat de RPC (nog) niet, dan de oude upsert.
// Elke fout komt terug met een reden en de technische melding: nooit meer stil.
import type { Db } from '@/lib/supabaseScope';

export interface DeviceTokenInput {
  token: string;
  platform: 'web' | 'ios' | 'android';
  os?: string | null;
  device_name?: string | null;
  install_id?: string | null;
  p256dh?: string | null;
  auth?: string | null;
}

/** Waarom inschrijven niet lukte (voor de toast; i18n deviceAlerts.push.reason.<reden>). */
export type PushFailReason =
  | 'unsupported' | 'permission' | 'service_worker' | 'subscribe' | 'keys' | 'owned_elsewhere' | 'not_signed_in' | 'offline' | 'save';

export type SaveTokenFailure = { ok: false; reason: PushFailReason; detail: string };
export type SaveTokenResult = { ok: true; status: string } | SaveTokenFailure;

/** Type-guard (de app compileert zonder strictNullChecks, daar vernauwt `!r.ok` de unie niet). */
export function isSaveFailure(r: SaveTokenResult | null | undefined): r is SaveTokenFailure {
  return !!r && 'reason' in r;
}

interface PgErr { code?: string; message?: string; details?: string | null; hint?: string | null }

/** "42501 token_owned_elsewhere" — kort genoeg voor een toast, volledig genoeg voor support. */
export function errorDetail(e: unknown): string {
  if (!e) return '';
  if (typeof e === 'string') return e.slice(0, 300);
  const pe = e as PgErr & { name?: string };
  const parts = [pe.code, pe.message ?? (e instanceof Error ? e.message : null) ?? pe.name].filter(Boolean);
  return (parts.length ? parts.join(' ') : String(e)).slice(0, 300);
}

function isNetwork(e: unknown): boolean {
  const msg = (e as PgErr | null)?.message ?? String(e ?? '');
  return /failed to fetch|network|load failed|timeout|aborted/i.test(msg);
}

/** RPC bestaat niet (migratie nog niet live): PostgREST PGRST202, Postgres 42883. */
function isMissingRpc(e: PgErr | null): boolean {
  return e?.code === 'PGRST202' || e?.code === '42883';
}

function failOf(e: PgErr): SaveTokenResult {
  if (isNetwork(e)) return { ok: false, reason: 'offline', detail: errorDetail(e) };
  if (e.code === '42501') {
    return { ok: false, reason: /niet aangemeld/i.test(e.message ?? '') ? 'not_signed_in' : 'owned_elsewhere', detail: errorDetail(e) };
  }
  return { ok: false, reason: 'save', detail: errorDetail(e) };
}

export async function saveDeviceToken(db: Db, userId: string, row: DeviceTokenInput): Promise<SaveTokenResult> {
  try {
    const { data, error } = await (db.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: PgErr | null }>)(
      'device_token_claim', {
        p_token: row.token, p_platform: row.platform, p_os: row.os ?? null, p_device_name: row.device_name ?? null,
        p_install_id: row.install_id ?? null, p_p256dh: row.p256dh ?? null, p_auth: row.auth ?? null,
      });
    if (!error) return { ok: true, status: String((data as { status?: string } | null)?.status ?? 'ok') };
    if (!isMissingRpc(error)) return failOf(error);
    // Terugval zolang de migratie niet live staat: de gewone upsert (lukt enkel als het token vrij of van ons is).
    const { error: e2 } = await db.from('device_tokens').upsert(
      { user_id: userId, ...row, last_seen_at: new Date().toISOString() } as never,
      { onConflict: 'token' },
    );
    return e2 ? failOf(e2 as PgErr) : { ok: true, status: 'upsert' };
  } catch (e) {
    return { ok: false, reason: isNetwork(e) ? 'offline' : 'save', detail: errorDetail(e) };
  }
}
