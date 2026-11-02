// KASSA-ACCOUNT-1 — een toestel koppelen: wat de eigenaar in beheer krijgt (6 cijfers of een QR met
// /kassa?koppel=<token>) en wat het toestel daarvan inleest. Puur, zodat het testbaar is.
// (Vervangt KASSA-START-1 "kassa aanmaken vanuit de app": kassa's maak je in beheer, het toestel kiest
//  geen kassa meer, de koppelcode bepaalt hem.)

/** Queryparameter in de QR-link: <site>/kassa?koppel=<64 hex>. */
export const PAIR_PARAM = 'koppel';

const CODE = /^[0-9]{6}$/;
const TOKEN = /^[0-9a-f]{64}$/;

/** Wat iemand intikt, plakt of scant → de code of het token, of null als het er niet op lijkt.
 *  Aanvaardt "482 913", "482-913", een 64-hex-token en een volledige link met ?koppel=. */
export function parsePairInput(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const fromUrl = /[?&]koppel=([0-9a-fA-F]{64})(?:[&#]|$)/.exec(s);
  if (fromUrl) return fromUrl[1].toLowerCase();
  const compact = s.replace(/[\s-]/g, '').toLowerCase();
  if (CODE.test(compact) || TOKEN.test(compact)) return compact;
  return null;
}

/** "482913" → "482 913" (leesbaar op het scherm van de eigenaar). */
export function formatPairCode(code: string): string {
  return CODE.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** De link in de QR: opent de kassa op dit adres en koppelt meteen. */
export function pairUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/kassa?${PAIR_PARAM}=${token}`;
}

/** Resterende seconden tot `expiresAt` (nooit negatief). */
export function secondsLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

/** 600 → "10:00", 59 → "0:59". */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export type PairError = 'invalid_code' | 'rate_limited' | 'offline' | 'server';

/** Antwoord van de edge function kassa-device-pair → wat het toestel toont. */
export function pairErrorOf(status: number | null, body: { error?: string } | null): PairError {
  if (status === null) return 'offline';
  if (status === 404 || body?.error === 'invalid_code' || status === 400) return 'invalid_code';
  if (status === 429 || body?.error === 'rate_limited') return 'rate_limited';
  return 'server';
}

/** Is deze sessie een toestelaccount (app_metadata.kind, gezet door kassa-device-pair)? */
export function isDeviceUser(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  return user?.app_metadata?.kind === 'kassa';
}
