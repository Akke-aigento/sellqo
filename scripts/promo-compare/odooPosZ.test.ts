/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// KASSA-ODOO-1 — Z-rapport → Odoo tegen een nep-databank en nep-Odoo. Bewijst: standaard uit;
// een proefrun schrijft niets (DB noch Odoo); een Z wordt één keer geboekt, ook bij een tweede
// run of een crash na het aanmaken; een afwijking blijft concept met een melding; een lege Z,
// een historische Z en Z's vóór de startdatum worden nooit geboekt; een dagboek van een andere
// winkel op dezelfde Odoo wordt geweigerd; concept-modus boekt niet definitief.
//
// Run: deno test --no-lock scripts/promo-compare/odooPosZ.test.ts
import { StatefulDb, type Row } from "./statefulDb.ts";
import {
  splitGrossForOdoo, syncTenantZ, vatInGross, type OdooMoveHead, type OdooMoveRead, type PosZOdoo, type PosZSettings,
} from "../../supabase/functions/_shared/odooPosZ.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
}
function ok(v: unknown, msg: string) { if (!v) throw new Error(msg); }

const T = "tenant-cafe";
const TAX: Record<string, number> = { "21:true": 141, "12:true": 142, "6:true": 143, "0:false": 50 };

/** Nep-databank met de unieke claim-index van odoo_pos_z_sync_log en de dedupe-index van notifications. */
class Db extends StatefulDb {
  /** Wordt vóór elke update op de log uitgevoerd (om een gelijktijdige run na te spelen). */
  beforeLogUpdate: (() => void) | null = null;
  override from(t: string) {
    const q: any = super.from(t);
    const tables = this.tables;
    if (t === "odoo_pos_z_sync_log") {
      const upd = q.update.bind(q);
      q.update = (p: Row) => { const f = this.beforeLogUpdate; this.beforeLogUpdate = null; f?.(); return upd(p); };
    }
    if (t === "odoo_pos_z_sync_log" || t === "notifications") {
      const insert = q.insert.bind(q);
      q.insert = (r: Row) => {
        const rows = (tables[t] ||= []);
        const clash = t === "notifications"
          ? rows.some((x) => x.tenant_id === r.tenant_id && x.type === r.type && x.data?.dedupe_key === r.data?.dedupe_key)
          : ["pending", "synced", "skipped"].includes(r.sync_status) &&
            rows.some((x) => x.tenant_id === r.tenant_id && x.kassa_report_id === r.kassa_report_id && ["pending", "synced", "skipped"].includes(x.sync_status));
        if (clash) {
          const fail: any = { select: () => fail, single: () => fail, then: (res: any) => Promise.resolve({ data: null, error: { code: "23505", message: "duplicate" } }).then(res) };
          return fail;
        }
        return insert(r);
      };
    }
    return q;
  }
}

class FakeOdoo implements PosZOdoo {
  moves = new Map<number, { data: any; state: string }>();
  creates = 0;
  posts = 0;
  writes = 0;
  partners = new Map<number, string>();
  failReadOnce = false;
  failCreate = false;
  /** Rondt als een Odoo die per document afrondt (round_globally): geeft een afwijking. */
  roundGlobally = false;
  journals: Record<number, { id: number; name: string; type: string }> = { 7: { id: 7, name: "Verkopen", type: "sale" }, 9: { id: 9, name: "Kassa", type: "sale" } };
  private seq = 100;
  journal(id: number) { return Promise.resolve(this.journals[id] ?? null); }
  findTax(rate: number, included: boolean) {
    const id = TAX[`${rate}:${included}`];
    return id ? Promise.resolve(id) : Promise.reject(new Error(`btw-code ${rate}% ontbreekt`));
  }
  findPartner(name: string) { for (const [id, n] of this.partners) if (n === name) return Promise.resolve(id); return Promise.resolve(null); }
  createPartner(name: string) { this.writes++; const id = ++this.seq; this.partners.set(id, name); return Promise.resolve(id); }
  partnerName(id: number) { return Promise.resolve(this.partners.get(id) ?? null); }
  private head(id: number): OdooMoveHead {
    const m = this.moves.get(id)!;
    return { id, name: m.data.name, state: m.state, move_type: m.data.move_type, partner_id: m.data.partner_id, invoice_date: m.data.invoice_date };
  }
  findMoves(name: string, journalId: number | null, moveType: string) {
    const out: OdooMoveHead[] = [];
    for (const [id, m] of this.moves) {
      if (m.data.name === name && (journalId == null || m.data.journal_id === journalId) && m.data.move_type === moveType && m.state !== "cancel") out.push(this.head(id));
    }
    return Promise.resolve(out);
  }
  /** Boekingsdatum zoals Odoo ze zou zetten (een vergrendelde periode verschuift ze). */
  shiftDate: string | null = null;
  getMove(id: number) { return Promise.resolve(this.moves.has(id) ? this.head(id) : null); }
  createMove(data: Record<string, unknown>) {
    if (this.failCreate) return Promise.reject(new Error("Odoo: periode afgesloten"));
    this.creates++; this.writes++; const id = ++this.seq; this.moves.set(id, { data, state: "draft" }); return Promise.resolve(id);
  }
  readMove(id: number): Promise<OdooMoveRead> {
    if (this.failReadOnce) { this.failReadOnce = false; return Promise.reject(new Error("Odoo time-out")); }
    const m = this.moves.get(id)!;
    const rateOf = (taxId: number) => Number(Object.entries(TAX).find(([, v]) => v === taxId)![0].split(":")[0]);
    const productLines: OdooMoveRead["productLines"] = [];
    const taxBy = new Map<number, number>();
    const grossBy = new Map<number, number>();
    let untaxed = 0, tax = 0;
    for (const [, , l] of m.data.invoice_line_ids) {
      const taxId = l.tax_ids[0][2][0];
      const rate = rateOf(taxId);
      const cents = Math.round(l.price_unit * 100);
      grossBy.set(taxId, (grossBy.get(taxId) ?? 0) + cents);
      const t = vatInGross(cents, rate);
      productLines.push({ tax_ids: [taxId], price_subtotal: (cents - t) / 100 });
      if (t) taxBy.set(taxId, (taxBy.get(taxId) ?? 0) + t);
      untaxed += cents - t; tax += t;
    }
    if (this.roundGlobally) {
      taxBy.clear(); tax = 0;
      for (const [taxId, g] of grossBy) { const t = vatInGross(g, rateOf(taxId)); if (t) taxBy.set(taxId, t); tax += t; }
    }
    const sign = m.data.move_type === "out_invoice" ? -1 : 1;
    return Promise.resolve({
      id, state: m.state, invoice_date: m.data.invoice_date, date: this.shiftDate ?? m.data.invoice_date, amount_untaxed: untaxed / 100, amount_tax: tax / 100, amount_total: (untaxed + tax) / 100,
      productLines, taxLines: [...taxBy].map(([tax_id, v]) => ({ tax_id, balance: sign * v / 100 })), otherLines: [],
    });
  }
  post(id: number) { this.posts++; this.writes++; this.moves.get(id)!.state = "posted"; return Promise.resolve(); }
}

const settings = (extra: Partial<PosZSettings> = {}): PosZSettings => ({
  odoo_sync_enabled: true, odoo_journal_id: "7", odoo_journal_name: "Verkopen", odoo_auto_post: true,
  channel_aliases: {}, channel_partner_ids: {}, pos_z_sync_enabled: true, pos_z_sync_from: "2026-10-01",
  pos_z_journal_id: null, pos_z_journal_name: null,
  // Aangezet op 1 okt (Brussel); terugwerkend enkel met bevestiging.
  pos_z_enabled_at: "2026-10-01T08:00:00Z", pos_z_backfill_from: null, ...extra,
});

const z = (id: string, no: number, day: string, vats: any[], extra: Record<string, unknown> = {}) => ({
  id, tenant_id: T, kind: "Z", report_no: no, booking_date: day, period_start: `${day}T05:00:00Z`, period_end: `${day}T23:00:00Z`,
  data: { vats, payments: [{ method: "cash", cents: 3100 }], tips: [{ method: "card", cents: 200 }], rounding_cents: 0, ...extra },
});
const V21 = { rate: 21, gross_cents: 1500, vat_cents: 260, net_cents: 1240 };
const V12 = { rate: 12, gross_cents: 1600, vat_cents: 171, net_cents: 1429 };

function world(reports: any[] = [z("z1", 1, "2026-10-30", [V21, V12])]) {
  return new Db({
    kassa_reports: reports,
    odoo_pos_z_sync_log: [],
    notifications: [],
    tenant_odoo_settings: [{ tenant_id: T, odoo_journal_id: "7", channel_partner_ids: {}, pos_z_sync_enabled: true, odoo_sync_enabled: true }],
    tenant_odoo_credentials: [{ tenant_id: T, odoo_url: "https://x.odoo.com", odoo_db: "x" }],
  });
}
const run = (db: Db, odoo: FakeOdoo | null, s = settings(), extra: Record<string, unknown> = {}) =>
  syncTenantZ({ db, odoo, tenantId: T, tenantName: "Café Test", settings: s, dryRun: false, deadline: Date.now() + 60_000, ...extra } as any);

Deno.test("standaard uit: de schakelaar uit = niets lezen, niets schrijven", async () => {
  const db = world(); const odoo = new FakeOdoo();
  const r = await run(db, odoo, settings({ pos_z_sync_enabled: false }));
  eq(r.skipped, "kassa-naar-Odoo staat uit", "uit");
  eq([odoo.writes, db.tables.odoo_pos_z_sync_log.length], [0, 0], "niets");
  const r2 = await run(db, odoo, settings({ pos_z_sync_from: null }));
  eq(r2.skipped, "geen startdatum (pos_z_sync_from)", "zonder startdatum geen run");
});

Deno.test("proefrun: toont de boeking, schrijft niets (DB noch Odoo), ook met de schakelaar uit", async () => {
  const db = world(); const odoo = new FakeOdoo();
  const r = await syncTenantZ({ db, odoo, tenantId: T, tenantName: "Café Test", settings: settings({ pos_z_sync_enabled: false, pos_z_sync_from: null }), dryRun: true, deadline: Date.now() + 60_000 });
  eq(r.reports.map((x) => [x.status, x.name, x.expected]), [["would_book", "Z-2026-00001", { untaxed: 26.69, tax: 4.31, total: 31 }]], "plan");
  eq(odoo.writes, 0, "geen Odoo-schrijfactie");
  eq(Object.keys(db.calls).filter((k) => !k.endsWith(":select")), [], "enkel selects");
});

Deno.test("echte run: één boeking, gepost, log synced; tweede run doet niets", async () => {
  const db = world(); const odoo = new FakeOdoo();
  const r = await run(db, odoo);
  eq(r.reports.map((x) => x.status), ["synced"], "geboekt");
  eq([odoo.creates, odoo.posts], [1, 1], "één create, één post");
  const mv = [...odoo.moves.values()][0];
  eq([mv.data.name, mv.data.move_type, mv.data.invoice_date, mv.data.journal_id], ["Z-2026-00001", "out_invoice", "2026-10-30", 7], "kop");
  eq(mv.data.invoice_line_ids.map((l: any) => [l[2].price_unit, l[2].quantity, l[2].tax_ids[0][2][0]]), [[15, 1, 141], [16, 1, 142]], "regels bruto, inclusief");
  ok(String(mv.data.narration).includes("Fooien (geen omzet, niet geboekt)"), "fooi enkel info");
  eq(odoo.partners.get(mv.data.partner_id), "Kassaverkopen — Café Test", "verzamelklant");
  eq(db.tables.tenant_odoo_settings[0].channel_partner_ids, { pos_z: mv.data.partner_id }, "partner bewaard onder pos_z");
  eq(db.tables.odoo_pos_z_sync_log.map((l) => [l.sync_status, l.odoo_state]), [["synced", "posted"]], "log");
  const again = await run(db, odoo);
  eq([again.reports.length, odoo.creates, odoo.posts], [0, 1, 1], "idempotent");
});

Deno.test("crash na het aanmaken: de volgende run hergebruikt het concept, nooit een tweede boeking", async () => {
  const db = world(); const odoo = new FakeOdoo();
  odoo.failReadOnce = true;
  const r1 = await run(db, odoo);
  eq(r1.reports.map((x) => x.status), ["failed"], "eerste poging faalt");
  eq(db.notifications("integration_error").map((n) => n.data.dedupe_key), ["odoo_pos_z_failed:z1:r0"], "melding");
  const r2 = await run(db, odoo);
  eq(r2.reports.map((x) => x.status), ["synced"], "tweede poging lukt");
  eq([odoo.creates, odoo.posts], [1, 1], "zelfde boeking");
  eq(db.tables.odoo_pos_z_sync_log.map((l) => [l.sync_status, l.attempts]), [["synced", 2]], "één logregel, 2 pogingen");
});

Deno.test("afwijking in Odoo: concept blijft staan, melding met dedupe-sleutel, geen post", async () => {
  // 300 koffies: per ticket afgerond ≠ op het dagtotaal. Een Odoo die globaal afrondt wijkt af.
  const db = world([z("z1", 1, "2026-10-30", [{ rate: 21, gross_cents: 78000, vat_cents: 13500, net_cents: 64500 }])]);
  const odoo = new FakeOdoo(); odoo.roundGlobally = true;
  const r = await run(db, odoo);
  eq(r.reports.map((x) => x.status), ["failed"], "niet geboekt");
  eq([odoo.posts, [...odoo.moves.values()][0].state], [0, "draft"], "concept");
  eq(db.notifications("integration_error").map((n) => n.data.dedupe_key), ["odoo_pos_z_mismatch:z1:r0"], "één melding");
  await run(db, odoo);
  await run(db, odoo);
  eq([db.notifications("integration_error").length, odoo.creates], [1, 1], "geen tweede melding of boeking");
  eq(db.tables.odoo_pos_z_sync_log.map((l) => [l.sync_status, l.attempts]), [["failed", 3]], "geen logregel per uur");
  // Met per-regel afronding (zoals nomadix-bv) klopt dezelfde Z wel.
  const db2 = world([z("z1", 1, "2026-10-30", [{ rate: 21, gross_cents: 78000, vat_cents: 13500, net_cents: 64500 }])]);
  const odoo2 = new FakeOdoo();
  eq((await run(db2, odoo2)).reports.map((x) => x.status), ["synced"], "round_per_line: exact");
});

Deno.test("lege Z, historische Z en Z vóór de startdatum worden nooit geboekt", async () => {
  const db = world([
    z("z0", 1, "2026-09-30", [V21]),
    z("z1", 2, "2026-10-30", []),
    z("z2", 3, "2026-10-31", [V21], { historical_import: true }),
  ]);
  const odoo = new FakeOdoo();
  const r = await run(db, odoo);
  eq(r.reports.map((x) => [x.report_id, x.status]), [["z1", "skipped"], ["z2", "skipped"]], "lege Z en historische Z als skipped");
  eq(db.tables.odoo_pos_z_sync_log.map((l) => l.error_message), ["lege Z (geen omzet)", "historische import"], "reden gelogd");
  eq((await run(db, odoo)).reports.length, 0, "volgende run: niets meer open");
  eq(odoo.writes, 0, "niets in Odoo");
});

Deno.test("retourdag (negatief totaal) wordt een creditnota", async () => {
  const db = world([z("z1", 1, "2026-10-30", [{ rate: 21, gross_cents: -1210, vat_cents: -210, net_cents: -1000 }])]);
  const odoo = new FakeOdoo();
  eq((await run(db, odoo)).reports.map((x) => [x.status, x.move_type]), [["synced", "out_refund"]], "creditnota");
});

Deno.test("dagboek van een andere winkel op dezelfde Odoo: geweigerd", async () => {
  const db = world();
  db.tables.tenant_odoo_credentials.push({ tenant_id: "other", odoo_url: "https://x.odoo.com", odoo_db: "x" });
  db.tables.tenant_odoo_settings.push({ tenant_id: "other", odoo_journal_id: "9", pos_z_journal_id: null });
  const odoo = new FakeOdoo();
  const r = await run(db, odoo, settings({ pos_z_journal_id: "9", pos_z_journal_name: "Kassa" }));
  ok(r.error?.includes("andere winkel"), String(r.error));
  eq(odoo.writes, 0, "niets");
});

Deno.test("concept-modus (odoo_auto_post uit): boeking blijft concept, wel synced", async () => {
  const db = world(); const odoo = new FakeOdoo();
  const r = await run(db, odoo, settings({ odoo_auto_post: false }));
  eq(r.reports.map((x) => [x.status, x.odoo_state]), [["synced", "draft"]], "concept");
  eq(odoo.posts, 0, "niet gepost");
});

Deno.test("een verse claim van een andere run: overslaan; een verlopen claim: opnieuw proberen", async () => {
  const db = world(); const odoo = new FakeOdoo();
  db.tables.odoo_pos_z_sync_log.push({ id: "c1", tenant_id: T, kassa_report_id: "z1", sync_status: "pending", created_at: new Date().toISOString(), attempts: 1 });
  const r = await run(db, odoo);
  eq([r.reports.map((x) => x.status), odoo.creates], [["busy"], 0], "bezig");
  db.tables.odoo_pos_z_sync_log[0].created_at = new Date(Date.now() - 3_600_000).toISOString();
  const r2 = await run(db, odoo);
  eq([r2.reports.map((x) => x.status), odoo.creates], [["synced"], 1], "verlopen claim vrijgegeven");
});

Deno.test("een bestaande Odoo-boeking met dezelfde naam maar een andere klant wordt niet overgenomen", async () => {
  const db = world(); const odoo = new FakeOdoo();
  odoo.moves.set(5, { data: { name: "Z-2026-00001", journal_id: 7, move_type: "out_invoice", partner_id: 999, invoice_date: "2026-10-30", invoice_line_ids: [] }, state: "posted" });
  const r = await run(db, odoo);
  ok(r.reports[0].status === "failed" && r.reports[0].error?.includes("niet bij deze Z"), JSON.stringify(r.reports));
  eq(odoo.creates, 0, "geen create");
});

const at = (iso: string) => () => new Date(iso);

Deno.test("review 1.1: startdatum vóór het aanzetten (Brusselse dag) zonder bevestiging = niets, met melding", async () => {
  const db = world(); const odoo = new FakeOdoo();
  // 31-10 23:30 UTC = 1 november 00:30 in Brussel: 31 oktober is al verleden.
  const s = settings({ pos_z_enabled_at: "2026-10-31T23:30:00Z", pos_z_sync_from: "2026-10-30" });
  const r = await run(db, odoo, s, { now: at("2026-11-01T10:00:00Z") });
  ok(r.error?.includes("zonder bevestiging"), String(r.error));
  eq([odoo.writes, db.tables.odoo_pos_z_sync_log.length], [0, 0], "niets geboekt");
  eq(db.notifications("integration_error").map((n) => n.data.dedupe_key), ["odoo_pos_z_tenant:from_unconfirmed:2026-11-01"], "melding met datum");
  // Bevestigd via de RPC (pos_z_backfill_from): wel.
  const r2 = await run(db, odoo, { ...s, pos_z_backfill_from: "2026-10-30" }, { now: at("2026-11-01T10:00:00Z") });
  eq(r2.reports.map((x) => x.status), ["synced"], "na bevestiging");
  // Een echte run negeert fromDate uit de body.
  const db3 = world(); const r3 = await run(db3, new FakeOdoo(), s, { now: at("2026-11-01T10:00:00Z"), fromDate: "2026-11-01" });
  ok(r3.error?.includes("zonder bevestiging"), "body.fromDate omzeilt niets");
  const r4 = await run(world(), new FakeOdoo(), settings({ pos_z_enabled_at: null }));
  ok(r4.error?.includes("aanzetmoment"), "zonder aanzetmoment niets");
});

Deno.test("review 1.2: een verlopen claim die intussen door een andere run genomen werd, wordt niet vrijgegeven", async () => {
  const db = world(); const odoo = new FakeOdoo();
  const old = new Date(Date.now() - 3_600_000).toISOString();
  db.tables.odoo_pos_z_sync_log.push({ id: "c1", tenant_id: T, kassa_report_id: "z1", sync_status: "pending", created_at: old, attempts: 1 });
  // Net vóór onze vrijgave neemt een andere run de claim over (nieuwe created_at).
  db.beforeLogUpdate = () => { db.tables.odoo_pos_z_sync_log[0].created_at = new Date().toISOString(); };
  const r = await run(db, odoo);
  eq([r.reports.map((x) => x.status), odoo.creates, db.tables.odoo_pos_z_sync_log[0].sync_status], [["busy"], 0, "pending"], "afgeblijven");
});

Deno.test("review 1.2: failed → pending enkel op de geziene poging (compare-and-swap)", async () => {
  const db = world(); const odoo = new FakeOdoo();
  db.tables.odoo_pos_z_sync_log.push({ id: "f1", tenant_id: T, kassa_report_id: "z1", sync_status: "failed", created_at: "2026-10-31T10:00:00Z", attempts: 1, finished_at: "2026-10-31T10:00:00Z" });
  db.beforeLogUpdate = () => { db.tables.odoo_pos_z_sync_log[0].attempts = 2; db.tables.odoo_pos_z_sync_log[0].sync_status = "pending"; };
  const r = await run(db, odoo);
  eq([r.reports.map((x) => x.status), odoo.creates], [["busy"], 0], "andere run was sneller");
});

Deno.test("review 1.3: fouten op winkelniveau melden (verbinding, dagboek van een ander), één keer per dag", async () => {
  const db = world();
  const r = await run(db, null, settings(), { odooNote: "Odoo-authenticatie mislukt", now: at("2026-11-01T10:00:00Z") });
  eq(r.error, "Odoo-authenticatie mislukt", "fout");
  await run(db, null, settings(), { odooNote: "Odoo-authenticatie mislukt", now: at("2026-11-01T11:00:00Z") });
  await run(db, null, settings(), { odooNote: "Odoo-authenticatie mislukt", now: at("2026-11-02T10:00:00Z") });
  eq(db.notifications("integration_error").map((n) => n.data.dedupe_key),
    ["odoo_pos_z_tenant:odoo_connection:2026-11-01", "odoo_pos_z_tenant:odoo_connection:2026-11-02"], "één per dag");
  const db2 = world();
  db2.tables.tenant_odoo_credentials.push({ tenant_id: "other", odoo_url: "https://X.odoo.com/", odoo_db: "x" });
  db2.tables.tenant_odoo_settings.push({ tenant_id: "other", odoo_journal_id: "7", pos_z_journal_id: null });
  const r2 = await run(db2, new FakeOdoo());
  ok(r2.error?.includes("andere winkel"), "URL genormaliseerd (hoofdletters, slash)");
  ok(db2.notifications("integration_error")[0].data.dedupe_key.startsWith("odoo_pos_z_tenant:journal_taken:"), "gemeld");
});

Deno.test("review 1.4: backoff: 3× elk uur, dan dagelijks, na 10 needs_review en stilte", async () => {
  const db = world(); const odoo = new FakeOdoo(); odoo.failCreate = true;
  let t = Date.parse("2026-11-01T10:00:00Z");
  const tick = (ms: number) => { t += ms; };
  const go = () => run(db, odoo, settings(), { now: () => new Date(t) });
  const log = () => db.tables.odoo_pos_z_sync_log[0];
  for (let i = 1; i <= 3; i++) { await go(); eq([log().sync_status, log().attempts], ["failed", i], `uur ${i}`); tick(3600_000); }
  await go(); eq(log().attempts, 3, "4de uur: wacht (dagelijks)");
  tick(24 * 3600_000); await go(); eq(log().attempts, 4, "na een dag opnieuw");
  for (let i = 5; i <= 10; i++) { tick(24 * 3600_000); await go(); }
  eq([log().sync_status, log().attempts], ["needs_review", 10], "eindstatus");
  ok(db.notifications("integration_error").some((n) => n.data.dedupe_key === "odoo_pos_z_needs_review:z1:r0"), "melding needs_review");
  tick(30 * 24 * 3600_000); const r = await go();
  eq([r.reports.length, log().attempts], [0, 10], "geen pogingen meer");
  eq(db.tables.odoo_pos_z_sync_log.length, 1, "één logregel");
  // Na 'Opnieuw proberen' (RPC odoo_pos_z_retry: failed, attempts 0) en een opgeloste Odoo.
  Object.assign(log(), { sync_status: "failed", attempts: 0, retry_round: 1 }); odoo.failCreate = false;
  eq((await go()).reports.map((x) => x.status), ["synced"], "na retry geboekt");
  // Aanvaard (RPC odoo_pos_z_accept) telt als afgehandeld.
  const db2 = world(); db2.tables.odoo_pos_z_sync_log.push({ id: "a1", tenant_id: T, kassa_report_id: "z1", sync_status: "accepted", created_at: "2026-10-31T10:00:00Z", attempts: 4 });
  eq((await run(db2, new FakeOdoo())).reports.length, 0, "aanvaarde Z nooit opnieuw");
});

Deno.test("review 1.4: ongeldige Z = meteen needs_review, geen herhaling", async () => {
  const db = world([z("z1", 1, "2026-10-30", [{ rate: 9, gross_cents: 109, vat_cents: 9, net_cents: 100 }])]);
  await run(db, new FakeOdoo()); await run(db, new FakeOdoo());
  eq(db.tables.odoo_pos_z_sync_log.map((l) => l.sync_status), ["needs_review"], "één rij, nagekeken");
});

Deno.test("review 1.6: tijdsbudget op vóór de Odoo-aanroep: niets geschreven, geen poging geteld", async () => {
  const db = world(); const odoo = new FakeOdoo();
  const r = await run(db, odoo, settings(), { deadline: Date.now() - 1 });
  eq([odoo.writes, db.tables.odoo_pos_z_sync_log.length, r.remaining], [0, 0, 1], "uitgesteld");
});

Deno.test("review 1.8: herpoging zoekt eerst de Odoo-boeking van de vorige poging, ook in een ander dagboek", async () => {
  const db = world(); const odoo = new FakeOdoo();
  odoo.failReadOnce = true;
  await run(db, odoo); // boeking in dagboek 7, teruglezen faalt
  eq(db.tables.odoo_pos_z_sync_log[0].odoo_move_id != null, true, "move-id gelogd");
  const r = await run(db, odoo, settings({ pos_z_journal_id: "9", pos_z_journal_name: "Kassa" }));
  eq([r.reports.map((x) => x.status), odoo.creates], [["synced"], 1], "hergebruikt, geen tweede boeking");
});

Deno.test("review 1.8: gecachete partner die intussen anders heet, wordt niet gebruikt", async () => {
  const db = world(); const odoo = new FakeOdoo();
  odoo.partners.set(77, "Iets anders");
  await run(db, odoo, settings({ channel_partner_ids: { pos_z: 77 } }));
  const mv = [...odoo.moves.values()][0];
  eq(odoo.partners.get(mv.data.partner_id), "Kassaverkopen — Café Test", "juiste verzamelklant");
});

Deno.test("review 1.7: kleine dagen krijgen geen regel met omgekeerd teken", () => {
  for (let g = 50; g <= 2000; g++) for (const d of [-2, -1, 1, 2]) {
    const p = splitGrossForOdoo(g, vatInGross(g, 21) + d, 21);
    if (!p || p.some((x) => x <= 0)) throw new Error(`${g}/${d}: ${JSON.stringify(p)}`);
  }
});

Deno.test("review 2.5: Odoo verschuift de boekingsdatum (vergrendelde periode): concept + melding", async () => {
  const db = world(); const odoo = new FakeOdoo(); odoo.shiftDate = "2026-11-01";
  const r = await run(db, odoo);
  ok(r.reports[0].status === "failed" && r.reports[0].error?.includes("boekingsdatum"), JSON.stringify(r.reports[0]));
  eq(odoo.posts, 0, "niet geboekt");
});

Deno.test("review 2.13: schakelaar intussen uit = stoppen vóór de claim", async () => {
  const db = world(); const odoo = new FakeOdoo();
  db.tables.tenant_odoo_settings[0].pos_z_sync_enabled = false; // de geladen settings zeggen nog 'aan'
  const r = await run(db, odoo);
  eq([r.reports.map((x) => x.status), odoo.creates, db.tables.odoo_pos_z_sync_log.length], [["stopped"], 0, 0], "niets geclaimd");
});

Deno.test("review 2 M1: uitgesteld telt niet als poging, wel als uitstel; na 5 een melding", async () => {
  // Een Odoo die zo traag antwoordt dat het budget vlak na de claim verloopt.
  const db3 = world(); db3.tables.odoo_pos_z_sync_log.push({ id: "d3", tenant_id: T, kassa_report_id: "z1", sync_status: "failed", created_at: "2026-10-31T10:00:00Z", attempts: 1, deferrals: 4, retry_round: 0, finished_at: "2026-10-31T10:00:00Z" });
  const slow = new FakeOdoo();
  const deadline = Date.now() + 50;
  slow.journal = async (id: number) => { await new Promise((res) => setTimeout(res, 0)); return { id, name: "Verkopen", type: "sale" }; };
  slow.findTax = async () => { await new Promise((res) => setTimeout(res, 80)); return 141; };
  await run(db3, slow, settings(), { deadline });
  const row = db3.tables.odoo_pos_z_sync_log[0];
  eq([row.sync_status, row.attempts, row.deferrals], ["failed", 1, 5], "poging niet geteld, uitstel wel");
  ok(db3.notifications("integration_error").some((n) => n.data.dedupe_key === "odoo_pos_z_deferred:z1:r0"), "melding na 5");
});

Deno.test("review 2.8/2.9: boeking met de oude (gecachete) verzamelklant in een ander dagboek wordt hergebruikt", async () => {
  const db = world(); const odoo = new FakeOdoo();
  odoo.partners.set(55, "Kassa oud — Café Test");
  // Een eerdere run boekte in dagboek 7 met partner 55 en crashte vóór de log (geen odoo_move_id).
  odoo.moves.set(60, { data: { name: "Z-2026-00001", journal_id: 7, move_type: "out_invoice", partner_id: 55, invoice_date: "2026-10-30",
    invoice_line_ids: [[0, 0, { price_unit: 15, tax_ids: [[6, 0, [141]]] }], [0, 0, { price_unit: 16, tax_ids: [[6, 0, [142]]] }]] }, state: "draft" });
  const r = await run(db, odoo, settings({ pos_z_journal_id: "9", pos_z_journal_name: "Kassa", channel_partner_ids: { pos_z: 55 } }));
  eq([r.reports.map((x) => [x.status, x.odoo_move_id]), odoo.creates], [[["synced", 60]], 0], "hergebruikt zonder dagboekfilter");
});

Deno.test("review 2.11: na 'Opnieuw proberen' komen de meldingen opnieuw (ronde in de dedupe-sleutel)", async () => {
  const db = world(); const odoo = new FakeOdoo(); odoo.failCreate = true;
  await run(db, odoo);
  Object.assign(db.tables.odoo_pos_z_sync_log[0], { sync_status: "failed", attempts: 0, retry_round: 1 });
  await run(db, odoo);
  eq(db.notifications("integration_error").map((n) => n.data.dedupe_key), ["odoo_pos_z_failed:z1:r0", "odoo_pos_z_failed:z1:r1"], "twee rondes, twee meldingen");
});
