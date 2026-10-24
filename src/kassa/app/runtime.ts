// PERSONEEL-1 — kassa-runtime: toestel, fiscale modus, tellers en het wegschrijven van events.
//
// Fiscale modus per terminal (pos_terminals.settings.fiscal.mode):
//  - 'off'       : geen zwarte doos. Gebruik voor zaken die niet GKS-plichtig zijn. Niets wordt
//                  ondertekend; aanwezigheid gaat naar fiscal_audit_log (work_in/work_out).
//  - 'simulator' : FDM-simulator in het toestel. Enkel voor test- en demozaken: de events
//                  krijgen een nep-handtekening (fdmId SIM…) en gaan naar fiscal_events.
//  - 'fdm'       : echte zwarte doos (FDM-1). Tot dan geweigerd met een duidelijke melding.
import { supabase } from '@/integrations/supabase/client';
import { bookingDateFor, nextTicketNo, posDateTime, type EventMeta, type PosContext } from '../fiscal/identity';
import { FdmSimulator } from '../fiscal/simulator/fdmSimulator';
import { FiscalSender, MemoryPendingStore, SimulatorGateway, type SignOutcome } from '../fiscal/gateway';
import { MUTATIONS, type AnyFiscalInput, type CostCenterInput, type MutationName, type TicketMedium } from '../fiscal/types';
import { eventCostCenterReference } from './horeca/fiscalLines';
import { KASSA_SW_VERSION } from '../version';

export type FiscalMode = 'off' | 'simulator' | 'fdm';

export interface DeviceConfig {
  tenantId: string;
  terminalRowId: string; // pos_terminals.id
  /** Stabiele toestel-ID (ID-07). In de app later uit Keychain/Keystore. */
  deviceUuid: string;
}

export interface TerminalFiscalSettings {
  mode: FiscalMode;
  /** Btw- en vestigingsnummer van deze vestiging (ID-10). */
  vatNo?: string;
  estNo?: string;
  posId?: string;
  terminalId?: string;
  fdmUrl?: string;
  cutoffHour?: number;
}

const DEVICE_KEY = 'sq_kassa_device';
/** TAFEL-3: afkapuur van de bedrijfsdag (Z), standaard 06:00 — zelfde als public.kassa_cutoff_hour. */
export const DEFAULT_CUTOFF_HOUR = 6;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* privémodus: werkt per sessie */ }
}

export function loadDevice(): DeviceConfig | null {
  const raw = safeGet(DEVICE_KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as DeviceConfig;
    return d.tenantId && d.terminalRowId && d.deviceUuid ? d : null;
  } catch {
    return null;
  }
}

export function saveDevice(tenantId: string, terminalRowId: string): DeviceConfig {
  const prev = loadDevice();
  const d: DeviceConfig = { tenantId, terminalRowId, deviceUuid: prev?.deviceUuid ?? crypto.randomUUID() };
  safeSet(DEVICE_KEY, JSON.stringify(d));
  return d;
}

export function forgetDevice() {
  try { localStorage.removeItem(DEVICE_KEY); } catch { /* niets */ }
}

/** Lees de fiscale instellingen van een terminal; alles wat ontbreekt = 'off'. */
export function fiscalSettingsOf(settings: unknown): TerminalFiscalSettings {
  const f = (settings as { fiscal?: Partial<TerminalFiscalSettings> } | null)?.fiscal ?? {};
  const mode: FiscalMode = f.mode === 'simulator' || f.mode === 'fdm' ? f.mode : 'off';
  return { mode, vatNo: f.vatNo, estNo: f.estNo, posId: f.posId, terminalId: f.terminalId, fdmUrl: f.fdmUrl, cutoffHour: f.cutoffHour ?? DEFAULT_CUTOFF_HOUR };
}

/**
 * bookingPeriodId (ID-09): GUID in kleine letters, voor alle toestellen van de zaak dezelfde
 * per bedrijfsdag. Afgeleid uit tenant + dag (SHA-1, UUID-v5-vorm), zodat geen toestel
 * hoeft te overleggen.
 */
export async function bookingPeriodIdFor(tenantId: string, bookingDate: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`sellqo-booking|${tenantId}|${bookingDate}`))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** posFiscalTicketNo per terminal en label (ID-04), duurzaam op het toestel. */
export function takeTicketNo(posId: string, terminalId: string, label: string): number {
  const key = `sq_kassa_ticketno|${posId}|${terminalId}|${label}`;
  const next = nextTicketNo(Number(safeGet(key) ?? 0) || null);
  safeSet(key, String(next));
  return next;
}

async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class FiscalUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'FiscalUnavailableError'; }
}

/** Eén runtime per aangemeld toestel. */
export class KassaRuntime {
  private sender: FiscalSender | null = null;
  constructor(
    readonly device: DeviceConfig,
    readonly fiscal: TerminalFiscalSettings,
    readonly language: 'NL' | 'FR' | 'DE' | 'EN' = 'NL',
  ) {
    if (fiscal.mode === 'simulator') {
      this.sender = new FiscalSender(new SimulatorGateway(new FdmSimulator({ fdmId: 'SIM01000001' })), new MemoryPendingStore());
    }
  }

  get isFiscal() { return this.fiscal.mode !== 'off'; }

  posContext(): PosContext {
    if (!this.fiscal.posId || !this.fiscal.vatNo || !this.fiscal.estNo) throw new FiscalUnavailableError('fiscal_not_configured');
    return {
      language: this.language,
      vatNo: this.fiscal.vatNo,
      estNo: this.fiscal.estNo,
      posId: this.fiscal.posId,
      posSwVersion: KASSA_SW_VERSION,
      terminalId: this.fiscal.terminalId || this.device.terminalRowId.slice(0, 8),
      deviceId: this.device.deviceUuid,
    };
  }

  async meta(name: MutationName, employeeId: string, ticketMedium: TicketMedium, isTraining = false): Promise<EventMeta> {
    const ctx = this.posContext();
    const now = new Date();
    const bookingDate = bookingDateFor(now, this.fiscal.cutoffHour ?? DEFAULT_CUTOFF_HOUR);
    const label = isTraining ? 'T' : MUTATIONS[name].label;
    return {
      posFiscalTicketNo: takeTicketNo(ctx.posId, ctx.terminalId, label),
      posDateTime: posDateTime(now),
      bookingPeriodId: await bookingPeriodIdFor(this.device.tenantId, bookingDate),
      bookingDate,
      ticketMedium,
      employeeId,
    };
  }

  /**
   * Onderteken en schrijf weg. Gooit bij 'off' (de aanroeper kiest dan het niet-fiscale pad)
   * en bij 'fdm' (nog niet beschikbaar). Bij 'unreachable' blijft het bericht bewaard.
   * `reference` (TAFEL-3): waaraan het event hangt (fiscal_events.cost_center_reference) als het
   * bericht zelf geen costCenter heeft: toogverkoop (de rekening), kas in/uit, telling, rapport.
   */
  async sign(name: MutationName, data: AnyFiscalInput, opts: { staffId?: string; isTraining?: boolean; reference?: string } = {}): Promise<SignOutcome & { eventId?: string }> {
    if (this.fiscal.mode === 'off') throw new FiscalUnavailableError('fiscal_off');
    if (!this.sender) throw new FiscalUnavailableError('fdm_not_available');
    const out = await this.sender.sign(name, data, opts.isTraining ?? false);
    if (out.kind === 'signed') {
      const eventId = crypto.randomUUID();
      const r = out.result;
      const tx = (data as { transaction?: { transactionTotal: number } }).transaction;
      const cc = (data as { costCenter?: CostCenterInput }).costCenter;
      const row = {
        id: eventId,
        tenant_id: this.device.tenantId,
        mutation: name,
        is_training: opts.isTraining ?? false,
        pos_id: data.posId,
        terminal_id: data.terminalId,
        device_id: data.deviceId,
        pos_fiscal_ticket_no: data.posFiscalTicketNo,
        pos_date_time: data.posDateTime,
        pos_sw_version: data.posSwVersion,
        booking_date: data.bookingDate,
        booking_period_id: data.bookingPeriodId,
        staff_id: opts.staffId ?? null,
        fdm_id: r.fdmRef.fdmId,
        fdm_date_time: r.fdmRef.fdmDateTime,
        event_label: r.fdmRef.eventLabel,
        event_operation: r.eventOperation,
        event_counter: r.fdmRef.eventCounter,
        total_counter: r.fdmRef.totalCounter,
        short_signature: r.shortSignature ?? null,
        verification_url: r.verificationUrl ?? null,
        transaction_total_cents: tx ? Math.round(tx.transactionTotal * 100) : null,
        cost_center_reference: eventCostCenterReference(cc) ?? opts.reference ?? null,
        request_body: out.requestBody,
        response_body: out.responseBody,
        request_sha256: await sha256Hex(out.requestBody),
      };
      // Ondertekend is ondertekend: de FDM heeft het. Een mislukte kopie naar de cloud mag de
      // kassa niet stilleggen. TAFEL-2: het event gaat dan in een uitgaande wachtrij op het
      // toestel en wordt opnieuw gestuurd vóór elke betaling of ronde die ernaar verwijst
      // (flushOutbox). Het event-id ligt vast, dus de server kan er later naar verwijzen.
      const { error } = await supabase.from('fiscal_events' as never).insert(row as never);
      if (error && error.code === '23505') {
        // TAFEL-3 (review M4): hetzelfde bericht werd al bewaard (de FDM gaf het eerdere antwoord
        // terug). Dan is de id van die rij de echte, niet de nieuwe.
        const existing = await this.existingEventId(row);
        if (existing) return { ...out, eventId: existing };
      } else if (error) {
        this.pushOutbox(row);
        try { await this.audit('fiscal_store_failed', { code: error.code ?? null, mutation: name, event_id: eventId }); } catch { /* offline */ }
      }
      return { ...out, eventId };
    }
    return out;
  }

  /** Id van een al bewaard event met dezelfde sleutel (fiscal_events_key_uq). */
  private async existingEventId(row: { pos_id: string; pos_date_time: string; terminal_id: string; event_label: string; pos_fiscal_ticket_no: number }): Promise<string | null> {
    try {
      const { data } = await supabase.from('fiscal_events' as never).select('id')
        .eq('tenant_id' as never, this.device.tenantId as never).eq('pos_id' as never, row.pos_id as never)
        .eq('pos_date_time' as never, row.pos_date_time as never).eq('terminal_id' as never, row.terminal_id as never)
        .eq('event_label' as never, row.event_label as never).eq('pos_fiscal_ticket_no' as never, row.pos_fiscal_ticket_no as never).maybeSingle();
      return (data as { id?: string } | null)?.id ?? null;
    } catch { return null; }
  }

  private outboxKey() { return `sq_kassa_fiscal_outbox|${this.device.tenantId}`; }

  private readOutbox(): Record<string, unknown>[] {
    try { return JSON.parse(safeGet(this.outboxKey()) ?? '[]') as Record<string, unknown>[]; } catch { return []; }
  }

  private pushOutbox(row: Record<string, unknown>) {
    const rows = this.readOutbox().filter((r) => r.id !== row.id);
    rows.push(row);
    safeSet(this.outboxKey(), JSON.stringify(rows));
  }

  get outboxCount() { return this.readOutbox().length; }

  private flushing: Promise<boolean> | null = null;

  /**
   * Ondertekende events die nog niet in de cloud staan, opnieuw wegschrijven. true = leeg.
   * Eén tegelijk; na de inserts opnieuw lezen en enkel de gelukte id's weghalen, zodat een
   * event dat intussen bijkwam nooit overschreven wordt.
   */
  flushOutbox(): Promise<boolean> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      const rows = this.readOutbox();
      if (!rows.length) return true;
      const done = new Set<unknown>();
      for (const row of rows) {
        const { error } = await supabase.from('fiscal_events' as never).insert(row as never);
        if (!error || error.code === '23505') done.add(row.id);
      }
      const left = this.readOutbox().filter((r) => !done.has(r.id));
      safeSet(this.outboxKey(), JSON.stringify(left));
      return left.length === 0;
    })().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  async audit(action: string, details: Record<string, unknown> = {}) {
    await supabase.from('fiscal_audit_log' as never).insert({
      tenant_id: this.device.tenantId,
      device_id: this.device.deviceUuid,
      action,
      details,
    } as never);
  }
}
