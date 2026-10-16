// EVENT-DOOR-2 — netwerklogica voor de scanner aan de deur (SellQo Deur).
//
// De portier scant in cafés met slecht 4G. Een scan mag dan nooit stil blijven hangen en
// een geldige gast mag nooit als "ongeldig" of "dubbel" geweigerd worden omdat het
// NETWERK faalde. Deze module is puur (geen React, geen Supabase), zodat ze getest kan
// worden:
//
//  - withTimeout:        elke oproep krijgt een AbortController en een harde deadline;
//  - isNetworkError:     onderscheidt "geen/trage verbinding" van een echt serverantwoord;
//  - runWithRetry:       één automatische herhaling bij een netwerkfout of timeout;
//  - recoverAlreadyInside: een "al binnen" dat in werkelijkheid onze EIGEN eerdere poging
//                        was (antwoord onderweg verloren) wordt een groene check-in.
//
// Waarom een herhaling veilig is: de check-in op de server (perform_scan) is idempotent —
// UPDATE … WHERE status = 'valid'. Een tweede poging na een geslaagde eerste geeft
// 'already' met het tijdstip van die eerste poging, nooit een tweede inschrijving.

export const DOOR_TIMEOUT_MS = 8000;
/** Een "al binnen" telt als onze eigen check-in als die minder dan zo lang geleden is. */
export const RECOVER_WINDOW_MS = 30_000;
/** Speling voor het klokverschil tussen dit toestel en de server. */
export const CLOCK_SKEW_MS = 10_000;

export class DoorNetworkError extends Error {
  readonly kind: 'timeout' | 'offline' | 'network';
  constructor(kind: 'timeout' | 'offline' | 'network', message?: string) {
    super(message ?? kind);
    this.name = 'DoorNetworkError';
    this.kind = kind;
  }
}

/** Voert `fn` uit met een AbortSignal en wijst af met DoorNetworkError('timeout') na `ms`.
 *  Ook als de onderliggende fetch het signaal negeert, stopt het wachten op tijd. */
export function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = DOOR_TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new DoorNetworkError('timeout'));
    }, ms);
  });
  return Promise.race([fn(ctrl.signal), deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

interface ErrorLike { name?: unknown; message?: unknown; context?: unknown; status?: unknown }

function statusOf(e: ErrorLike): number | null {
  if (typeof e.status === 'number') return e.status;
  const ctx = e.context as { status?: unknown } | undefined;
  if (ctx && typeof ctx === 'object' && typeof ctx.status === 'number') return ctx.status;
  return null;
}

/** true = de verbinding faalde (geen antwoord, timeout, gateway-fout); de uitkomst op de
 *  server is dan ONBEKEND. false = de server gaf een echt antwoord (bv. 401 ingetrokken
 *  link, 400 ongeldige QR) — dat is geen netwerkprobleem. */
export function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  if (err instanceof DoorNetworkError) return true;
  const e = err as ErrorLike;
  const name = typeof e.name === 'string' ? e.name : '';
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  // functions-js: geen antwoord (fetch faalde) of de relay kon de functie niet bereiken.
  if (name === 'FunctionsFetchError' || name === 'FunctionsRelayError') return true;
  const status = statusOf(e);
  if (status !== null && [0, 408, 502, 503, 504].includes(status)) return true;
  if (name === 'TypeError') {
    const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
    return /fetch|network|load failed|internet/.test(msg);
  }
  return false;
}

export interface RetryOutcome<T> {
  value: T;
  /** Aantal pogingen (1 = meteen gelukt, 2 = na een automatische herhaling). */
  attempts: number;
}

/** Eén poging plus maximaal `retries` automatische herhalingen, ALLEEN bij een
 *  netwerkfout of timeout. Een echt serverantwoord (ook een fout) wordt nooit herhaald.
 *  Is het toestel offline, dan wordt er niet eens geprobeerd. */
export async function runWithRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: { timeoutMs?: number; retries?: number; isOnline?: () => boolean; onRetry?: (attempt: number) => void } = {},
): Promise<RetryOutcome<T>> {
  const { timeoutMs = DOOR_TIMEOUT_MS, retries = 1, isOnline = () => true, onRetry } = opts;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    if (!isOnline()) throw new DoorNetworkError('offline');
    if (attempt > 1) onRetry?.(attempt);
    try {
      return { value: await withTimeout(fn, timeoutMs), attempts: attempt };
    } catch (e) {
      lastErr = e;
      if (!isNetworkError(e)) throw e;
    }
  }
  throw lastErr;
}

/** Minimale vorm van een scanresultaat die de herstel-beslissing nodig heeft. */
export interface DoorResultLike {
  success: boolean;
  result?: string;
  checked_in_at?: string | null;
}

/**
 * Beslist of een "al binnen" eigenlijk ONZE eigen check-in was, waarvan het antwoord
 * onderweg verloren ging. Alle voorwaarden moeten kloppen:
 *  1. dit toestel deed voor dit ticket een poging waarvan de uitkomst onbekend bleef
 *     (`unresolvedSince` = starttijd van die poging);
 *  2. de server zet de check-in NA de start van die poging (met klokspeling), zodat een
 *     check-in door een ander toestel van vóór onze poging nooit groen wordt;
 *  3. de check-in is minder dan RECOVER_WINDOW_MS geleden.
 * Anders blijft het gewoon "al binnen" (oranje): dan was het echt iemand anders.
 */
export function recoverAlreadyInside(
  res: DoorResultLike,
  unresolvedSince: number | null | undefined,
  now: number,
): boolean {
  if (!res.success || res.result !== 'already') return false;
  if (unresolvedSince == null) return false;
  if (!res.checked_in_at) return false;
  const at = Date.parse(res.checked_in_at);
  if (Number.isNaN(at)) return false;
  if (at < unresolvedSince - CLOCK_SKEW_MS) return false;
  const age = now - at;
  return age >= -CLOCK_SKEW_MS && age < RECOVER_WINDOW_MS;
}

/** Kleine wachtrij voor scans die binnenkomen terwijl er nog een oproep loopt: geen
 *  dubbels (de camera leest dezelfde QR tot 12× per seconde) en een harde bovengrens,
 *  zodat er na een netwerkstoring geen lawine volgt. */
export function enqueueScan(queue: readonly string[], token: string, current: string | null, max = 3): string[] {
  if (!token || token === current || queue.includes(token)) return [...queue];
  if (queue.length >= max) return [...queue];
  return [...queue, token];
}

/** Welke vertaal-key hoort bij een "invalid"-antwoord met een reden van de server. */
export function invalidReasonKey(result: string | undefined, reason: string | undefined): string {
  if (result === 'cancelled' || reason === 'ticket_cancelled') return 'result.cancelled';
  if (result === 'refunded' || reason === 'ticket_refunded') return 'result.refunded';
  if (reason === 'ticket_transferred') return 'result.transferred';
  return 'result.invalid';
}
