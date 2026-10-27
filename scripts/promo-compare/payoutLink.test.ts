/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen en Stripe-objecten */
// PAYOUT-LINK-1 — koppeling Stripe-uitbetaling → SellQo-factuur → Odoo-notitie, tegen een
// nep-databank, nep-Stripe en nep-Odoo. Bewijst: elke betaling vindt haar factuur (order,
// betaalverzoek, bundel, creditnota bij terugbetaling); één notitie per boeking, ook bij een
// herhaalde run of een crash na het posten; Referentie wordt aangevuld, nooit overschreven,
// en niet aangeraakt bij een openstaande handmatige Peppol-verzending; een factuur die nog
// niet in Odoo staat wordt later alsnog gedaan; een proefrun schrijft niets.
//
// Run: deno test --no-lock scripts/promo-compare/payoutLink.test.ts
import { StatefulDb, type Row } from "./statefulDb.ts";
import {
  buildNote, dateNl, eur, extractTxn, linkTenantPayouts, mergeRef,
  type OdooApi, type OdooMove, type PayoutLite, type StripeApi, type TxnLite,
} from "../../supabase/functions/_shared/payoutLink.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
}
function ok(v: unknown, msg: string) { if (!v) throw new Error(msg); }

const T = "tenant-vx";

class FakeStripe implements StripeApi {
  payouts: PayoutLite[] = [];
  txns: Record<string, TxnLite[]> = {};
  sessions: Record<string, string[]> = {};
  txnCalls = 0;
  listPaidPayouts(_since: number, max: number) { return Promise.resolve(this.payouts.slice(0, max)); }
  listPayoutTxns(id: string) { this.txnCalls++; return Promise.resolve(this.txns[id] ?? []); }
  checkoutSessionIdsForPi(pi: string) { return Promise.resolve(this.sessions[pi] ?? []); }
}

class FakeOdoo implements OdooApi {
  moves = new Map<number, OdooMove>();
  notes: { id: number; body: string }[] = [];
  refWrites: { id: number; ref: string }[] = [];
  failPost = false;
  add(id: number, name: string, ref: string | false = false) { this.moves.set(id, { id, name, ref, state: "posted" }); return this; }
  readMoves(ids: number[]) { return Promise.resolve(ids.map((i) => this.moves.get(i)).filter(Boolean) as OdooMove[]); }
  writeRef(id: number, ref: string) { this.refWrites.push({ id, ref }); this.moves.get(id)!.ref = ref; return Promise.resolve(); }
  countNotes(id: number, marker: string) { return Promise.resolve(this.notes.filter((n) => n.id === id && n.body.includes(marker)).length); }
  postNote(id: number, body: string) {
    if (this.failPost) return Promise.reject(new Error("Odoo down"));
    this.notes.push({ id, body }); return Promise.resolve();
  }
}

const txn = (id: string, type: string, amount: number, fee: number, extra: Partial<TxnLite> = {}): TxnLite => ({
  id, type, amount, fee, stripe_fee: fee - (extra.app_fee ?? 0), app_fee: 0, net: amount - fee, currency: "eur",
  payment_intent: null, charge_id: null, refund_id: null, description: null, metadata: {}, ...extra,
});

const payout = (id: string, amount: number, extra: Partial<PayoutLite> = {}): PayoutLite =>
  ({ id, amount, currency: "eur", arrival_date: 1756800000, status: "paid", automatic: true, ...extra });

/** Nep-databank die, zoals Postgres zonder FK-uitstel per aanroep, een regel zonder bestaande
 *  uitbetaling weigert (vangt de volgorde payout → items). */
class FkDb extends StatefulDb {
  override from(t: string) {
    const q: any = super.from(t);
    if (t !== "stripe_payout_items") return q;
    const orig = q.insert.bind(q);
    q.insert = (r: any) => {
      for (const row of Array.isArray(r) ? r : [r]) {
        if (!(this.tables.stripe_payouts ?? []).some((p) => p.payout_id === row.payout_id)) {
          throw new Error(`FK: stripe_payouts ${row.payout_id} bestaat nog niet`);
        }
      }
      return orig(r);
    };
    return q;
  }
}

function baseDb(extra: Record<string, Row[]> = {}) {
  return new FkDb({
    orders: [
      { id: "o1", tenant_id: T, stripe_payment_intent_id: "pi_A" },
      { id: "o2", tenant_id: T, stripe_payment_intent_id: "pi_B" },
    ],
    invoices: [
      { id: "i1", tenant_id: T, order_id: "o1", invoice_number: "INV-1", status: "paid" },
      { id: "i2", tenant_id: T, order_id: "o2", invoice_number: "INV-2", status: "paid" },
      { id: "i2x", tenant_id: T, order_id: "o2", invoice_number: "INV-2-OUD", status: "cancelled" },
    ],
    credit_notes: [],
    billing_cycles: [],
    payment_bundles: [],
    odoo_invoice_sync_log: [
      { tenant_id: T, invoice_id: "i1", sync_status: "synced", odoo_move_id: "501", peppol_status: "skipped", synced_at: "2026-09-01" },
      { tenant_id: T, invoice_id: "i2", sync_status: "failed", odoo_move_id: null, synced_at: "2026-09-02" },
      { tenant_id: T, invoice_id: "i2", sync_status: "synced", odoo_move_id: "502", peppol_status: "sent", synced_at: "2026-09-03" },
    ],
    stripe_payouts: [],
    stripe_payout_items: [],
    ...extra,
  });
}

const NOW_MS = 1756800000_000 + 2 * 86400_000; // twee dagen na de uitbetalingen
function run(db: StatefulDb, stripe: FakeStripe, odoo: OdooApi | null, dryRun = false, extra: { nowMs?: () => number; deadline?: number } = {}) {
  return linkTenantPayouts({
    db, stripe, odoo, tenantId: T, stripeAccount: "acct_vx", sinceUnix: 0, maxPayouts: 50, dryRun,
    now: () => "2026-10-27T12:00:00Z", nowMs: extra.nowMs ?? (() => NOW_MS), deadline: extra.deadline,
  });
}

Deno.test("twee orderbetalingen: notitie op elke boeking, Referentie gezet, uitbetaling done; tweede run doet niets", async () => {
  const db = baseDb();
  const s = new FakeStripe();
  s.payouts = [payout("po_1", 16134)];
  s.txns.po_1 = [
    txn("txn_a", "charge", 13500, 50, { payment_intent: "pi_A" }),
    txn("txn_b", "payment", 2691, 7, { payment_intent: "pi_B" }),
    txn("txn_p", "payout", -16134, 0),
  ];
  const o = new FakeOdoo().add(501, "INV-1").add(502, "INV-2", "PO 77");

  const r = await run(db, s, o);
  eq([r.txns, r.txns_linked, r.notes_posted, r.refs_written], [2, 2, 2, 2], "telling");
  eq(o.moves.get(501)!.ref, "Stripe po_1", "lege Referentie");
  eq(o.moves.get(502)!.ref, "PO 77 · Stripe po_1", "bestaande Referentie aangevuld");
  ok(o.notes[0].body.includes("Stripe-uitbetaling po_1") && o.notes[0].body.includes("Zelfde uitbetaling: INV-2"), "notitie 501");
  ok(o.notes[1].body.includes("Zelfde uitbetaling: INV-1") && !o.notes[1].body.includes("INV-2-OUD"), "geannuleerde factuur niet mee");
  eq(db.tables.stripe_payouts.map((p) => [p.payout_id, p.odoo_status, p.linked_count, p.txn_count]), [["po_1", "done", 2, 2]], "payout-rij");
  eq(db.tables.stripe_payout_items.map((i) => [i.balance_txn_id, i.document_number, i.odoo_move_id, !!i.odoo_noted_at]),
    [["txn_a", "INV-1", "501", true], ["txn_b", "INV-2", "502", true]], "items");

  const calls = s.txnCalls;
  const r2 = await run(db, s, o);
  eq([r2.payouts_skipped_done, r2.notes_posted, s.txnCalls], [1, 0, calls], "tweede run slaat over");
  eq(o.notes.length, 2, "geen dubbele notities");
});

Deno.test("bundelbetaling (betaalverzoek + factuur) en terugbetaling met creditnota", async () => {
  const db = baseDb({
    invoices: [
      { id: "i3", tenant_id: T, invoice_number: "SQ-12", status: "paid" },
      { id: "i4", tenant_id: T, invoice_number: "SQ-01", status: "paid" },
      { id: "i5", tenant_id: T, invoice_number: "SQ-05", status: "paid" },
    ],
    billing_cycles: [{ id: "c1", tenant_id: T, invoice_id: "i3", stripe_payment_intent_id: null }],
    payment_bundles: [{ tenant_id: T, payment_intent_id: "pi_C", items: [{ type: "cycle", id: "c1" }, { type: "invoice", id: "i4" }] }],
    credit_notes: [{ id: "cn1", tenant_id: T, credit_note_number: "CN-3", status: "sent", stripe_refund_id: "re_1" }],
    odoo_invoice_sync_log: [
      { tenant_id: T, invoice_id: "i3", sync_status: "synced", odoo_move_id: "701", peppol_status: "skipped", synced_at: "x" },
      { tenant_id: T, invoice_id: "i4", sync_status: "synced", odoo_move_id: "702", peppol_status: "skipped", synced_at: "x" },
      { tenant_id: T, credit_note_id: "cn1", sync_status: "synced", odoo_move_id: "801", peppol_status: "skipped", synced_at: "x" },
    ],
  });
  const s = new FakeStripe();
  s.payouts = [payout("po_2", 8000)];
  s.txns.po_2 = [
    txn("txn_c", "charge", 9559, 159, { payment_intent: "pi_C" }),
    txn("txn_r", "refund", -1400, 0, { payment_intent: "pi_X", refund_id: "re_1" }),
  ];
  const o = new FakeOdoo().add(701, "SQ-12").add(702, "SQ-01").add(801, "CN-3", "creditnota voor SQ-05");
  const r = await run(db, s, o);
  eq([r.txns_linked, r.notes_posted], [2, 3], "bundel = 2 boekingen + creditnota");
  ok(o.notes.find((n) => n.id === 801)!.body.includes("Terugbetaling −€14,00"), "terugbetaling in notitie");
  eq(o.moves.get(801)!.ref, "creditnota voor SQ-05 · Stripe po_2", "creditnota-Referentie aangevuld");
  eq(db.tables.stripe_payouts[0].odoo_status, "done", "done");
});

Deno.test("factuur nog niet in Odoo: partial, later alsnog; niet-koppelbare betaling = gaps", async () => {
  const db = baseDb({ odoo_invoice_sync_log: [{ tenant_id: T, invoice_id: "i1", sync_status: "synced", odoo_move_id: "501", peppol_status: "skipped", synced_at: "x" }] });
  const s = new FakeStripe();
  s.payouts = [payout("po_3", 20000)];
  s.txns.po_3 = [
    txn("txn_a", "charge", 13500, 50, { payment_intent: "pi_A" }),
    txn("txn_b", "charge", 2691, 7, { payment_intent: "pi_B" }),
    txn("txn_z", "charge", 4000, 60, { payment_intent: "pi_ONBEKEND", description: "Payment for something" }),
  ];
  const o = new FakeOdoo().add(501, "INV-1").add(502, "INV-2");
  const r = await run(db, s, o);
  eq([r.waiting_for_odoo, r.txns_unlinked, r.notes_posted], [1, 1, 1], "één wacht, één onbekend");
  eq(db.tables.stripe_payouts[0].odoo_status, "partial", "partial");
  eq(db.tables.stripe_payouts[0].unlinked.map((u: any) => u.payment_intent), ["pi_ONBEKEND"], "onbekende betaling bewaard");

  db.tables.odoo_invoice_sync_log.push({ tenant_id: T, invoice_id: "i2", sync_status: "synced", odoo_move_id: "502", peppol_status: "skipped", synced_at: "y" });
  const r2 = await run(db, s, o);
  eq([r2.notes_posted, o.notes.length], [1, 2], "alleen de nieuwe boeking krijgt een notitie");
  eq(db.tables.stripe_payouts.length, 1, "geen tweede payout-rij");
  eq(db.tables.stripe_payouts[0].odoo_status, "gaps", "nu gaps (alles genoteerd, één onbekend)");
  eq(db.tables.stripe_payout_items.length, 3, "geen dubbele items");
});

Deno.test("checkout-sessie als laatste koppeling", async () => {
  const db = baseDb({
    invoices: [{ id: "i9", tenant_id: T, invoice_number: "INV-9", status: "paid", checkout_session_id: "cs_9" }],
    odoo_invoice_sync_log: [{ tenant_id: T, invoice_id: "i9", sync_status: "synced", odoo_move_id: "909", peppol_status: "skipped", synced_at: "x" }],
  });
  const s = new FakeStripe();
  s.payouts = [payout("po_9", 1000)];
  s.txns.po_9 = [txn("txn_9", "charge", 1000, 0, { payment_intent: "pi_9" })];
  s.sessions.pi_9 = ["cs_9"];
  const o = new FakeOdoo().add(909, "INV-9");
  const r = await run(db, s, o);
  eq([r.txns_linked, r.notes_posted], [1, 1], "via sessie gekoppeld");
});

Deno.test("Peppol nog handmatig te versturen (of onbekend): wel notitie, geen Referentie", async () => {
  const db = baseDb();
  db.tables.odoo_invoice_sync_log[0].peppol_status = "manual";
  const s = new FakeStripe();
  s.payouts = [payout("po_4", 13450)];
  s.txns.po_4 = [txn("txn_a", "charge", 13500, 50, { payment_intent: "pi_A" })];
  const o = new FakeOdoo().add(501, "INV-1");
  const r = await run(db, s, o);
  eq([r.notes_posted, r.refs_written, r.refs_skipped_peppol], [1, 0, 1], "enkel notitie");
  eq(o.moves.get(501)!.ref, false, "Referentie onaangeroerd");
});

Deno.test("crash na het posten: geen tweede notitie; Odoo-fout = partial en herpoging", async () => {
  const db = baseDb();
  const s = new FakeStripe();
  s.payouts = [payout("po_5", 13450)];
  s.txns.po_5 = [txn("txn_a", "charge", 13500, 50, { payment_intent: "pi_A" })];
  const o = new FakeOdoo().add(501, "INV-1");
  o.notes.push({ id: 501, body: "Stripe-uitbetaling po_5 … (van een vorige, onderbroken run)" });
  const r = await run(db, s, o);
  eq([r.notes_posted, o.notes.length, r.refs_written], [0, 1, 1], "bestaande notitie herkend, Referentie wel gezet");

  const db2 = baseDb();
  const o2 = new FakeOdoo().add(501, "INV-1");
  o2.failPost = true;
  const r2 = await run(db2, s, o2);
  eq([r2.errors.length, db2.tables.stripe_payouts[0].odoo_status], [1, "partial"], "fout → partial");
  ok(db2.tables.stripe_payout_items[0].error.includes("Odoo down"), "fout bewaard");
  o2.failPost = false;
  const r3 = await run(db2, s, o2);
  eq([r3.notes_posted, db2.tables.stripe_payouts[0].odoo_status], [1, "done"], "herpoging lukt");
});

Deno.test("proefrun schrijft niets", async () => {
  const db = baseDb();
  const s = new FakeStripe();
  s.payouts = [payout("po_6", 16134)];
  s.txns.po_6 = [txn("txn_a", "charge", 13500, 50, { payment_intent: "pi_A" })];
  const o = new FakeOdoo().add(501, "INV-1");
  const r = await run(db, s, o, true);
  eq([o.notes.length, o.refWrites.length, db.tables.stripe_payouts.length, db.tables.stripe_payout_items.length], [0, 0, 0, 0], "niets geschreven");
  const plan = r.plan as any[];
  eq([plan[0].payout, plan[0].status_would_be, plan[0].odoo[0].ref_to], ["po_6", "done", "Stripe po_6"], "plan");
});

Deno.test("zonder Odoo: koppeling bewaard, status partial, geen fout", async () => {
  const db = baseDb();
  const s = new FakeStripe();
  s.payouts = [payout("po_7", 13450)];
  s.txns.po_7 = [txn("txn_a", "charge", 13500, 50, { payment_intent: "pi_A" })];
  const r = await run(db, s, null);
  eq([r.errors.length, db.tables.stripe_payouts[0].odoo_status, db.tables.stripe_payout_items[0].document_number], [0, "partial", "INV-1"], "bewaard");
});

Deno.test("puur: extractTxn, mergeRef, eur, datum, notitie", () => {
  const c = extractTxn({ id: "txn_1", type: "charge", amount: 1995, fee: 54, net: 1941, currency: "eur",
    source: { object: "charge", id: "ch_1", payment_intent: "pi_1", metadata: { order_id: "o" }, description: "x" } });
  eq([c.charge_id, c.payment_intent, c.metadata.order_id], ["ch_1", "pi_1", "o"], "charge");
  const rf = extractTxn({ id: "txn_2", type: "refund", amount: -500, fee: 0, net: -500,
    source: { object: "refund", id: "re_1", charge: { id: "ch_1" }, payment_intent: { id: "pi_1" } } });
  eq([rf.refund_id, rf.charge_id, rf.payment_intent], ["re_1", "ch_1", "pi_1"], "refund");
  eq(extractTxn({ id: "t", type: "charge", source: "ch_9" }).charge_id, "ch_9", "niet-uitgeklapte bron");
  eq(mergeRef(false, "po_1"), "Stripe po_1", "leeg");
  eq(mergeRef("  ", "po_1"), "Stripe po_1", "spaties");
  eq(mergeRef("Stripe po_1", "po_1"), null, "al aanwezig");
  eq(mergeRef("A · Stripe po_1", "po_2"), "A · Stripe po_1 · Stripe po_2", "tweede uitbetaling (deelbetaling)");
  eq([eur(13493), eur(-1400), eur(123456789)], ["€134,93", "−€14,00", "€1.234.567,89"], "eur");
  eq(dateNl(1756800000), "02-09-2025", "datum Brussel");
  const note = buildNote({ payout: payout("po_x", 100), txnCount: 1, txns: [txn("t", "charge", 100, 3, { payment_intent: "pi" })], otherNumbers: [] });
  eq(note, "Stripe-uitbetaling po_x, op de bank op 02-09-2025: €1,00 (1 transactie). Betaling €1,00, Stripe-kosten €0,03, netto €0,97 (pi). Automatisch toegevoegd door SellQo.", "notitie");
});

Deno.test("Peppol-status onbekend (NULL) in het sync-log: geen Referentie", async () => {
  const db = baseDb();
  db.tables.odoo_invoice_sync_log[0].peppol_status = null;
  const s = new FakeStripe();
  s.payouts = [payout("po_n", 13450)];
  s.txns.po_n = [txn("txn_a", "charge", 13500, 50, { payment_intent: "pi_A" })];
  const o = new FakeOdoo().add(501, "INV-1");
  const r = await run(db, s, o);
  eq([r.notes_posted, r.refs_written], [1, 0], "enkel notitie");
});

Deno.test("terugbetaling zonder creditnota: niet op de originele factuur, later wel bij de creditnota", async () => {
  const db = baseDb();
  const s = new FakeStripe();
  s.payouts = [payout("po_r", -1400)];
  s.txns.po_r = [txn("txn_r", "refund", -1400, 0, { payment_intent: "pi_A", refund_id: "re_9" })];
  const o = new FakeOdoo().add(501, "INV-1").add(990, "CN-9");
  const r = await run(db, s, o);
  eq([r.txns_unlinked, r.notes_posted, db.tables.stripe_payouts[0].odoo_status], [1, 0, "gaps"], "ongekoppeld, geen notitie op INV-1");
  db.tables.credit_notes.push({ id: "cn9", tenant_id: T, credit_note_number: "CN-9", status: "sent", stripe_refund_id: "re_9" });
  db.tables.odoo_invoice_sync_log.push({ tenant_id: T, credit_note_id: "cn9", sync_status: "synced", odoo_move_id: "990", peppol_status: "skipped", synced_at: "z" });
  const r2 = await run(db, s, o);
  eq([r2.notes_posted, o.notes[0].id, db.tables.stripe_payouts[0].odoo_status], [1, 990, "done"], "nu bij de creditnota");
});

Deno.test("handmatige uitbetaling overgeslagen; oude gaps niet meer herbekeken; tijdsbudget", async () => {
  const db = baseDb();
  db.tables.stripe_payouts.push({ tenant_id: T, payout_id: "po_old", odoo_status: "gaps" });
  const s = new FakeStripe();
  s.payouts = [
    payout("po_man", 500, { automatic: false }),
    payout("po_old", 500), // arrival 2 dagen terug: nog binnen het venster
    payout("po_a", 13450),
  ];
  s.txns.po_old = [txn("txn_x", "charge", 500, 0, { payment_intent: "pi_ONBEKEND" })];
  s.txns.po_a = [txn("txn_a", "charge", 13500, 50, { payment_intent: "pi_A" })];
  const o = new FakeOdoo().add(501, "INV-1");
  const r = await run(db, s, o);
  eq([r.payouts_skipped_manual, r.payouts_processed, r.payouts_skipped_gaps_old], [1, 2, 0], "binnen venster");
  const later = await run(db, s, o, false, { nowMs: () => NOW_MS + 10 * 86400_000 });
  eq([later.payouts_skipped_gaps_old, later.payouts_skipped_done, later.payouts_processed], [1, 1, 0], "na 7 dagen niet meer");

  const db2 = baseDb();
  const r3 = await run(db2, s, o, false, { deadline: NOW_MS - 1 });
  eq([r3.truncated, r3.payouts_processed], [true, 0], "budget op");
});

Deno.test("platformfee apart van de Stripe-kosten in de notitie", async () => {
  const t = extractTxn({ id: "txn", type: "charge", amount: 2000, fee: 130, net: 1870,
    fee_details: [{ type: "stripe_fee", amount: 80 }, { type: "application_fee", amount: 50 }],
    source: { object: "charge", id: "ch", payment_intent: "pi" } });
  eq([t.stripe_fee, t.app_fee], [80, 50], "verdeling");
  const note = buildNote({ payout: payout("po_f", 1870), txnCount: 1, txns: [t], otherNumbers: [] });
  ok(note.includes("Stripe-kosten €0,80, SellQo-platformfee €0,50, netto €18,70"), note);
});

Deno.test("bundel over twee boekingen, tweede faalt: transactie niet afgewerkt, herpoging doet enkel de tweede", async () => {
  const db = baseDb({
    invoices: [
      { id: "i3", tenant_id: T, invoice_number: "SQ-12", status: "paid" },
      { id: "i4", tenant_id: T, invoice_number: "SQ-01", status: "paid" },
    ],
    payment_bundles: [{ tenant_id: T, payment_intent_id: "pi_C", items: [{ type: "invoice", id: "i3" }, { type: "invoice", id: "i4" }] }],
    odoo_invoice_sync_log: [
      { tenant_id: T, invoice_id: "i3", sync_status: "synced", odoo_move_id: "701", peppol_status: "skipped", synced_at: "x" },
      { tenant_id: T, invoice_id: "i4", sync_status: "synced", odoo_move_id: "702", peppol_status: "skipped", synced_at: "x" },
    ],
  });
  const s = new FakeStripe();
  s.payouts = [payout("po_b", 9500)];
  s.txns.po_b = [txn("txn_c", "charge", 9559, 59, { payment_intent: "pi_C" })];
  const o = new FakeOdoo().add(701, "SQ-12").add(702, "SQ-01");
  const realPost = o.postNote.bind(o);
  o.postNote = (id: number, body: string) => id === 702 ? Promise.reject(new Error("702 kapot")) : realPost(id, body);
  await run(db, s, o);
  eq([db.tables.stripe_payout_items[0].odoo_noted_at ?? null, db.tables.stripe_payouts[0].odoo_status], [null, "partial"], "niet afgewerkt");
  o.postNote = realPost;
  const r2 = await run(db, s, o);
  eq([r2.notes_posted, o.notes.map((n) => n.id), db.tables.stripe_payouts[0].odoo_status], [1, [701, 702], "done"], "enkel 702 erbij");
  const r3 = await run(db, s, o);
  eq(r3.payouts_skipped_done, 1, "daarna klaar");
});

Deno.test("Peppol-autoverzending uit: 'skipped' telt niet als afgehandeld", async () => {
  const db = baseDb();
  const s = new FakeStripe();
  s.payouts = [payout("po_q", 13450)];
  s.txns.po_q = [txn("txn_a", "charge", 13500, 50, { payment_intent: "pi_A" })];
  const o = new FakeOdoo().add(501, "INV-1");
  const r = await linkTenantPayouts({ db, stripe: s, odoo: o, tenantId: T, stripeAccount: "acct_vx", sinceUnix: 0, maxPayouts: 50, dryRun: false, peppolAutoSend: false, nowMs: () => NOW_MS });
  eq([r.notes_posted, r.refs_written], [1, 0], "enkel notitie");
});
