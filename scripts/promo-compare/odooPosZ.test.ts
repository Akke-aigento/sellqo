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
  syncTenantZ, vatInGross, type OdooMoveRead, type PosZOdoo, type PosZSettings,
} from "../../supabase/functions/_shared/odooPosZ.ts";

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${msg}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
}
function ok(v: unknown, msg: string) { if (!v) throw new Error(msg); }

const T = "tenant-cafe";
const TAX: Record<string, number> = { "21:true": 141, "12:true": 142, "6:true": 143, "0:false": 50 };

/** Nep-databank met de unieke claim-index van odoo_pos_z_sync_log en de dedupe-index van notifications. */
class Db extends StatefulDb {
  override from(t: string) {
    const q: any = super.from(t);
    const tables = this.tables;
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
  partnerExists(id: number) { return Promise.resolve(this.partners.has(id)); }
  findMove(name: string, journalId: number, moveType: string) {
    for (const [id, m] of this.moves) {
      if (m.data.name === name && m.data.journal_id === journalId && m.data.move_type === moveType && m.state !== "cancel") {
        return Promise.resolve({ id, state: m.state, partner_id: m.data.partner_id, invoice_date: m.data.invoice_date });
      }
    }
    return Promise.resolve(null);
  }
  createMove(data: Record<string, unknown>) { this.creates++; this.writes++; const id = ++this.seq; this.moves.set(id, { data, state: "draft" }); return Promise.resolve(id); }
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
      id, state: m.state, amount_untaxed: untaxed / 100, amount_tax: tax / 100, amount_total: (untaxed + tax) / 100,
      productLines, taxLines: [...taxBy].map(([tax_id, v]) => ({ tax_id, balance: sign * v / 100 })), otherLines: [],
    });
  }
  post(id: number) { this.posts++; this.writes++; this.moves.get(id)!.state = "posted"; return Promise.resolve(); }
}

const settings = (extra: Partial<PosZSettings> = {}): PosZSettings => ({
  odoo_sync_enabled: true, odoo_journal_id: "7", odoo_journal_name: "Verkopen", odoo_auto_post: true,
  channel_aliases: {}, channel_partner_ids: {}, pos_z_sync_enabled: true, pos_z_sync_from: "2026-10-01",
  pos_z_journal_id: null, pos_z_journal_name: null, ...extra,
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
    tenant_odoo_settings: [{ tenant_id: T, odoo_journal_id: "7", channel_partner_ids: {} }],
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
  eq(db.tables.tenant_odoo_settings[0].channel_partner_ids, { pos: mv.data.partner_id }, "partner bewaard");
  eq(db.tables.odoo_pos_z_sync_log.map((l) => [l.sync_status, l.odoo_state]), [["synced", "posted"]], "log");
  const again = await run(db, odoo);
  eq([again.reports.length, odoo.creates, odoo.posts], [0, 1, 1], "idempotent");
});

Deno.test("crash na het aanmaken: de volgende run hergebruikt het concept, nooit een tweede boeking", async () => {
  const db = world(); const odoo = new FakeOdoo();
  odoo.failReadOnce = true;
  const r1 = await run(db, odoo);
  eq(r1.reports.map((x) => x.status), ["failed"], "eerste poging faalt");
  eq(db.notifications("integration_error").map((n) => n.data.dedupe_key), ["odoo_pos_z_failed:z1"], "melding");
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
  eq(db.notifications("integration_error").map((n) => n.data.dedupe_key), ["odoo_pos_z_mismatch:z1"], "één melding");
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
  eq(r.reports.map((x) => [x.report_id, x.status]), [["z1", "skipped"]], "enkel de lege Z, als skipped");
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
  db.tables.odoo_pos_z_sync_log.push({ id: "c1", tenant_id: T, kassa_report_id: "z1", sync_status: "pending", created_at: new Date().toISOString() });
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
