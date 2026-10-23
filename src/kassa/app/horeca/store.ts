// TAFEL-1 — de rekeningen op het toestel: snapshot van de server + wachtrij van commando's.
//
// Ontwerp §3.2/§3.3:
// - Elke handeling is een commando met een client-UUID; de server (horeca_apply) past het één
//   keer toe, dubbel versturen doet niets.
// - Tikken voelt meteen: add/aantal/annuleren-van-ontwerp worden lokaal toegepast (optimistisch)
//   en elke ~300 ms in één aanroep verstuurd. De wachtrij overleeft herladen (localStorage).
// - Lezen: elke 2 s één getal (horeca_state.version); enkel als dat veranderde de open
//   rekeningen ophalen. Nooit realtime per tabel.
// - Weigert de server een commando, dan verdwijnt het lokaal en krijgt de gebruiker een
//   melding; nooit stil verdwijnen.
// - Versturen, korting, verplaatsen: wachten op de server (geld/fiscaal), geen optimisme.
import { supabase } from '@/integrations/supabase/client';
import type { Check, CheckLine, Snapshot } from './types';

export type CommandKind =
  | 'open_check' | 'add_line' | 'change_qty' | 'set_note' | 'void_line' | 'discount_line'
  | 'send_round' | 'request_bill' | 'rename_check' | 'move_check' | 'move_lines' | 'void_check';

export interface Command { id: string; kind: CommandKind; check_id: string; staff_id?: string | null; [k: string]: unknown }
export interface CommandResult { id: string; ok: boolean; error?: string; code?: string; duplicate?: boolean; check?: Check; target?: Check }

/** Wat het toestel lokaal weet over een product, enkel voor de optimistische weergave. */
export interface ProductHint { name: string; unit_price_cents: number; vat_label: CheckLine['vat_label']; addons?: CheckLine['addons'] }

export type Listener = () => void;
export interface Rejection { command: Command; error: string }

export interface Transport {
  apply(tenantId: string, deviceId: string, cmds: Command[]): Promise<{ version: number; results: CommandResult[] }>;
  snapshot(tenantId: string): Promise<Snapshot>;
  version(tenantId: string): Promise<number>;
}

export const supabaseTransport: Transport = {
  async apply(tenantId, deviceId, cmds) {
    const { data, error } = await supabase.rpc('horeca_apply' as never, { p_tenant_id: tenantId, p_device_id: deviceId, p_commands: cmds } as never);
    if (error) throw error;
    return data as unknown as { version: number; results: CommandResult[] };
  },
  async snapshot(tenantId) {
    const { data, error } = await supabase.rpc('horeca_snapshot' as never, { p_tenant_id: tenantId } as never);
    if (error) throw error;
    return data as unknown as Snapshot;
  },
  async version(tenantId) {
    const { data, error } = await supabase.from('horeca_state' as never).select('version').eq('tenant_id' as never, tenantId as never).maybeSingle();
    if (error) throw error;
    return Number((data as { version?: number } | null)?.version ?? 0);
  },
};

function storageKey(tenantId: string) { return `sq_kassa_queue|${tenantId}`; }

export class HorecaStore {
  private serverChecks = new Map<string, Check>();
  private queue: Command[] = [];
  private hints = new Map<string, ProductHint>();
  private listeners = new Set<Listener>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private failures = 0;
  version = 0;
  online = true;
  lastSyncAt: number | null = null;
  rejections: Rejection[] = [];
  /**
   * TAFEL-2: wordt vóór elk versturen aangeroepen (de runtime schrijft daar ondertekende events
   * weg die nog op het toestel wachten). false = nog niet gelukt: niets versturen, want de
   * server weigert een commando dat naar een onbekend event verwijst.
   */
  beforeFlush: (() => Promise<boolean>) | null = null;

  constructor(readonly tenantId: string, readonly deviceId: string, private readonly transport: Transport = supabaseTransport, private readonly flushDelayMs = 300) {
    try {
      const raw = localStorage.getItem(storageKey(tenantId));
      if (raw) this.queue = JSON.parse(raw);
    } catch { /* geen opslag: wachtrij enkel in geheugen */ }
  }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const fn of this.listeners) fn(); }
  private persist() {
    try { localStorage.setItem(storageKey(this.tenantId), JSON.stringify(this.queue)); } catch { /* idem */ }
  }

  get pendingCount() { return this.queue.length; }

  /** Open rekeningen zoals het toestel ze nu ziet: server + wachtende commando's. */
  get checks(): Check[] {
    const m = new Map<string, Check>();
    for (const [id, c] of this.serverChecks) m.set(id, structuredClone(c));
    for (const cmd of this.queue) applyOptimistic(m, cmd, this.hints);
    return [...m.values()].filter((c) => c.status === 'open').sort((a, b) => a.opened_at.localeCompare(b.opened_at));
  }

  check(id: string): Check | undefined { return this.checks.find((c) => c.id === id); }

  setSnapshot(s: Snapshot) {
    this.serverChecks = new Map(s.checks.map((c) => [c.id, c]));
    this.version = s.version;
    this.lastSyncAt = Date.now();
    this.emit();
  }

  async refresh() {
    try {
      this.setSnapshot(await this.transport.snapshot(this.tenantId));
      this.online = true;
    } catch {
      this.online = false;
      this.emit();
    }
  }

  /** Eén poll-tik: versie ophalen, enkel bij verschil de snapshot. */
  async poll() {
    try {
      const v = await this.transport.version(this.tenantId);
      this.online = true;
      if (v !== this.version) await this.refresh();
      else { this.lastSyncAt = Date.now(); this.emit(); }
    } catch {
      this.online = false;
      this.emit();
    }
    if (this.queue.length) this.scheduleFlush();
  }

  hint(productId: string, h: ProductHint) { this.hints.set(productId, h); }

  /** Lokaal toepassen + in de wachtrij (voor commando's die optimistisch mogen). */
  enqueue(cmd: Command) {
    this.queue.push(cmd);
    this.persist();
    this.emit();
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    const delay = this.failures ? Math.min(30_000, 1000 * 2 ** Math.min(this.failures, 5)) : this.flushDelayMs;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; void this.flush(); }, delay);
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (!this.queue.length) return;
    this.flushing = (async () => {
      const batch = this.queue.slice(0, 50);
      try {
        if (this.beforeFlush && !(await this.beforeFlush())) throw new Error('outbox');
        const res = await this.transport.apply(this.tenantId, this.deviceId, batch);
        this.failures = 0;
        this.online = true;
        const done = new Set(batch.map((c) => c.id));
        for (const r of res.results) {
          const cmd = batch.find((c) => c.id === r.id);
          if (r.ok) {
            if (r.check) this.serverChecks.set(r.check.id, r.check);
            if (r.target) this.serverChecks.set(r.target.id, r.target);
          } else if (cmd) {
            this.rejections.push({ command: cmd, error: r.error ?? 'error' });
          }
        }
        this.queue = this.queue.filter((c) => !done.has(c.id));
        this.persist();
        if (res.version > this.version) {
          // Andere toestellen kunnen intussen ook iets gedaan hebben: volledig verversen.
          await this.refresh();
        } else {
          this.emit();
        }
      } catch {
        this.failures += 1;
        this.online = false;
        this.emit();
      } finally {
        this.flushing = null;
        if (this.queue.length) this.scheduleFlush();
      }
    })();
    return this.flushing;
  }

  /**
   * Commando dat op de server moet wachten (versturen, korting, verplaatsen, rekening).
   * Eerst de wachtrij leegmaken, dan dit commando alleen. Gooit bij geen verbinding.
   */
  async applyNow(cmd: Command): Promise<CommandResult> {
    await this.flush();
    if (this.queue.length) throw new Error('offline');
    if (this.beforeFlush && !(await this.beforeFlush())) throw new Error('offline');
    const res = await this.transport.apply(this.tenantId, this.deviceId, [cmd]);
    const r = res.results[0];
    if (r?.ok) {
      if (r.check) this.serverChecks.set(r.check.id, r.check);
      if (r.target) this.serverChecks.set(r.target.id, r.target);
      if (res.version > this.version) await this.refresh();
      else this.emit();
    }
    return r ?? { id: cmd.id, ok: false, error: 'no_result' };
  }

  takeRejections(): Rejection[] {
    const r = this.rejections;
    this.rejections = [];
    return r;
  }
}

/** Optimistische weergave van één commando op de lokale kopie. Pure functie (getest). */
export function applyOptimistic(m: Map<string, Check>, cmd: Command, hints: Map<string, ProductHint>) {
  if (cmd.kind === 'open_check') {
    if (m.has(cmd.check_id)) return;
    m.set(cmd.check_id, {
      id: cmd.check_id, table_id: (cmd.table_id as string) ?? null, name: (cmd.name as string) ?? null, status: 'open',
      guests: (cmd.guests as number) ?? null, opened_at: new Date().toISOString(), bill_requested_at: null,
      reference: cmd.check_id, version: 0, next_grouping_id: 1, lines: [],
    });
    return;
  }
  const c = m.get(cmd.check_id);
  if (!c) return;
  if (cmd.kind === 'add_line') {
    if (c.lines.some((l) => l.id === cmd.line_id)) return;
    const h = hints.get(cmd.product_id as string);
    const seq = (c.lines.reduce((s, l) => Math.max(s, l.seq), 0) || 0) + 1;
    c.lines.push({
      id: cmd.line_id as string, seq, product_id: cmd.product_id as string, variant_id: (cmd.variant_id as string) ?? null,
      name: h?.name ?? '…', department_id: '', department_name: '', vat_label: h?.vat_label ?? 'A', vat_rate: 0,
      unit_price_cents: h?.unit_price_cents ?? 0, qty: cmd.qty as number, addons: h?.addons ?? [], note: (cmd.note as string) ?? null,
      course: (cmd.course as number) ?? null, station_id: null, state: 'draft', round_id: null, neg_reason: null, corrects_line_id: null,
      price_changes: [], void_reason: null, created_by: cmd.staff_id ?? null, created_at: new Date().toISOString(), open_qty: cmd.qty as number,
      pending: true,
    });
  } else if (cmd.kind === 'change_qty') {
    const l = c.lines.find((x) => x.id === cmd.line_id);
    if (!l || l.state !== 'draft') return;
    if ((cmd.qty as number) === 0) l.state = 'void';
    else { l.qty = cmd.qty as number; l.open_qty = l.qty; }
    l.pending = true;
  } else if (cmd.kind === 'void_line') {
    const l = c.lines.find((x) => x.id === cmd.line_id);
    if (!l) return;
    if (l.state === 'draft') { l.state = 'void'; l.pending = true; }
    else if (l.state === 'sent' && l.qty > 0) {
      const q = (cmd.qty as number) ?? l.open_qty;
      l.open_qty -= q;
      c.lines.push({ ...l, id: cmd.new_line_id as string, seq: l.seq + 0.5, qty: -q, open_qty: 0, state: 'draft', neg_reason: 'CORRECTION', corrects_line_id: l.id, price_changes: [], pending: true });
    }
  } else if (cmd.kind === 'set_note') {
    const l = c.lines.find((x) => x.id === cmd.line_id);
    if (l && l.state === 'draft') { l.note = (cmd.note as string) || null; l.pending = true; }
  } else if (cmd.kind === 'rename_check') {
    c.name = (cmd.name as string) || null;
  }
}
