// PAYOUT-LINK-1 — bij welke Stripe-uitbetaling hoort een factuur?
//
// Op de bank komt één Stripe-uitbetaling binnen (bv. "STRIPE VANXCEL €134,93"): een reeks
// betalingen min de Stripe-kosten. De boekhouder (Pieter, Finobi) boekt die tegen 582100 en
// moest zelf uitzoeken welke facturen erin zaten. Stripe weet het: per uitbetaling de
// balance transactions, per transactie de betaling (payment intent). SellQo weet bij welke
// factuur die betaling hoort. Dit bestand legt die koppeling en zet ze in Odoo:
//   - een logboeknotitie (chatter) op de geboekte factuur/creditnota;
//   - "Stripe po_…" in het veld Referentie, zodat Pieter in de bankafstemming op het
//     uitbetalingsnummer kan zoeken.
// Er worden GEEN boekingen of betalingen in Odoo gemaakt (keuze Akke 27-10). De
// gestructureerde mededeling (payment_reference, OGM) blijft onaangeroerd.
//
// Voorzichtig met Referentie: Odoo stuurt `ref` mee als kopersreferentie in een
// Peppol-factuur. Referentie wordt enkel aangevuld als de Odoo-sync de Peppol-status van
// die boeking als 'sent' of 'skipped' vastlegde (odoo_invoice_sync_log); in elk ander geval
// (handmatig te versturen, onbekend) alleen de notitie.
//
// Terugbetalingen horen bij een creditnota. Zonder creditnota (nog niet gemaakt, of
// terugbetaald in het Stripe-dashboard) blijft de transactie ongekoppeld, zodat ze later
// alsnog bij de creditnota komt in plaats van vast te zitten op de originele factuur.
//
// Handmatige uitbetalingen: Stripe geeft hun transacties niet per uitbetaling; ze worden
// overgeslagen en geteld.
//
// Idempotent: per (uitbetaling, Odoo-boeking) één notitie; vóór het plaatsen wordt
// gecontroleerd of er al een notitie met het uitbetalingsnummer staat.
//
// Puur op de randen na: Stripe, Odoo en de databank komen binnen als parameters, zodat de
// tests zonder netwerk draaien (scripts/promo-compare/payoutLink.test.ts).

/* eslint-disable @typescript-eslint/no-explicit-any -- Stripe- en databankrijen zijn ongetypeerd */

export const PAYOUT_LINK_VERSION = "PAYOUT-LINK-1";

export interface PayoutLite {
  id: string;
  amount: number; // centen
  currency: string;
  arrival_date: number; // unix
  status: string;
  automatic: boolean;
}

export interface TxnLite {
  id: string;
  type: string;
  amount: number; // centen, bruto (negatief bij terugbetaling)
  fee: number; // centen, alle kosten samen
  stripe_fee: number; // centen, Stripe zelf
  app_fee: number; // centen, platformfee van SellQo (application fee)
  net: number; // centen
  currency: string;
  payment_intent: string | null;
  charge_id: string | null;
  refund_id: string | null;
  description: string | null;
  metadata: Record<string, string>;
}

export interface StripeApi {
  listPaidPayouts(sinceUnix: number, max: number): Promise<PayoutLite[]>;
  listPayoutTxns(payoutId: string): Promise<TxnLite[]>;
  checkoutSessionIdsForPi(paymentIntentId: string): Promise<string[]>;
}

export interface OdooMove {
  id: number;
  name: string;
  ref: string | false | null;
  state: string;
}

export interface OdooApi {
  readMoves(ids: number[]): Promise<OdooMove[]>;
  writeRef(id: number, ref: string): Promise<void>;
  countNotes(id: number, marker: string): Promise<number>;
  postNote(id: number, body: string): Promise<void>;
}

export interface DocRef {
  type: "invoice" | "credit_note";
  id: string;
  number: string | null;
}

// ---------------------------------------------------------------- puur

const idOf = (v: any): string | null =>
  v == null ? null : typeof v === "string" ? v : typeof v === "object" && typeof v.id === "string" ? v.id : null;

/** Een Stripe BalanceTransaction (met `expand: ['data.source']`) naar wat wij nodig hebben. */
export function extractTxn(t: any): TxnLite {
  const src = t?.source;
  let payment_intent: string | null = null;
  let charge_id: string | null = null;
  let refund_id: string | null = null;
  let metadata: Record<string, string> = {};
  let description: string | null = t?.description ?? null;

  if (src && typeof src === "object") {
    if (src.object === "charge") {
      charge_id = src.id;
      payment_intent = idOf(src.payment_intent);
      metadata = (src.metadata ?? {}) as Record<string, string>;
      description = src.description ?? description;
    } else if (src.object === "refund") {
      refund_id = src.id;
      charge_id = idOf(src.charge);
      payment_intent = idOf(src.payment_intent);
      metadata = (src.metadata ?? {}) as Record<string, string>;
    }
  } else if (typeof src === "string") {
    if (src.startsWith("ch_") || src.startsWith("py_")) charge_id = src;
    else if (src.startsWith("re_") || src.startsWith("pyr_")) refund_id = src;
  }

  const details = Array.isArray(t?.fee_details) ? t.fee_details : [];
  const app_fee = details.filter((d: any) => d?.type === "application_fee").reduce((a: number, d: any) => a + Number(d.amount || 0), 0);
  const fee = Number(t?.fee ?? 0);
  return {
    id: String(t?.id),
    type: String(t?.type ?? ""),
    amount: Number(t?.amount ?? 0),
    fee,
    stripe_fee: fee - app_fee,
    app_fee,
    net: Number(t?.net ?? 0),
    currency: String(t?.currency ?? "eur"),
    payment_intent,
    charge_id,
    refund_id,
    description,
    metadata,
  };
}

/** Transacties die nooit bij een factuur horen (de uitbetaling zelf, kosten, correcties). */
export function isDocumentTxn(t: TxnLite): boolean {
  return ["charge", "payment", "refund", "payment_refund", "payment_failure_refund"].includes(t.type);
}

export function eur(cents: number): string {
  const v = Math.abs(cents) / 100;
  const s = v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cents < 0 ? "−" : ""}€${s}`;
}

export function dateNl(unix: number): string {
  // Uitbetalingsdatum in Brusselse tijd (DD-MM-JJJJ).
  const d = new Date(unix * 1000);
  const parts = new Intl.DateTimeFormat("nl-BE", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

/** Nieuwe Referentie, of null als er niets moet veranderen. */
export function mergeRef(existing: string | false | null | undefined, payoutId: string): string | null {
  const cur = typeof existing === "string" ? existing.trim() : "";
  if (cur.includes(payoutId)) return null;
  const add = `Stripe ${payoutId}`;
  return cur ? `${cur} · ${add}` : add;
}

/** De notitie voor één Odoo-boeking. Platte tekst: message_post via RPC escapet HTML. */
export function buildNote(args: {
  payout: PayoutLite;
  txnCount: number;
  txns: TxnLite[]; // de transacties van déze boeking
  otherNumbers: string[]; // andere documenten in dezelfde uitbetaling
}): string {
  const { payout, txnCount, txns, otherNumbers } = args;
  const parts: string[] = [];
  parts.push(
    `Stripe-uitbetaling ${payout.id}, op de bank op ${dateNl(payout.arrival_date)}: ${eur(payout.amount)} ` +
      `(${txnCount} transactie${txnCount === 1 ? "" : "s"}).`,
  );
  for (const t of txns) {
    const kind = t.amount < 0 ? "Terugbetaling" : "Betaling";
    const fees = t.app_fee
      ? `Stripe-kosten ${eur(t.stripe_fee)}, SellQo-platformfee ${eur(t.app_fee)}`
      : `Stripe-kosten ${eur(t.fee)}`;
    parts.push(
      `${kind} ${eur(t.amount)}, ${fees}, netto ${eur(t.net)}` +
        (t.payment_intent ? ` (${t.payment_intent})` : "") + ".",
    );
  }
  if (otherNumbers.length) {
    const shown = otherNumbers.slice(0, 12);
    parts.push(
      `Zelfde uitbetaling: ${shown.join(", ")}${otherNumbers.length > shown.length ? ` en ${otherNumbers.length - shown.length} meer` : ""}.`,
    );
  }
  parts.push("Automatisch toegevoegd door SellQo.");
  return parts.join(" ");
}

// ---------------------------------------------------------------- koppeling in de databank

type Db = { from: (table: string) => any };

async function rows(q: any): Promise<any[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message ?? String(error));
  return (data ?? []) as any[];
}

async function invoicesByIds(db: Db, tenantId: string, ids: string[]): Promise<DocRef[]> {
  if (!ids.length) return [];
  const r = await rows(
    db.from("invoices").select("id, invoice_number, status").eq("tenant_id", tenantId).in("id", ids),
  );
  // Geannuleerd of concept: geen (geldige) Odoo-boeking.
  return r
    .filter((i) => i.status !== "cancelled" && i.status !== "draft")
    .map((i) => ({ type: "invoice" as const, id: i.id, number: i.invoice_number ?? null }));
}

/**
 * De SellQo-documenten van één transactie. Volgorde: creditnota bij een terugbetaling,
 * order, betaalverzoek, bundel, factuur-metadata, metadata van de betaling, checkout-sessie.
 */
export async function resolveDocs(
  db: Db,
  stripe: Pick<StripeApi, "checkoutSessionIdsForPi">,
  tenantId: string,
  t: TxnLite,
): Promise<DocRef[]> {
  const found = new Map<string, DocRef>();
  const add = (list: DocRef[]) => list.forEach((d) => found.set(`${d.type}:${d.id}`, d));

  if (t.refund_id || t.amount < 0) {
    // Terugbetaling: enkel de creditnota, nooit terugvallen op de originele factuur.
    if (!t.refund_id) return [];
    const cns = await rows(
      db.from("credit_notes").select("id, credit_note_number, status").eq("tenant_id", tenantId).eq("stripe_refund_id", t.refund_id),
    );
    return cns.filter((c) => c.status !== "cancelled" && c.status !== "draft").map((c) => ({
      type: "credit_note" as const, id: c.id, number: c.credit_note_number ?? null,
    }));
  }

  const pi = t.payment_intent;
  if (pi) {
    const orders = await rows(db.from("orders").select("id").eq("tenant_id", tenantId).eq("stripe_payment_intent_id", pi));
    if (orders.length) {
      const inv = await rows(
        db.from("invoices").select("id").eq("tenant_id", tenantId).in("order_id", orders.map((o) => o.id)),
      );
      add(await invoicesByIds(db, tenantId, inv.map((i) => i.id)));
    }

    const cycles = await rows(
      db.from("billing_cycles").select("invoice_id").eq("tenant_id", tenantId).eq("stripe_payment_intent_id", pi),
    );
    add(await invoicesByIds(db, tenantId, cycles.map((c) => c.invoice_id).filter(Boolean)));

    const bundles = await rows(
      db.from("payment_bundles").select("items").eq("tenant_id", tenantId).eq("payment_intent_id", pi),
    );
    const bundleInvoiceIds: string[] = [];
    const bundleCycleIds: string[] = [];
    for (const b of bundles) {
      for (const it of (b.items ?? []) as any[]) {
        if (it?.type === "invoice" && it.id) bundleInvoiceIds.push(it.id);
        if (it?.type === "cycle" && it.id) bundleCycleIds.push(it.id);
      }
    }
    if (bundleCycleIds.length) {
      const bc = await rows(db.from("billing_cycles").select("invoice_id").eq("tenant_id", tenantId).in("id", bundleCycleIds));
      bundleInvoiceIds.push(...bc.map((c) => c.invoice_id).filter(Boolean));
    }
    add(await invoicesByIds(db, tenantId, bundleInvoiceIds));

    for (const key of ["stripe_payment_intent_id", "paid_payment_intent_id", "payment_intent_id"]) {
      const byMeta = await rows(
        db.from("invoices").select("id").eq("tenant_id", tenantId).eq(`metadata->>${key}`, pi),
      );
      add(await invoicesByIds(db, tenantId, byMeta.map((i) => i.id)));
    }
  }

  if (!found.size) {
    const m = t.metadata ?? {};
    if (m.invoice_id) add(await invoicesByIds(db, tenantId, [m.invoice_id]));
    if (m.order_id) {
      const inv = await rows(db.from("invoices").select("id").eq("tenant_id", tenantId).eq("order_id", m.order_id));
      add(await invoicesByIds(db, tenantId, inv.map((i) => i.id)));
    }
    if (m.billing_cycle_id) {
      const c = await rows(db.from("billing_cycles").select("invoice_id").eq("tenant_id", tenantId).eq("id", m.billing_cycle_id));
      add(await invoicesByIds(db, tenantId, c.map((x) => x.invoice_id).filter(Boolean)));
    }
  }

  if (!found.size && pi) {
    const sessions = await stripe.checkoutSessionIdsForPi(pi);
    if (sessions.length) {
      const inv = await rows(db.from("invoices").select("id").eq("tenant_id", tenantId).in("checkout_session_id", sessions));
      add(await invoicesByIds(db, tenantId, inv.map((i) => i.id)));
      const ord = await rows(db.from("orders").select("id").eq("tenant_id", tenantId).in("stripe_checkout_session_id", sessions));
      if (ord.length) {
        const oi = await rows(db.from("invoices").select("id").eq("tenant_id", tenantId).in("order_id", ord.map((o) => o.id)));
        add(await invoicesByIds(db, tenantId, oi.map((i) => i.id)));
      }
      const cyc = await rows(db.from("billing_cycles").select("invoice_id").eq("tenant_id", tenantId).in("checkout_session_id", sessions));
      add(await invoicesByIds(db, tenantId, cyc.map((c) => c.invoice_id).filter(Boolean)));
      const bun = await rows(db.from("payment_bundles").select("items").eq("tenant_id", tenantId).in("checkout_session_id", sessions));
      const ids: string[] = [];
      const cids: string[] = [];
      for (const b of bun) for (const it of (b.items ?? []) as any[]) {
        if (it?.type === "invoice" && it.id) ids.push(it.id);
        if (it?.type === "cycle" && it.id) cids.push(it.id);
      }
      if (cids.length) {
        const bc = await rows(db.from("billing_cycles").select("invoice_id").eq("tenant_id", tenantId).in("id", cids));
        ids.push(...bc.map((c) => c.invoice_id).filter(Boolean));
      }
      add(await invoicesByIds(db, tenantId, ids));
    }
  }

  return [...found.values()];
}

export interface MoveLink {
  moveId: number;
  /** Peppol-status die de Odoo-sync vastlegde: 'sent' | 'skipped' | 'manual' | null. */
  peppol: string | null;
}

/** De Odoo-boeking van een document (laatste geslaagde sync), of null. */
export async function odooMoveFor(db: Db, tenantId: string, doc: DocRef): Promise<MoveLink | null> {
  const col = doc.type === "invoice" ? "invoice_id" : "credit_note_id";
  const r = await rows(
    db.from("odoo_invoice_sync_log")
      .select("odoo_move_id, peppol_status, synced_at")
      .eq("tenant_id", tenantId)
      .eq(col, doc.id)
      .eq("sync_status", "synced")
      .order("synced_at", { ascending: false })
      .limit(1),
  );
  const id = Number(r[0]?.odoo_move_id);
  return Number.isFinite(id) && id > 0 ? { moveId: id, peppol: r[0]?.peppol_status ?? null } : null;
}

/**
 * Referentie mag enkel aangevuld worden als de Peppol-verzending afgehandeld is: 'sent', of
 * 'skipped' (niet nodig: B2C of geen btw-nummer). Staat de automatische Peppol-verzending
 * van de tenant uit, dan kan 'skipped' ook "Pieter verstuurt nog handmatig" betekenen: dan
 * enkel 'sent'.
 */
export const refAllowed = (peppol: string | null, peppolAutoSend = true) =>
  peppol === "sent" || (peppolAutoSend && peppol === "skipped");

/** Hoe lang een uitbetaling met ongekoppelde betalingen ('gaps') nog herbekeken wordt. */
export const GAPS_RETRY_DAYS = 7;
/** Hoe lang een uitbetaling die op Odoo wacht ('partial') nog herbekeken wordt. */
export const PARTIAL_RETRY_DAYS = 14;

// ---------------------------------------------------------------- één tenant

export interface LinkResult {
  payouts_seen: number;
  payouts_skipped_done: number;
  payouts_skipped_manual: number;
  payouts_skipped_gaps_old: number;
  payouts_processed: number;
  truncated: boolean;
  txns: number;
  txns_linked: number;
  txns_unlinked: number;
  notes_posted: number;
  refs_written: number;
  refs_skipped_peppol: number;
  waiting_for_odoo: number;
  errors: string[];
  plan?: unknown[]; // enkel bij dryRun
}

type Item = { txn: TxnLite; docs: DocRef[]; links: Map<string, MoveLink | null> };

export async function linkTenantPayouts(args: {
  db: Db;
  stripe: StripeApi;
  odoo: OdooApi | null; // null = Odoo niet bereikbaar/ingesteld: enkel koppelen en bewaren
  tenantId: string;
  stripeAccount: string; // 'platform' of acct_…
  sinceUnix: number;
  maxPayouts: number;
  dryRun: boolean;
  peppolAutoSend?: boolean; // tenant_odoo_settings.peppol_send_enabled (standaard aan)
  deadline?: number; // epoch-ms: na dit moment geen nieuw werk meer beginnen
  now?: () => string;
  nowMs?: () => number;
}): Promise<LinkResult> {
  const { db, stripe, odoo, tenantId, stripeAccount, sinceUnix, maxPayouts, dryRun } = args;
  const now = args.now ?? (() => new Date().toISOString());
  const nowMs = args.nowMs ?? (() => Date.now());
  const res: LinkResult = {
    payouts_seen: 0, payouts_skipped_done: 0, payouts_skipped_manual: 0, payouts_skipped_gaps_old: 0,
    payouts_processed: 0, truncated: false, txns: 0, txns_linked: 0, txns_unlinked: 0, notes_posted: 0,
    refs_written: 0, refs_skipped_peppol: 0, waiting_for_odoo: 0, errors: [],
  };
  const plan: unknown[] = [];

  const payouts = await stripe.listPaidPayouts(sinceUnix, maxPayouts);
  res.payouts_seen = payouts.length;
  if (!payouts.length) return dryRun ? { ...res, plan } : res;

  const known: any[] = [];
  for (let i = 0; i < payouts.length; i += 50) {
    known.push(...await rows(
      db.from("stripe_payouts").select("payout_id, odoo_status").eq("tenant_id", tenantId)
        .in("payout_id", payouts.slice(i, i + 50).map((p) => p.id)),
    ));
  }
  const statusOf = new Map(known.map((k) => [k.payout_id, k.odoo_status as string]));
  const gapsCutoff = nowMs() / 1000 - GAPS_RETRY_DAYS * 86400;
  const partialCutoff = nowMs() / 1000 - PARTIAL_RETRY_DAYS * 86400;
  const overTime = () => !!args.deadline && nowMs() > args.deadline;

  for (const payout of payouts) {
    const st = statusOf.get(payout.id);
    if (st === "done") { res.payouts_skipped_done++; continue; }
    if (st === "gaps" && payout.arrival_date < gapsCutoff) { res.payouts_skipped_gaps_old++; continue; }
    if (st === "partial" && payout.arrival_date < partialCutoff) { res.payouts_skipped_gaps_old++; continue; }
    if (!payout.automatic) { res.payouts_skipped_manual++; continue; }
    if (overTime()) { res.truncated = true; break; }
    try {
      const txns = await stripe.listPayoutTxns(payout.id);
      const docTxns = txns.filter(isDocumentTxn);
      res.payouts_processed++;
      res.txns += docTxns.length;

      // Per transactie: documenten + Odoo-boeking.
      const items: Item[] = [];
      let cut = false;
      for (const t of docTxns) {
        if (overTime()) { cut = true; break; }
        const docs = await resolveDocs(db, stripe, tenantId, t);
        const links = new Map<string, MoveLink | null>();
        for (const d of docs) links.set(`${d.type}:${d.id}`, await odooMoveFor(db, tenantId, d));
        items.push({ txn: t, docs, links });
        if (docs.length) res.txns_linked++; else res.txns_unlinked++;
      }
      // Tijd op midden in een grote uitbetaling: niets bewaren, de volgende run begint opnieuw.
      if (cut) { res.truncated = true; break; }

      const allNumbers = [...new Set(items.flatMap((i) => i.docs.map((d) => d.number).filter((n): n is string => !!n)))];
      const gross = docTxns.reduce((a, t) => a + t.amount, 0);
      const fee = txns.reduce((a, t) => a + t.fee, 0);
      const unlinked = items.filter((i) => !i.docs.length).map((i) => ({
        txn: i.txn.id, type: i.txn.type, amount: i.txn.amount, payment_intent: i.txn.payment_intent,
        refund: i.txn.refund_id, description: i.txn.description,
      }));

      // Per Odoo-boeking: welke transacties, welke documenten, mag Referentie.
      const perMove = new Map<number, { txns: TxnLite[]; docs: DocRef[]; refOk: boolean }>();
      let waiting = 0;
      for (const it of items) {
        for (const d of it.docs) {
          const link = it.links.get(`${d.type}:${d.id}`) ?? null;
          if (!link) { waiting++; continue; }
          const e = perMove.get(link.moveId) ?? { txns: [], docs: [], refOk: true };
          if (!e.txns.some((x) => x.id === it.txn.id)) e.txns.push(it.txn);
          if (!e.docs.some((x) => x.id === d.id)) e.docs.push(d);
          e.refOk = e.refOk && refAllowed(link.peppol, args.peppolAutoSend !== false);
          perMove.set(link.moveId, e);
        }
      }
      res.waiting_for_odoo += waiting;

      const summary = {
        txn_count: docTxns.length, gross_cents: gross, fee_cents: fee,
        linked_count: items.filter((i) => i.docs.length).length, unlinked,
      };
      // Eerst de uitbetaling (de regels verwijzen ernaar), dan de regels.
      if (!dryRun) {
        await savePayout(db, tenantId, stripeAccount, payout, { ...summary, odoo_status: "partial" }, now);
        await saveItems(db, tenantId, payout, items, now);
      }

      // Wat een vorige run al in Odoo zette, slaan we over (geen Odoo-aanroepen nodig).
      const notedBefore = new Set<string>();
      if (!dryRun) {
        const prev = await rows(
          db.from("stripe_payout_items").select("balance_txn_id, odoo_noted_at")
            .eq("tenant_id", tenantId).eq("payout_id", payout.id),
        );
        for (const r of prev) if (r.odoo_noted_at) notedBefore.add(r.balance_txn_id);
      }
      for (const [moveId, e] of [...perMove]) {
        if (e.txns.every((t) => notedBefore.has(t.id))) perMove.delete(moveId);
      }
      const succeeded = new Set<number>();

      // Odoo.
      const moveIds = [...perMove.keys()];
      const odooMoves = odoo && moveIds.length ? await odoo.readMoves(moveIds) : [];
      const byId = new Map(odooMoves.map((m) => [m.id, m]));
      const moveResults: unknown[] = [];
      let allNoted = !!odoo || moveIds.length === 0;
      for (const [moveId, e] of perMove) {
        if (overTime()) { allNoted = false; res.truncated = true; break; }
        const mv = byId.get(moveId);
        if (!odoo || !mv) {
          allNoted = false;
          moveResults.push({ move: moveId, skipped: odoo ? "boeking niet gevonden in Odoo" : "geen Odoo" });
          continue;
        }
        const ownNumbers = new Set(e.docs.map((d) => d.number));
        const note = buildNote({
          payout, txnCount: docTxns.length, txns: e.txns,
          otherNumbers: allNumbers.filter((n) => !ownNumbers.has(n)),
        });
        const newRef = e.refOk ? mergeRef(mv.ref, payout.id) : null;
        if (!e.refOk && !String(mv.ref || "").includes(payout.id)) res.refs_skipped_peppol++;

        if (dryRun) {
          moveResults.push({ move: moveId, name: mv.name, state: mv.state, note, ref_from: mv.ref || "", ref_to: newRef });
          continue;
        }
        try {
          const already = await odoo.countNotes(moveId, payout.id);
          if (!already) { await odoo.postNote(moveId, note); res.notes_posted++; }
          if (newRef) { await odoo.writeRef(moveId, newRef); res.refs_written++; }
          succeeded.add(moveId);
          moveResults.push({ move: moveId, name: mv.name, noted: !already, ref: newRef });
        } catch (err) {
          allNoted = false;
          const msg = err instanceof Error ? err.message : String(err);
          res.errors.push(`${payout.id} → Odoo ${mv.name}: ${msg}`);
          await markError(db, tenantId, payout.id, e.txns.map((t) => t.id), msg);
        }
      }

      // Een transactie is pas afgewerkt als ál haar boekingen gelukt zijn (een bundel kan
      // over meerdere boekingen gaan); anders slaat de volgende run een boeking over.
      if (!dryRun && succeeded.size) {
        const doneTxns = items
          .filter((it) => it.docs.length && !notedBefore.has(it.txn.id))
          .filter((it) => it.docs.every((d) => {
            const l = it.links.get(`${d.type}:${d.id}`);
            return !!l && succeeded.has(l.moveId);
          }))
          .map((it) => it.txn.id);
        if (doneTxns.length) await markNoted(db, tenantId, payout.id, doneTxns, now);
      }

      // "gaps": alles wat te koppelen viel staat in Odoo, maar niet elke betaling vond een
      // document (AI-credits, offertes, POS, terugbetaling zonder creditnota). Nog
      // GAPS_RETRY_DAYS dagen herbekeken; "done" nooit meer.
      const status = waiting > 0 || !allNoted ? "partial" : unlinked.length ? "gaps" : "done";
      if (dryRun) {
        plan.push({
          payout: payout.id, arrival: dateNl(payout.arrival_date), amount: eur(payout.amount),
          txns: docTxns.length, gross: eur(gross), fee: eur(fee), status_would_be: status,
          linked: items.filter((i) => i.docs.length).map((i) => ({
            txn: i.txn.id, amount: eur(i.txn.amount), docs: i.docs.map((d) => d.number ?? d.id),
            moves: [...i.links.values()].map((l) => (l ? `${l.moveId} (peppol ${l.peppol ?? "?"})` : null)),
          })),
          unlinked, odoo: moveResults,
        });
      } else {
        await savePayout(db, tenantId, stripeAccount, payout, { ...summary, odoo_status: status }, now);
      }
    } catch (err) {
      res.errors.push(`${payout.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return dryRun ? { ...res, plan } : res;
}

async function savePayout(
  db: Db, tenantId: string, stripeAccount: string, p: PayoutLite,
  f: { txn_count: number; gross_cents: number; fee_cents: number; linked_count: number; unlinked: unknown[]; odoo_status: string },
  now: () => string,
) {
  const row = {
    tenant_id: tenantId, stripe_account: stripeAccount, payout_id: p.id, amount_cents: p.amount,
    currency: p.currency, arrival_date: new Date(p.arrival_date * 1000).toISOString().slice(0, 10),
    status: p.status, ...f, updated_at: now(),
  };
  const ex = await rows(db.from("stripe_payouts").select("id").eq("tenant_id", tenantId).eq("payout_id", p.id));
  const q = ex.length
    ? db.from("stripe_payouts").update(row).eq("tenant_id", tenantId).eq("payout_id", p.id)
    : db.from("stripe_payouts").insert(row);
  const { error } = await q;
  if (error) throw new Error(`stripe_payouts: ${error.message}`);
}

async function saveItems(db: Db, tenantId: string, p: PayoutLite, items: Item[], now: () => string) {
  for (const it of items) {
    const d = it.docs[0] ?? null;
    const link = d ? it.links.get(`${d.type}:${d.id}`) ?? null : null;
    const row = {
      tenant_id: tenantId, payout_id: p.id, balance_txn_id: it.txn.id, type: it.txn.type,
      amount_cents: it.txn.amount, fee_cents: it.txn.fee, app_fee_cents: it.txn.app_fee, net_cents: it.txn.net,
      payment_intent_id: it.txn.payment_intent, refund_id: it.txn.refund_id,
      documents: it.docs.map((x) => ({
        type: x.type, id: x.id, number: x.number, odoo_move_id: it.links.get(`${x.type}:${x.id}`)?.moveId ?? null,
      })),
      document_type: d?.type ?? null, document_id: d?.id ?? null, document_number: d?.number ?? null,
      odoo_move_id: link ? String(link.moveId) : null, updated_at: now(),
    };
    const ex = await rows(db.from("stripe_payout_items").select("id").eq("tenant_id", tenantId).eq("balance_txn_id", it.txn.id));
    const q = ex.length
      ? db.from("stripe_payout_items").update(row).eq("tenant_id", tenantId).eq("balance_txn_id", it.txn.id)
      : db.from("stripe_payout_items").insert(row);
    const { error } = await q;
    if (error) throw new Error(`stripe_payout_items: ${error.message}`);
  }
}

async function markNoted(db: Db, tenantId: string, payoutId: string, txnIds: string[], now: () => string) {
  const { error } = await db.from("stripe_payout_items")
    .update({ odoo_noted_at: now(), error: null })
    .eq("tenant_id", tenantId).eq("payout_id", payoutId).in("balance_txn_id", txnIds);
  if (error) throw new Error(`stripe_payout_items noted: ${error.message}`);
}

async function markError(db: Db, tenantId: string, payoutId: string, txnIds: string[], msg: string) {
  await db.from("stripe_payout_items")
    .update({ error: msg.slice(0, 500) })
    .eq("tenant_id", tenantId).eq("payout_id", payoutId).in("balance_txn_id", txnIds);
}
