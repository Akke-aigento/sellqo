/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// BILLING-SAFE-1 — de ECHTE webhook-afboeking (_shared/subscriptionCharge.ts) en de
// afhandeling van een mislukte afschrijving (_shared/billingAlerts.ts) tegen een
// nep-databank die updates en inserts écht uitvoert. Zo is te bewijzen wat in
// productie telt: één betaalverzoek en één melding per mislukte cyclus, één melding
// per betaling, nooit een tweede factuur bij een herpoging, en een bundel die niet
// op 'betaald' gaat zolang een post faalt.
//
// Run: deno test --allow-env --no-lock --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/billingSafe.test.ts
import { handleCycleChargeFailure } from "../../supabase/functions/_shared/billingAlerts.ts";
import { handleSubscriptionChargeWebhook } from "../../supabase/functions/_shared/subscriptionCharge.ts";

type Row = Record<string, any>;

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}

function matchesContains(value: any, wanted: any): boolean {
  if (Array.isArray(wanted)) return Array.isArray(value) && wanted.every((x) => value.includes(x));
  if (!value || typeof value !== "object") return false;
  return Object.entries(wanted).every(([k, v]) => JSON.stringify(value[k]) === JSON.stringify(v));
}

class Q {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "update" | "insert" | "upsert" | "delete" = "select";
  private patch: Row | null = null;
  private rows: Row[] = [];
  private returning = false;
  private singleMode: "one" | "maybe" | null = null;
  private lim: number | null = null;
  private head = false;
  private counting = false;
  constructor(private db: StatefulDb, private table: string) {}
  select(_c?: string, o?: { count?: string; head?: boolean }) {
    if (this.op !== "select") this.returning = true;
    if (o?.count) this.counting = true;
    if (o?.head) this.head = true;
    return this;
  }
  update(p: Row) { this.op = "update"; this.patch = p; return this; }
  insert(r: Row | Row[]) { this.op = "insert"; this.rows = Array.isArray(r) ? r : [r]; return this; }
  // Enkel de vorm die de code gebruikt: onConflict "id", ignoreDuplicates (ON CONFLICT DO NOTHING).
  upsert(r: Row | Row[], o?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    if (o?.onConflict !== "id" || !o.ignoreDuplicates) throw new Error("upsert-vorm niet ondersteund");
    this.op = "upsert"; this.rows = Array.isArray(r) ? r : [r]; return this;
  }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: any) {
    const [col, key] = c.split("->>");
    this.filters.push((r) => String(key ? r[col]?.[key] : r[col]) === String(v));
    return this;
  }
  neq(c: string, v: any) { this.filters.push((r) => String(r[c]) !== String(v)); return this; }
  in(c: string, vs: any[]) { const s = new Set(vs.map(String)); this.filters.push((r) => s.has(String(r[c]))); return this; }
  is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  not(c: string, op: string, v: any) {
    if (op === "in") {
      const s = new Set(String(v).replace(/[()]/g, "").split(",").map((x) => x.trim()));
      this.filters.push((r) => !s.has(String(r[c])));
    } else if (op === "is" && v === null) {
      this.filters.push((r) => r[c] != null);
    } else throw new Error(`not(${op}) niet ondersteund`);
    return this;
  }
  contains(c: string, v: any) { this.filters.push((r) => matchesContains(r[c], v)); return this; }
  order() { return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  single() { this.singleMode = "one"; return this; }
  // deno-lint-ignore no-explicit-any
  then(res: (v: any) => any, rej?: (e: any) => any) { return Promise.resolve(this.run()).then(res, rej); }
  private async run() {
    // Barrière: laat N gelijktijdige aanroepen op dezelfde plek op elkaar wachten.
    const gate = this.db.gates[`${this.table}:${this.op}${this.head ? ":head" : ""}`];
    if (gate) await gate.arrive();
    this.db.calls[`${this.table}:${this.op}`] = (this.db.calls[`${this.table}:${this.op}`] ?? 0) + 1;
    const failure = this.db.fail[`${this.table}:${this.op}`];
    if (failure) return { data: null, error: { message: failure }, count: null };
    const table = (this.db.tables[this.table] ||= []);
    if (this.op === "upsert") {
      const ids = new Set(table.map((r) => r.id));
      for (const r of this.rows) if (!ids.has(r.id)) table.push(structuredClone(r));
      return { data: null, error: null };
    }
    if (this.op === "delete") {
      const keep = table.filter((r) => !this.filters.every((f) => f(r)));
      this.db.tables[this.table] = keep;
      return { data: null, error: null };
    }
    if (this.op === "insert") {
      const added = this.rows.map((r) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...structuredClone(r) }));
      table.push(...added);
      const out = added.map((r) => structuredClone(r));
      return { data: this.singleMode ? out[0] : this.returning ? out : null, error: null };
    }
    const hit = table.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") {
      for (const r of hit) Object.assign(r, structuredClone(this.patch));
      return { data: this.returning ? hit.map((r) => structuredClone(r)) : null, error: null };
    }
    if (this.head) return { data: null, error: null, count: hit.length };
    const sliced = this.lim != null ? hit.slice(0, this.lim) : hit;
    const out = sliced.map((r) => structuredClone(r));
    if (this.singleMode) return { data: out[0] ?? null, error: null };
    return { data: out, error: null, count: this.counting ? hit.length : null };
  }
}

class Gate {
  private waiting: (() => void)[] = [];
  constructor(private n: number) {}
  arrive(): Promise<void> {
    return new Promise((res) => {
      this.waiting.push(res);
      if (this.waiting.length >= this.n) this.waiting.splice(0).forEach((f) => f());
    });
  }
}

class StatefulDb {
  fail: Record<string, string> = {};
  gates: Record<string, Gate> = {};
  calls: Record<string, number> = {};
  invoked: { name: string; body: any }[] = [];
  private seq = 0;
  constructor(public tables: Record<string, Row[]>) {}
  from(t: string) { return new Q(this, t); }
  rpc(fn: string) {
    this.seq += 1;
    if (fn === "generate_payment_request_number") return Promise.resolve({ data: `PR-2026-00${10 + this.seq}`, error: null });
    if (fn === "generate_invoice_number") return Promise.resolve({ data: `INV-2026-0${200 + this.seq}`, error: null });
    return Promise.resolve({ data: null, error: null });
  }
  functions = {
    invoke: (name: string, opts?: { body?: any }) => {
      this.invoked.push({ name, body: opts?.body });
      return Promise.resolve({ data: { success: true }, error: null });
    },
  };
  notifications(type?: string) {
    return (this.tables.notifications ?? []).filter((n) => !type || n.type === type);
  }
}

const TENANT = "11111111-1111-1111-1111-111111111111";
const CUSTOMER = "22222222-2222-2222-2222-222222222222";

function cycle(over: Row = {}): Row {
  return {
    id: "c1",
    tenant_id: TENANT,
    customer_id: CUSTOMER,
    subscription_id: null,
    period_start: "2026-10-27",
    period_end: "2026-11-26",
    subtotal: 29,
    vat_amount: 6.09,
    total: 35.09,
    status: "pending",
    invoice_id: null,
    due_date: null,
    grace_until: null,
    cycle_type: "recurring",
    target_plan_id: null,
    description: "SellQo Starter (27/10/2026 t/m 26/11/2026)",
    payment_request_number: null,
    stripe_payment_intent_id: null,
    lines: [],
    charge_failed_at: null,
    ...over,
  };
}

function db(over: Record<string, Row[]> = {}) {
  return new StatefulDb({
    customers: [{ id: CUSTOMER, company_name: "Astra Sleep" }],
    tenant_subscriptions: [],
    notifications: [],
    invoices: [],
    invoice_lines: [],
    billing_cycles: [cycle()],
    ...over,
  });
}

const HOUR_AGO = Math.floor(Date.now() / 1000) - 3700;

function event(type: string, metadata: Row, extra: Row = {}, created = Math.floor(Date.now() / 1000)): any {
  return { type, created, data: { object: { id: "pi_1", amount: 3509, amount_received: 3509, currency: "eur", metadata, ...extra } } };
}

Deno.test("mislukte afschrijving: één betaalverzoek en één melding, ook als runner én webhook melden", async () => {
  const d = db();
  const first = await handleCycleChargeFailure(d as any, { cycleId: "c1", reason: "onvoldoende saldo", intentId: "pi_1" });
  const second = await handleCycleChargeFailure(d as any, { cycleId: "c1", reason: "onvoldoende saldo", intentId: "pi_1" });
  eq([first.claimed, second.claimed], [true, false], "claim");
  eq(d.invoked.map((i) => i.name), ["dispatch-payment-request"], "betaalverzoek");
  eq(d.tables.billing_cycles[0].payment_request_number, "PR-2026-0011", "PR-nummer bewaard");
  const n = d.notifications("subscription_payment_failed");
  eq(n.length, 1, "één melding");
  eq([n[0].category, n[0].priority], ["subscriptions", "high"], "categorie/prioriteit");
  if (!String(n[0].message).includes("Astra Sleep") || !String(n[0].message).includes("PR-2026-0011")) {
    throw new Error(`melding mist klant of nummer: ${n[0].message}`);
  }
});

Deno.test("mislukte afschrijving op een afgeboekte of geannuleerde cyclus: niets", async () => {
  const d = db({ billing_cycles: [cycle({ status: "settled", invoice_id: "inv" }), cycle({ id: "c2", status: "cancelled" })] });
  const a = await handleCycleChargeFailure(d as any, { cycleId: "c1", reason: null });
  const b = await handleCycleChargeFailure(d as any, { cycleId: "c2", reason: null });
  eq([a.claimed, b.claimed, d.invoked.length, d.notifications().length], [false, false, 0, 0], "geen actie");
});

Deno.test("webhook payment_failed van een mandaat: awaiting_payment + verzoek + melding, één keer", async () => {
  const d = db();
  const ev = event("payment_intent.payment_failed", { billing_cycle_id: "c1", charge_kind: "mandate" }, {
    last_payment_error: { code: "card_declined", decline_code: "insufficient_funds" },
  });
  await handleSubscriptionChargeWebhook(d as any, ev);
  await handleSubscriptionChargeWebhook(d as any, ev); // Stripe-retry
  const c = d.tables.billing_cycles[0];
  eq([c.status, c.charge_failure_reason], ["awaiting_payment", "onvoldoende saldo"], "cyclus");
  eq(d.invoked.filter((i) => i.name === "dispatch-payment-request").length, 1, "één verzoek");
  eq(d.notifications("subscription_payment_failed").length, 1, "één melding");
});

Deno.test("webhook payment_failed via de betaallink (geen mandaat): geen extra verzoek", async () => {
  const d = db();
  await handleSubscriptionChargeWebhook(d as any, event("payment_intent.payment_failed", { billing_cycle_id: "c1" }));
  eq([d.tables.billing_cycles[0].status, d.invoked.length, d.notifications().length], ["awaiting_payment", 0, 0], "stil");
});

Deno.test("geslaagde betaling: één factuur, regels, afgeboekt, één melding 'betaling ontvangen'", async () => {
  const d = db();
  const ev = event("payment_intent.succeeded", { billing_cycle_id: "c1" });
  await handleSubscriptionChargeWebhook(d as any, ev);
  await handleSubscriptionChargeWebhook(d as any, ev); // retry
  eq(d.tables.invoices.length, 1, "één factuur");
  eq(d.tables.invoice_lines.length, 1, "één regel");
  const c = d.tables.billing_cycles[0];
  eq([c.status, c.invoice_id, c.stripe_payment_intent_id], ["settled", d.tables.invoices[0].id, "pi_1"], "afgeboekt");
  eq(d.tables.invoices[0].metadata, { billing_cycle_id: "c1", payment_intent_id: "pi_1" }, "herkenning in metadata");
  const n = d.notifications("payment_received");
  eq(n.length, 1, "één melding");
  eq([n[0].category, n[0].priority], ["payments", "high"], "categorie/prioriteit");
  if (!String(n[0].message).includes("aangemaakt en gemaild")) throw new Error(`mail niet vermeld: ${n[0].message}`);
});

Deno.test("fout na het aanmaken van de factuur: herpoging hergebruikt de factuur", async () => {
  const d = db();
  // Een event van meer dan een uur oud: Stripe probeert al een tijd opnieuw → alarm.
  const ev = event("payment_intent.succeeded", { billing_cycle_id: "c1" }, {}, HOUR_AGO);
  d.fail["invoice_lines:upsert"] = "tijdelijke fout";
  let threw = false;
  try {
    await handleSubscriptionChargeWebhook(d as any, ev);
  } catch {
    threw = true;
  }
  eq(threw, true, "gooit zodat Stripe opnieuw probeert");
  eq(d.tables.billing_cycles[0].status, "pending", "nog niet afgeboekt");
  const alarm = d.notifications("payment_unprocessed");
  eq([alarm.length, alarm[0].priority, alarm[0].category], [1, "urgent", "payments"], "melding 'niet verwerkt'");

  delete d.fail["invoice_lines:upsert"];
  await handleSubscriptionChargeWebhook(d as any, ev);
  eq(d.tables.invoices.length, 1, "geen tweede factuur");
  eq(d.tables.invoice_lines.length, 1, "regels één keer");
  eq(d.tables.billing_cycles[0].status, "settled", "nu afgeboekt");
  eq(d.notifications("payment_unprocessed").length, 0, "alarm opgeruimd na verwerking");
  eq(d.notifications("payment_received").length, 1, "één 'betaling ontvangen'");
});

Deno.test("gelijktijdige levering van dezelfde betaling: geen dubbele regels, geen vals alarm", async () => {
  const d = db();
  const ev = event("payment_intent.succeeded", { billing_cycle_id: "c1" });
  // Poging A maakte de factuur en faalde daarna; B en C komen tegelijk binnen.
  d.fail["invoice_lines:upsert"] = "tijdelijke fout";
  await handleSubscriptionChargeWebhook(d as any, ev).catch(() => {});
  delete d.fail["invoice_lines:upsert"];
  d.calls = {};
  // B en C tellen allebei de regels vóór één van beide invoegt, en boeken pas af
  // nadat beide ingevoegd hebben: het slechtste geval.
  d.gates["invoice_lines:select:head"] = new Gate(2);
  d.gates["invoice_lines:upsert"] = new Gate(2);
  await Promise.all([handleSubscriptionChargeWebhook(d as any, ev), handleSubscriptionChargeWebhook(d as any, ev)]);
  eq(d.calls["invoice_lines:upsert"], 2, "beide pogingen voegden regels in");
  eq(d.tables.invoices.length, 1, "één factuur");
  eq(d.tables.invoice_lines.length, 1, "één regel (vaste regel-id)");
  eq(d.calls["billing_cycles:update"] >= 2, true, "beide probeerden af te boeken");
  eq(d.notifications("payment_duplicate").length, 0, "geen 'dubbele factuur' (race-tak herkende dezelfde factuur)");
  eq(d.tables.billing_cycles[0].status, "settled", "afgeboekt");
});

Deno.test("tijdelijke fout binnen het uur: geen alarm 'niet verwerkt'", async () => {
  const d = db();
  d.fail["invoice_lines:upsert"] = "tijdelijke fout";
  await handleSubscriptionChargeWebhook(d as any, event("payment_intent.succeeded", { billing_cycle_id: "c1" })).catch(() => {});
  eq(d.notifications("payment_unprocessed").length, 0, "geen alarm");
});

Deno.test("alarm blijft staan als de post intussen verdween (event gedropt)", async () => {
  const d = db();
  const ev = event("payment_intent.succeeded", { billing_cycle_id: "c1" }, {}, HOUR_AGO);
  d.fail["invoice_lines:upsert"] = "tijdelijke fout";
  await handleSubscriptionChargeWebhook(d as any, ev).catch(() => {});
  eq(d.notifications("payment_unprocessed").length, 1, "alarm");
  delete d.fail["invoice_lines:upsert"];
  d.tables.billing_cycles = [];
  eq(await handleSubscriptionChargeWebhook(d as any, ev), true, "webhook antwoordt ok");
  eq(d.notifications("payment_unprocessed").length, 1, "alarm blijft");
});

Deno.test("bundel met een falende post: niet op betaald, gooit, en herpoging boekt alles af", async () => {
  const d = db({
    billing_cycles: [cycle({ payment_request_number: "PR-2026-0004" })],
    invoices: [{ id: "inv-dom", tenant_id: TENANT, customer_id: CUSTOMER, invoice_number: "SQ-2026-0001", status: "sent", metadata: {} }],
    payment_bundles: [{
      id: "b1",
      tenant_id: TENANT,
      customer_id: CUSTOMER,
      status: "open",
      payment_intent_id: null,
      items: [{ type: "cycle", id: "c1", number: "PR-2026-0004" }, { type: "invoice", id: "inv-dom", number: "SQ-2026-0001" }],
    }],
  });
  const ev = event("payment_intent.succeeded", { payment_bundle_id: "b1" }, { amount: 9559, amount_received: 9559 }, HOUR_AGO);
  d.fail["invoices:update"] = "tijdelijke fout";
  let threw = false;
  try {
    await handleSubscriptionChargeWebhook(d as any, ev);
  } catch {
    threw = true;
  }
  eq(threw, true, "gooit");
  eq(d.tables.payment_bundles[0].status, "open", "bundel niet betaald");

  delete d.fail["invoices:update"];
  await handleSubscriptionChargeWebhook(d as any, ev);
  eq(d.tables.payment_bundles[0].status, "paid", "bundel betaald");
  eq(d.tables.invoices.find((i) => i.id === "inv-dom")!.status, "paid", "domeinfactuur betaald");
  eq(d.tables.invoices.filter((i) => i.metadata?.billing_cycle_id === "c1").length, 1, "één cyclusfactuur");
  const paid = d.notifications("payment_received");
  eq(paid.length, 1, "één melding voor de bundel");
  eq(d.notifications("payment_unprocessed").length, 0, "alarm van de eerste poging opgeruimd");
  if (!String(paid[0].message).includes("PR-2026-0004 en SQ-2026-0001")) throw new Error(`posten ontbreken: ${paid[0].message}`);
});
