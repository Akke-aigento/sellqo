// KASSA-0 — FDM-simulator (FDM-09). Gedraagt zich als een zwarte doos GKS 2.0 volgens de
// FDM-detailbeschrijving v1.4 en POS v2.2, zodat we zonder test-FDM kunnen bouwen en testen.
//
// !!! GEEN ECHTE HANDTEKENING. De handtekening is een deterministische nep-waarde
// (SHA-512 van sleutel + bericht), duidelijk gemarkeerd in de footer. Nooit gebruiken voor
// een echte verkoop: een simulator-ticket is geen btw-kasticket.
//
// Wat hij wel exact doet:
// - inputvalidatie tegen het officiële schema (INVALID_REQUEST)
// - posId-allowlist (UNKNOWN_POS)
// - tellers per eventlabel en totaal, herstart na 999 999 999
// - btw zoals de FDM (vat.ts, 145/145 bewezen)
// - shortSignature = hex(SHA-1(handtekening)), verificationUrl via de officiële codering (qr.ts)
// - idempotentie op de 5 sleutelvelden (ID-11): identiek = zelfde antwoord, tellers niet
//   verhoogd; andere inhoud = fout
// - buffer (%), BUFFER_NEAR_FULL > 70 %, BUFFER_FULL
// - instelbare fouten (FDM_LOCKED, FDM_NOT_OPERATIONAL, ...) voor UI-tests
import { validateMutation } from '../schema';
import { calcVat, totalsPerLabel } from '../vat';
import { MUTATIONS, type AnyFiscalInput, type EventLabel, type FdmStatus, type Language, type MessageCode, type MessageItem, type MutationName, type SaleInput, type SignResult } from '../types';
import { encodeVerification, VERIFICATION_BASE } from './qr';
import { fieldsOf, parseDocument, project, type ArgValue, type Doc } from './graphql';

export const SIMULATOR_FOOTER = 'SELLQO FDM-SIMULATOR - GEEN GELDIGE HANDTEKENING';
const MAX_COUNTER = 999_999_999;

export interface SimulatorConfig {
  fdmId?: string;
  fdmSwVersion?: string;
  /** posId's die deze FDM aanvaardt. Leeg = alle. */
  posAllowList?: string[];
  vatNo?: string;
  estNo?: string;
  /** Aantal events dat de buffer kan houden voor upload. */
  bufferSize?: number;
  /** Klok van de FDM (UTC). */
  now?: () => Date;
  /** Geheim voor de nep-handtekening. */
  signingKey?: string;
  footer?: string[];
  /** Startwaarden van de tellers (bv. om de overloop te testen). */
  counters?: Partial<Record<EventLabel | 'total', number>>;
}

export interface FdmError { message: string; extensions: { category: 'SPF_FOD' | 'FDM'; code: MessageCode; showPos: 'MANDATORY' | 'OPTIONAL' | 'NEVER'; data?: { name: string; value: string }[] } }
// De tegenvelden (`errors?: undefined`) maken de union ook zonder strictNullChecks leesbaar.
export type SimResponse<T> = { ok: true; result: T; errors?: undefined } | { ok: false; errors: FdmError[]; result?: undefined };

const MESSAGES: Partial<Record<MessageCode, { text: Record<Language, string>; category: 'SPF_FOD' | 'FDM'; showPos: 'MANDATORY' | 'OPTIONAL' | 'NEVER' }>> = {
  BUFFER_NEAR_FULL: { category: 'SPF_FOD', showPos: 'MANDATORY', text: { EN: 'FDM buffer usage exceeds 70 %', NL: 'FDM-buffer is meer dan 70 % vol', FR: 'Le tampon du FDM dépasse 70 %', DE: 'FDM-Puffer zu mehr als 70 % belegt' } },
  BUFFER_FULL: { category: 'SPF_FOD', showPos: 'MANDATORY', text: { EN: 'FDM buffer is full', NL: 'FDM-buffer is vol', FR: 'Le tampon du FDM est plein', DE: 'FDM-Puffer ist voll' } },
  FDM_LOCKED: { category: 'SPF_FOD', showPos: 'MANDATORY', text: { EN: 'FDM is locked', NL: 'FDM is geblokkeerd', FR: 'Le FDM est bloqué', DE: 'FDM ist gesperrt' } },
  FDM_NOT_OPERATIONAL: { category: 'FDM', showPos: 'MANDATORY', text: { EN: 'FDM is not functioning', NL: 'FDM werkt niet', FR: 'Le FDM ne fonctionne pas', DE: 'FDM funktioniert nicht' } },
  UNKNOWN_POS: { category: 'FDM', showPos: 'MANDATORY', text: { EN: 'FDM received message from POS not in posAllowList', NL: 'FDM ontving een bericht van een POS die niet in de allowlist staat', FR: 'Le FDM a reçu un message d’un POS absent de la liste', DE: 'FDM erhielt eine Nachricht von einem POS außerhalb der Allowlist' } },
  INVALID_REQUEST: { category: 'FDM', showPos: 'OPTIONAL', text: { EN: 'FDM could not treat the request', NL: 'FDM kon het verzoek niet verwerken', FR: 'Le FDM n’a pas pu traiter la demande', DE: 'FDM konnte die Anfrage nicht verarbeiten' } },
  DUPLICATE_REQUEST: { category: 'FDM', showPos: 'NEVER', text: { EN: 'FDM received a duplicate of an earlier request', NL: 'FDM ontving een duplicaat van een eerder verzoek', FR: 'Le FDM a reçu un doublon', DE: 'FDM erhielt ein Duplikat' } },
  UPDATE_POS_VATNO: { category: 'SPF_FOD', showPos: 'MANDATORY', text: { EN: 'VAT number in POS does not correspond with vatNo known by FDM', NL: 'Btw-nummer in de POS komt niet overeen met de FDM', FR: 'Le numéro de TVA du POS ne correspond pas au FDM', DE: 'USt-Nummer im POS stimmt nicht mit dem FDM überein' } },
  UPDATE_POS_ESTNO: { category: 'SPF_FOD', showPos: 'MANDATORY', text: { EN: 'Establishment number in POS does not correspond with estNo known by FDM', NL: 'Vestigingsnummer in de POS komt niet overeen met de FDM', FR: 'Le numéro d’établissement du POS ne correspond pas au FDM', DE: 'Niederlassungsnummer im POS stimmt nicht mit dem FDM überein' } },
};

function message(code: MessageCode, lang: Language, data?: { name: string; value: string }[]): MessageItem {
  const m = MESSAGES[code] ?? { category: 'FDM' as const, showPos: 'OPTIONAL' as const, text: { EN: code, NL: code, FR: code, DE: code } };
  return { message: m.text[lang], locations: [], extensions: { category: m.category, code, data: data ?? [], showPos: m.showPos } };
}
function error(code: MessageCode, lang: Language, data?: { name: string; value: string }[]): FdmError {
  const m = message(code, lang, data);
  return { message: m.message, extensions: { category: m.extensions.category as 'SPF_FOD' | 'FDM', code, showPos: m.extensions.showPos, data: m.extensions.data ?? [] } };
}

/** Canonieke JSON: sleutels gesorteerd, zodat "identieke inhoud" niet van de volgorde afhangt. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

async function digest(algo: 'SHA-1' | 'SHA-512', bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest(algo, bytes as BufferSource));
}
function toBase64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

interface StoredEvent {
  name: MutationName;
  isTraining: boolean;
  data: AnyFiscalInput;
  result: SignResult;
  contentHash: string;
}

export class FdmSimulator {
  readonly fdmId: string;
  readonly fdmSwVersion: string;
  private readonly cfg: Required<Omit<SimulatorConfig, 'counters' | 'vatNo' | 'estNo'>> & Pick<SimulatorConfig, 'vatNo' | 'estNo'>;
  private counters: Record<string, number> = {};
  private byKey = new Map<string, StoredEvent>();
  /** Alles wat de FDM ondertekende, in volgorde (voor tests en rapporten). */
  readonly journal: StoredEvent[] = [];
  private buffered = 0;
  private fault: MessageCode | null = null;
  private seq = 0;

  constructor(config: SimulatorConfig = {}) {
    this.fdmId = config.fdmId ?? 'SIM01000001';
    this.fdmSwVersion = config.fdmSwVersion ?? 'sellqo-sim-1.0';
    this.cfg = {
      fdmId: this.fdmId,
      fdmSwVersion: this.fdmSwVersion,
      posAllowList: config.posAllowList ?? [],
      bufferSize: config.bufferSize ?? 10_000,
      now: config.now ?? (() => new Date()),
      signingKey: config.signingKey ?? 'sellqo-fdm-simulator',
      footer: config.footer ?? [SIMULATOR_FOOTER],
      vatNo: config.vatNo,
      estNo: config.estNo,
    };
    for (const [k, v] of Object.entries(config.counters ?? {})) this.counters[k] = v as number;
  }

  /** Zet een blijvende fout (FDM_LOCKED, BUFFER_FULL, FDM_NOT_OPERATIONAL, ...) of null. */
  setFault(code: MessageCode | null) { this.fault = code; }
  /** Simuleert een geslaagde upload naar de FODFIN-cloud: buffer leeg. */
  flushBuffer() { this.buffered = 0; }
  get bufferCapacityUsed(): number { return Math.round((this.buffered / this.cfg.bufferSize) * 10_000) / 100; }
  counter(label: EventLabel | 'total'): number { return this.counters[label] ?? 0; }

  private bump(label: string): number {
    const next = (this.counters[label] ?? 0) >= MAX_COUNTER ? 1 : (this.counters[label] ?? 0) + 1;
    this.counters[label] = next;
    return next;
  }

  private fdmDateTime(): string {
    // Seconden-precisie zoals de voorbeelden (2024-07-29T11:00:08.000Z), maar strikt stijgend.
    const d = this.cfg.now();
    return new Date(Math.floor(d.getTime() / 1000) * 1000).toISOString();
  }

  async sign<N extends MutationName>(name: N, data: AnyFiscalInput, isTraining = false): Promise<SimResponse<SignResult>> {
    const lang: Language = (data as { language?: Language }).language ?? 'EN';
    if (this.fault && this.fault !== 'BUFFER_NEAR_FULL') return { ok: false, errors: [error(this.fault, lang)] };

    const problems = validateMutation(name, data);
    if (problems.length) {
      return { ok: false, errors: [error('INVALID_REQUEST', lang, problems.slice(0, 20).map((p) => ({ name: 'Encountered', value: p })))] };
    }
    const d = data as AnyFiscalInput;
    if (this.cfg.posAllowList.length && !this.cfg.posAllowList.includes(d.posId)) return { ok: false, errors: [error('UNKNOWN_POS', lang)] };
    if (this.buffered >= this.cfg.bufferSize) return { ok: false, errors: [error('BUFFER_FULL', lang)] };

    const label: EventLabel = isTraining ? 'T' : MUTATIONS[name].label;
    const key = [d.posId, d.posDateTime, d.terminalId, label, d.posFiscalTicketNo].join('|');
    const contentHash = canonicalJson({ name, isTraining, data: d });
    const prior = this.byKey.get(key);
    if (prior) {
      if (prior.contentHash === contentHash) return { ok: true, result: structuredClone(prior.result) };
      return { ok: false, errors: [error('INVALID_REQUEST', lang, [{ name: 'Reason', value: 'same key fields, different content' }])] };
    }

    const eventCounter = this.bump(label);
    const totalCounter = this.bump('total');
    const fdmRef = { fdmId: this.fdmId, fdmDateTime: this.fdmDateTime(), eventLabel: label, eventCounter, totalCounter };

    const enc = new TextEncoder();
    const sig = (await digest('SHA-512', enc.encode(`${this.cfg.signingKey}|${contentHash}|${canonicalJson(fdmRef)}|${++this.seq}`)));
    const result: SignResult = {
      posId: d.posId,
      posFiscalTicketNo: d.posFiscalTicketNo,
      posDateTime: d.posDateTime,
      terminalId: d.terminalId,
      deviceId: d.deviceId,
      eventOperation: MUTATIONS[name].operation,
      fdmRef,
      fdmSwVersion: this.fdmSwVersion,
      digitalSignature: toBase64(sig),
      shortSignature: null,
      verificationUrl: null,
      vatCalc: null,
      bufferCapacityUsed: 0,
      warnings: [],
      informations: [],
      footer: [...this.cfg.footer],
    };
    // Enkel een echte verkoop krijgt btw, korte handtekening en QR (zie officiële antwoorden).
    if (name === 'signSale' && !isTraining) {
      const sale = d as SaleInput;
      result.vatCalc = calcVat(totalsPerLabel(sale.transaction), sale.bookingDate);
      result.shortSignature = toHex(await digest('SHA-1', sig));
      result.verificationUrl = VERIFICATION_BASE + encodeVerification(this.fdmId, totalCounter, sig);
    }
    this.buffered += 1;
    result.bufferCapacityUsed = this.bufferCapacityUsed;
    const warnings: MessageItem[] = [];
    if (this.fault === 'BUFFER_NEAR_FULL' || result.bufferCapacityUsed > 70) warnings.push(message('BUFFER_NEAR_FULL', lang));
    if (this.cfg.vatNo && d.vatNo !== this.cfg.vatNo) warnings.push(message('UPDATE_POS_VATNO', lang));
    if (this.cfg.estNo && d.estNo !== this.cfg.estNo) warnings.push(message('UPDATE_POS_ESTNO', lang));
    result.warnings = warnings;

    const stored: StoredEvent = { name, isTraining, data: structuredClone(d), result: structuredClone(result), contentHash };
    this.byKey.set(key, stored);
    this.journal.push(stored);
    return { ok: true, result };
  }

  status(language: Language = 'EN'): FdmStatus {
    const errors: MessageItem[] = [];
    const warnings: MessageItem[] = [];
    if (this.fault === 'BUFFER_NEAR_FULL' || this.bufferCapacityUsed > 70) warnings.push(message('BUFFER_NEAR_FULL', language));
    else if (this.fault) errors.push(message(this.fault, language));
    if (this.buffered >= this.cfg.bufferSize) errors.push(message('BUFFER_FULL', language));
    return {
      device: { fdmId: this.fdmId, fdmSwVersion: this.fdmSwVersion, fdmDateTime: this.fdmDateTime(), bufferCapacityUsed: this.bufferCapacityUsed },
      initialized: true,
      informations: [],
      warnings,
      errors,
    };
  }

  /**
   * GraphQL over HTTP: neemt een body {query, variables} aan zoals een echte FDM. Ondersteunt
   * één of meer sign-mutaties per verzoek (M184: omzet-Z + gebruikers-Z samen), aliassen,
   * fragmenten en __typename, en geeft enkel de gevraagde velden terug.
   */
  async handleGraphQL(body: { query: string; variables?: Record<string, unknown> }): Promise<{ data?: Record<string, unknown> | null; errors?: unknown[] }> {
    const vars = body.variables ?? {};
    let doc: Doc;
    try {
      doc = parseDocument(body.query ?? '');
    } catch (e) {
      return { errors: [{ message: e instanceof Error ? e.message : String(e) }] };
    }
    if (doc.operations.length !== 1) return { errors: [{ message: 'Exactly one operation expected' }] };
    const op = doc.operations[0];
    const arg = (v: ArgValue | undefined, fallback: unknown) => (v === undefined ? fallback : v.kind === 'var' ? (vars[v.name] ?? fallback) : v.value);
    const data: Record<string, unknown> = {};
    const errors: unknown[] = [];
    for (const f of fieldsOf(op.selection, doc.fragments)) {
      if (op.type === 'query') {
        if (f.name !== 'status') { errors.push({ message: `Unknown query field ${f.name}` }); data[f.alias] = null; continue; }
        data[f.alias] = project(this.status(arg(f.args.language, 'EN') as Language), f.selection, 'FdmStatus', doc.fragments);
        continue;
      }
      if (!(f.name in MUTATIONS)) { errors.push({ message: `Unknown mutation ${f.name}` }); data[f.alias] = null; continue; }
      const input = arg(f.args.data, undefined) as AnyFiscalInput;
      const training = Boolean(arg(f.args.isTraining, false));
      const res = await this.sign(f.name as MutationName, input, training);
      if (res.ok) data[f.alias] = project(res.result, f.selection, 'SignResult', doc.fragments);
      else { data[f.alias] = null; errors.push(...res.errors); }
    }
    return errors.length ? { data, errors } : { data };
  }
}
