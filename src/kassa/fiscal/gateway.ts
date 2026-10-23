// KASSA-0 — FiscalGateway: de enige weg naar een zwarte doos (FDM-02..05, ID-11).
//
// Transportkeuze ligt nog open (horeca-tafelkassa-ontwerp §12.1: rechtstreeks LAN per toestel,
// via een lokale hub, of via de cloud). Daarom praat alle kassacode met deze interface:
//   - SimulatorGateway: in-process simulator (nu, tests)
//   - HttpGateway: POST /graphql naar een FDM of relais (FDM-1 vult TLS/mTLS/token in)
//
// FiscalSender legt er de regel bovenop dat een bericht vóór verzending bewaard wordt en na
// een time-out of netwerkfout BYTE-IDENTIEK opnieuw gaat (ID-11): de FDM antwoordt dan met
// hetzelfde resultaat zonder zijn tellers te verhogen. Een begonnen verkoop sluit nooit af
// zonder handtekening (FDM-04).
import { mutationBody, statusBody } from './documents';
import { validateMutation } from './schema';
import type { AnyFiscalInput, FdmStatus, Language, MessageItem, MutationName, SignResult } from './types';
import { MUTATIONS } from './types';
import type { FdmSimulator } from './simulator/fdmSimulator';

export type SignOutcome =
  | { kind: 'signed'; result: SignResult; requestBody: string; responseBody: string }
  | { kind: 'rejected'; errors: MessageItem[] | { message: string }[]; requestBody: string; responseBody: string }
  | { kind: 'unreachable'; reason: string; requestBody: string };

export interface FiscalGateway {
  readonly kind: 'simulator' | 'http';
  /** Stuurt precies deze bytes. Nooit zelf iets aan de body veranderen. */
  send(name: MutationName, requestBody: string): Promise<SignOutcome>;
  status(language?: Language): Promise<FdmStatus | null>;
}

function parseResponse(name: MutationName, requestBody: string, responseBody: string): SignOutcome {
  let parsed: { data?: Record<string, unknown> | null; errors?: { message: string }[] };
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    return { kind: 'unreachable', reason: 'antwoord is geen JSON', requestBody };
  }
  const result = parsed.data?.[name] as SignResult | null | undefined;
  if (parsed.errors?.length || !result) {
    return { kind: 'rejected', errors: parsed.errors ?? [{ message: 'leeg antwoord' }], requestBody, responseBody };
  }
  return { kind: 'signed', result, requestBody, responseBody };
}

export class SimulatorGateway implements FiscalGateway {
  readonly kind = 'simulator' as const;
  /** Testhaak: laat de volgende n verzendingen "verloren gaan" NA verwerking (antwoord kwijt). */
  dropNextResponses = 0;
  /** Testhaak: laat de volgende n verzendingen niet aankomen. */
  failNextSends = 0;
  constructor(readonly sim: FdmSimulator) {}

  async send(name: MutationName, requestBody: string): Promise<SignOutcome> {
    if (this.failNextSends > 0) { this.failNextSends--; return { kind: 'unreachable', reason: 'simulator: verbinding geweigerd', requestBody }; }
    const res = await this.sim.handleGraphQL(JSON.parse(requestBody));
    if (this.dropNextResponses > 0) { this.dropNextResponses--; return { kind: 'unreachable', reason: 'simulator: time-out (antwoord verloren)', requestBody }; }
    return parseResponse(name, requestBody, JSON.stringify(res));
  }

  async status(language: Language = 'EN'): Promise<FdmStatus | null> {
    const res = await this.sim.handleGraphQL(statusBody(language));
    return (res.data?.status as FdmStatus) ?? null;
  }
}

export interface HttpGatewayOptions {
  url: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export class HttpGateway implements FiscalGateway {
  readonly kind = 'http' as const;
  constructor(private readonly opts: HttpGatewayOptions) {}

  private async post(body: string): Promise<{ ok: true; text: string; reason?: undefined } | { ok: false; reason: string; text?: undefined }> {
    const f = this.opts.fetchImpl ?? fetch;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 8000);
    try {
      const r = await f(this.opts.url, { method: 'POST', headers: { 'content-type': 'application/json', ...this.opts.headers }, body, signal: ctrl.signal });
      const text = await r.text();
      // GraphQL-fouten komen meestal met 200; 4xx/5xx zonder JSON = transportprobleem.
      if (!r.ok && !text.trim().startsWith('{')) return { ok: false, reason: `HTTP ${r.status}` };
      return { ok: true, text };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timer);
    }
  }

  async send(name: MutationName, requestBody: string): Promise<SignOutcome> {
    const r = await this.post(requestBody);
    if (!r.ok) return { kind: 'unreachable', reason: r.reason, requestBody };
    return parseResponse(name, requestBody, r.text);
  }

  async status(language: Language = 'EN'): Promise<FdmStatus | null> {
    const r = await this.post(JSON.stringify(statusBody(language)));
    if (!r.ok) return null;
    try { return (JSON.parse(r.text).data?.status as FdmStatus) ?? null; } catch { return null; }
  }
}

// ---------------------------------------------------------------- FiscalSender

export interface PendingMessage {
  /** posId|posDateTime|terminalId|eventLabel|posFiscalTicketNo (ID-11). */
  key: string;
  name: MutationName;
  isTraining: boolean;
  requestBody: string;
  createdAt: string;
  attempts: number;
}

/** Duurzame opslag van berichten die nog geen antwoord kregen (IndexedDB in de app, geheugen in tests). */
export interface PendingStore {
  put(m: PendingMessage): Promise<void>;
  get(key: string): Promise<PendingMessage | null>;
  remove(key: string): Promise<void>;
  list(): Promise<PendingMessage[]>;
}

export class MemoryPendingStore implements PendingStore {
  private m = new Map<string, PendingMessage>();
  async put(x: PendingMessage) { this.m.set(x.key, structuredClone(x)); }
  async get(k: string) { return this.m.has(k) ? structuredClone(this.m.get(k) as PendingMessage) : null; }
  async remove(k: string) { this.m.delete(k); }
  async list() { return [...this.m.values()].map((x) => structuredClone(x)); }
}

export function messageKey(name: MutationName, data: AnyFiscalInput, isTraining: boolean): string {
  const label = isTraining ? 'T' : MUTATIONS[name].label;
  return [data.posId, data.posDateTime, data.terminalId, label, data.posFiscalTicketNo].join('|');
}

export class FiscalValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`bericht ongeldig: ${problems.slice(0, 5).join('; ')}`);
    this.name = 'FiscalValidationError';
  }
}

export interface SenderOptions { maxAttempts?: number; backoffMs?: (attempt: number) => number; sleep?: (ms: number) => Promise<void> }

export class FiscalSender {
  constructor(private readonly gateway: FiscalGateway, private readonly store: PendingStore, private readonly opts: SenderOptions = {}) {}

  /**
   * Bewaar, verstuur, en probeer bij "unreachable" opnieuw met exact dezelfde bytes.
   * Geeft 'unreachable' terug als het na maxAttempts nog niet lukte: het bericht blijft dan in
   * de store en `resumePending` stuurt het later identiek opnieuw. De kassa mag die verkoop
   * NIET afsluiten of afdrukken zolang er geen handtekening is.
   */
  async sign(name: MutationName, data: AnyFiscalInput, isTraining = false): Promise<SignOutcome> {
    const problems = validateMutation(name, data);
    if (problems.length) throw new FiscalValidationError(problems);
    const key = messageKey(name, data, isTraining);
    const existing = await this.store.get(key);
    const requestBody = existing?.requestBody ?? JSON.stringify(mutationBody(name, data, isTraining));
    if (existing && existing.requestBody !== JSON.stringify(mutationBody(name, data, isTraining))) {
      // Zelfde sleutel, andere inhoud: de FDM zou weigeren. Dit is een programmeerfout.
      throw new Error(`ID-11: bericht ${key} staat al klaar met andere inhoud`);
    }
    const msg: PendingMessage = existing ?? { key, name, isTraining, requestBody, createdAt: new Date().toISOString(), attempts: 0 };
    await this.store.put(msg);
    return this.deliver(msg);
  }

  private async deliver(msg: PendingMessage): Promise<SignOutcome> {
    const max = this.opts.maxAttempts ?? 3;
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    let last: SignOutcome | null = null;
    for (let i = 0; i < max; i++) {
      msg.attempts += 1;
      await this.store.put(msg);
      last = await this.gateway.send(msg.name, msg.requestBody);
      if (last.kind !== 'unreachable') {
        await this.store.remove(msg.key);
        return last;
      }
      if (i < max - 1) await sleep(this.opts.backoffMs?.(i + 1) ?? 500 * (i + 1));
    }
    return last as SignOutcome;
  }

  /** Bij opstart of wanneer de FDM terug bereikbaar is: alles wat nog openstaat, identiek opnieuw. */
  async resumePending(): Promise<SignOutcome[]> {
    const out: SignOutcome[] = [];
    const pending = (await this.store.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const m of pending) out.push(await this.deliver(m));
    return out;
  }
}
