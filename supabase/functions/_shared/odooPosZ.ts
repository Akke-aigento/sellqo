/* eslint-disable @typescript-eslint/no-explicit-any -- ongetypeerde databankrijen en Odoo-antwoorden */
// KASSA-ODOO-1 — dagontvangsten van SellQo Kassa naar Odoo: per afgesloten Z-rapport ÉÉN boeking.
//
// Bron: public.kassa_reports (kind 'Z', append-only). Het veld data.vats is de omzet per
// btw-tarief zoals kassa_report_data hem bevroor bij het afsluiten: gross_cents (incl. btw),
// vat_cents (btw zoals de FDM: per ticket en tarief half-up(totaal × t / (100 + t)), opgeteld) en
// net_cents (= gross − vat). Dat zijn de cijfers die in Odoo moeten staan, tot op de cent.
//
// Businessregels (getoetst in odooPosZ.test.ts):
//   R1  Eén Z = één Odoo-boeking (out_invoice; out_refund als het totaal van de Z negatief is),
//       naam Z-<jaar bedrijfsdag>-<Z-nummer, 5 cijfers>, factuurdatum = bedrijfsdag van de Z.
//   R2  Omzet per btw-tarief. Btw > 0: BRUTO met de prijs-inclusieve code op exacte naam
//       ("21% incl.", "12% incl.", "6% incl."). 0%: netto met de exclusieve code "0%".
//       Hoeveelheid 1 per regel (conventie ODOO-GUARD-1, _shared/odooBooking.ts).
//   R3  Odoo rekent btw per regel af (round_per_line). Eén regel per tarief geeft half-up(som),
//       de Z heeft som(half-up per ticket): dat verschilt vaak enkele centen. Daarom wordt de
//       omzet van een tarief zo over regels verdeeld dat Odoo per regel afrondend exact de btw
//       van de Z vindt (splitGrossForOdoo). Som van de regels = bruto van de Z. Lukt dat niet
//       binnen MAX_LINES_PER_RATE regels, dan één regel per tarief: Odoo wijkt dan af en R5 vangt het.
//   R4  Fooien zijn geen omzet en worden niet geboekt; betaalwijzen, fooien, afronding contant,
//       kas in/uit, annulaties en correcties staan enkel als info in de notitie (narration).
//       SellQo boekt nooit betalingen in Odoo.
//   R5  Eerst concept maken, teruglezen (totalen én per tarief: maatstaf uit de regels, btw uit de
//       btw-regels), pas definitief boeken als alles tot op de cent gelijk is (en odoo_auto_post
//       aan staat). Anders blijft het concept staan, logregel 'failed' en een melding
//       integrations/integration_error met dedupe-sleutel odoo_pos_z_mismatch:<rapport-id>.
//   R6  Idempotent. De logtabel odoo_pos_z_sync_log heeft een unieke index op
//       (tenant_id, kassa_report_id) voor pending/synced/skipped: een Z wordt hoogstens één keer
//       geclaimd. Een boeking met dezelfde naam in hetzelfde dagboek wordt hergebruikt (crash na
//       create), maar enkel als partner en datum kloppen.
//   R7  Lege Z (geen omzet in enig tarief) = 'skipped', niets in Odoo.
//   R8  Nooit: demo-tenants, Z's vóór pos_z_sync_from, Z's met data.historical_import, tenants
//       met de schakelaar uit (standaard uit). Een dagboek dat een andere tenant van dezelfde Odoo
//       gebruikt, weigert de run.
//   R9  dryRun schrijft niets: geen claim, geen log, geen melding, geen partner, geen Odoo-create.
//       Odoo wordt enkel gelezen (dagboek, btw-codes, partner, bestaande boeking).

export const POS_Z_VERSION = "KASSA-ODOO-1";

/** Belgische kassatarieven (labels A–D). */
export const KASSA_RATES = [21, 12, 6, 0] as const;
/** Exacte namen van de prijs-inclusieve verkoopcodes in Odoo (nomadix-bv: 141, 142, 143). */
export const INCL_TAX_NAME: Record<number, string> = { 21: "21% incl.", 12: "12% incl.", 6: "6% incl." };
/** Binnenlandse 0%-code (exclusief), zoals zeroTaxToken(null) in sync-odoo-invoices. */
export const ZERO_TAX_NAME = "0%";
/** Hoogstens zoveel Odoo-regels per tarief voor de btw-verdeling (R3). Elke regel brengt hoogstens
 *  een halve cent afronding mee, dus een verschil van E cent vraagt minstens 2E regels (300 koffies
 *  van 2,60: E = 37 cent, 75 regels; 1.000 koffies: 249 regels). */
export const MAX_LINES_PER_RATE = 400;
/** Standaardnaam van de verzamelklant (channel_aliases.pos overschrijft). */
export const DEFAULT_POS_LABEL = "Kassaverkopen";
/** Een claim zonder afloop ouder dan dit = onderbroken run. */
export const STALE_PENDING_MS = 30 * 60_000;

// ---------------------------------------------------------------- rekenen (centen, gehele getallen)

/** Deling van gehele getallen, half up weg van nul (zoals src/kassa/fiscal/money.ts en Odoo HALF-UP). */
export function divHalfUp(num: number, den: number): number {
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || den <= 0) throw new Error("divHalfUp: enkel gehele getallen");
  const sign = num < 0 ? -1 : 1;
  const a = Math.abs(num);
  const q = Math.floor(a / den);
  const r = a - q * den;
  return sign * (2 * r >= den ? q + 1 : q);
}

/** Btw in een bruto bedrag (centen), zoals de FDM per label en Odoo per regel met een inclusieve code. */
export function vatInGross(grossCents: number, rate: number): number {
  return rate === 0 ? 0 : divHalfUp(grossCents * rate, 100 + rate);
}

/** Valt bruto × t / (100 + t) precies op een halve cent? Dan hangt Odoo af van float-afronding: vermijden. */
export function isTie(grossCents: number, rate: number): boolean {
  if (rate === 0) return false;
  return (Math.abs(grossCents) * rate * 2) % (2 * (100 + rate)) === 100 + rate;
}

const sumVat = (lines: number[], rate: number) => lines.reduce((s, g) => s + vatInGross(g, rate), 0);

/**
 * R3: verdeel `gross` (centen) over regels zodat Odoo, die per regel half-up afrondt, samen
 * exact `vat` btw vindt. Geeft de bedragen per regel (som = gross), of null als het niet lukt
 * binnen maxLines regels. Regel 1 is de rest, daarna m gelijke regels van minstens 1 euro
 * (eerst geprobeerd) die elk bijna een halve cent afronding meebrengen.
 */
export function splitGrossForOdoo(gross: number, vat: number, rate: number, maxLines = MAX_LINES_PER_RATE): number[] | null {
  if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(vat)) return null;
  if (rate === 0) return vat === 0 ? (gross === 0 ? [] : [gross]) : null;
  if (gross === 0 && vat === 0) return [];
  if (gross !== 0 && !isTie(gross, rate) && vatInGross(gross, rate) === vat) return [gross];
  const s = gross !== 0 ? Math.sign(gross) : (Math.sign(vat) || 1);
  // a × t mod (100 + t) herhaalt zich na 100 + t stappen: 100 … 100 + 2(100 + t) dekt elke
  // mogelijke afronding (twee keer, zodat ook een rest zonder halve cent te vinden is).
  const amounts: number[] = [];
  for (let a = 100; a <= 100 + 2 * (100 + rate); a++) amounts.push(a);
  for (let a = 1; a < 100; a++) amounts.push(a);
  for (let m = 1; m < maxLines; m++) {
    for (const strict of [true, false]) {
      for (const a of amounts) {
        const A = s * a;
        const R = gross - m * A;
        // Eerst: de rest houdt het teken van de omzet (leesbaar: één grote regel + kleine).
        if (strict && (R === 0 || Math.sign(R) !== s)) continue;
        if (isTie(A, rate) || (R !== 0 && isTie(R, rate))) continue;
        if (vatInGross(R, rate) + m * vatInGross(A, rate) === vat) {
          return R === 0 ? Array(m).fill(A) : [R, ...Array(m).fill(A)];
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- Z-rapport lezen

export interface ZRate { rate: number; gross: number; vat: number; net: number }

export interface ZReportRow {
  id: string;
  tenant_id: string;
  kind: string;
  report_no: number | null;
  booking_date: string; // JJJJ-MM-DD
  period_start: string;
  period_end: string;
  data: any;
}

const isInt = (x: unknown) => typeof x === "number" && Number.isSafeInteger(x);

/** De omzet per tarief uit data.vats, gevalideerd. */
export function parseZRates(data: any): { ok: true; rates: ZRate[] } | { ok: false; reason: string } {
  const vats = data?.vats;
  if (!Array.isArray(vats)) return { ok: false, reason: "Z-rapport zonder btw-overzicht (data.vats)" };
  const out: ZRate[] = [];
  const seen = new Set<number>();
  for (const v of vats) {
    const rate = Number(v?.rate);
    if (!(KASSA_RATES as readonly number[]).includes(rate)) return { ok: false, reason: `onbekend btw-tarief ${v?.rate}% in het Z-rapport` };
    if (seen.has(rate)) return { ok: false, reason: `btw-tarief ${rate}% staat dubbel in het Z-rapport` };
    seen.add(rate);
    const gross = v?.gross_cents, vat = v?.vat_cents, net = v?.net_cents;
    if (!isInt(gross) || !isInt(vat) || !isInt(net)) return { ok: false, reason: `bedragen voor ${rate}% zijn geen centen` };
    if (gross - vat !== net) return { ok: false, reason: `${rate}%: bruto − btw ≠ maatstaf (${gross} − ${vat} ≠ ${net})` };
    if (rate === 0 && vat !== 0) return { ok: false, reason: "0% met btw in het Z-rapport" };
    out.push({ rate, gross, vat, net });
  }
  out.sort((a, b) => b.rate - a.rate);
  return { ok: true, rates: out };
}

// ---------------------------------------------------------------- plan

export interface PlannedLine { name: string; cents: number; price_unit: number; rate: number; included: boolean }

export interface Amounts { untaxed: number; tax: number; total: number }

export interface ZPlan {
  reportId: string;
  reportNo: number;
  bookingDate: string;
  name: string;
  ref: string;
  moveType: "out_invoice" | "out_refund";
  empty: boolean;
  /** false = de btw-verdeling (R3) lukte niet; Odoo zal afwijken en de boeking blijft concept. */
  exact: boolean;
  lines: PlannedLine[];
  /** Per tarief in het teken van de boeking (bij out_refund omgedraaid). */
  perRate: ZRate[];
  /** In euro, teken van de boeking. */
  expected: Amounts;
  narration: string;
}

const eurNl = (cents: number) => {
  const neg = cents < 0;
  const a = Math.abs(cents);
  const s = `${Math.floor(a / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(a % 100).padStart(2, "0")}`;
  return `${neg ? "−" : ""}€ ${s}`;
};
export const dateNl = (iso: string) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
};
const timeNl = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch { return String(iso); }
};

const METHOD_NL: Record<string, string> = {
  cash: "contant", card: "kaart", online: "online", transfer: "overschrijving", bank_transfer: "overschrijving",
  voucher: "bon", meal_voucher: "maaltijdcheque", manual: "andere", other: "andere",
};
const methodNl = (m: unknown) => METHOD_NL[String(m)] ?? String(m ?? "onbekend");

export function zMoveName(reportNo: number, bookingDate: string): string {
  return `Z-${String(bookingDate).slice(0, 4)}-${String(reportNo).padStart(5, "0")}`;
}

/** Info-notitie (R4): niets hiervan wordt als bedrag geboekt. */
export function buildNarration(r: ZReportRow, rates: ZRate[], exact: boolean, split: boolean): string {
  const d = r.data ?? {};
  const lines: string[] = [];
  lines.push(`SellQo Kassa — Z-rapport ${r.report_no}, bedrijfsdag ${dateNl(r.booking_date)} (${timeNl(r.period_start)} tot ${timeNl(r.period_end)}).`);
  lines.push("Omzet per btw-tarief volgens het Z-rapport:");
  for (const x of rates) lines.push(`  ${x.rate}%: bruto ${eurNl(x.gross)}, maatstaf ${eurNl(x.net)}, btw ${eurNl(x.vat)}`);
  if (split) lines.push("Btw is per ticket afgerond zoals de FDM. De regels \"btw-afronding per ticket\" verdelen de omzet zodat Odoo per regel dezelfde btw rekent; de som per tarief is die van het Z-rapport.");
  if (!exact) lines.push("LET OP: de btw-verdeling over regels lukte niet. Odoo rekent hierdoor een andere btw dan het Z-rapport; pas het btw-bedrag in dit concept aan naar het Z-rapport en boek het dan.");
  const pays = Array.isArray(d.payments) ? d.payments : [];
  if (pays.length) lines.push(`Betaalwijzen (info, geen betaling geboekt): ${pays.map((p: any) => `${methodNl(p?.method)} ${eurNl(Number(p?.cents) || 0)}`).join(", ")}.`);
  const tips = Array.isArray(d.tips) ? d.tips.filter((t: any) => Number(t?.cents)) : [];
  if (tips.length) lines.push(`Fooien (geen omzet, niet geboekt): ${tips.map((t: any) => `${methodNl(t?.method)} ${eurNl(Number(t?.cents) || 0)}`).join(", ")}.`);
  const rounding = Number(d.rounding_cents) || 0;
  if (rounding) lines.push(`Afronding contant (niet geboekt): ${eurNl(rounding)}.`);
  const cash = d.cash ?? {};
  if (Number(cash.in_cents) || Number(cash.out_cents)) lines.push(`Kas in/uit (niet geboekt): in ${eurNl(Number(cash.in_cents) || 0)}, uit ${eurNl(Number(cash.out_cents) || 0)}.`);
  if (Number(d.voided?.count)) lines.push(`Geannuleerde verkopen: ${d.voided.count} (${eurNl(Number(d.voided.total_cents) || 0)}), niet in de omzet.`);
  if (Number(d.corrections?.count)) lines.push(`Correcties (zitten in de omzet): ${d.corrections.count} (${eurNl(Number(d.corrections.total_cents) || 0)}).`);
  lines.push(`SellQo-rapport-id ${r.id}.`);
  return lines.join("\n");
}

/** R1–R4: wat er voor deze Z in Odoo moet komen. */
export function planZBooking(r: ZReportRow, opts: { partnerLabel: string; maxLinesPerRate?: number }): { ok: true; plan: ZPlan } | { ok: false; reason: string } {
  if (r.kind !== "Z" || !isInt(r.report_no) || (r.report_no as number) <= 0) return { ok: false, reason: "geen afgesloten Z-rapport met nummer" };
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(r.booking_date))) return { ok: false, reason: "Z-rapport zonder geldige bedrijfsdag" };
  const parsed = parseZRates(r.data);
  if (!parsed.ok) return parsed;
  const rates = parsed.rates.filter((x) => x.gross !== 0 || x.vat !== 0);
  const reportNo = r.report_no as number;
  const name = zMoveName(reportNo, r.booking_date);
  const ref = `${opts.partnerLabel} — Z ${reportNo} (${dateNl(r.booking_date)})`;
  const totalGross = rates.reduce((s, x) => s + x.gross, 0);
  const moveType = totalGross < 0 ? "out_refund" : "out_invoice";
  const sign = moveType === "out_refund" ? -1 : 1;
  const perRate = rates.map((x) => ({ rate: x.rate, gross: sign * x.gross, vat: sign * x.vat, net: sign * x.net }));
  const empty = rates.length === 0;

  let exact = true;
  let split = false;
  const lines: PlannedLine[] = [];
  for (const x of perRate) {
    const base = `Kassaomzet ${x.rate}% — Z ${reportNo} (${dateNl(r.booking_date)})`;
    const parts = splitGrossForOdoo(x.gross, x.vat, x.rate, opts.maxLinesPerRate ?? MAX_LINES_PER_RATE);
    const amounts = parts ?? [x.gross];
    if (!parts) exact = false;
    if (amounts.length > 1) split = true;
    amounts.forEach((cents, i) => {
      const nm = i === 0 ? base : `${base} — btw-afronding per ticket (${i}/${amounts.length - 1})`;
      // Btw > 0: bruto met inclusieve code; 0%: netto (= bruto) met exclusieve code.
      lines.push({ name: nm, cents, price_unit: cents / 100, rate: x.rate, included: x.rate > 0 });
    });
  }
  const untaxed = perRate.reduce((s, x) => s + x.net, 0);
  const tax = perRate.reduce((s, x) => s + x.vat, 0);
  const plan: ZPlan = {
    reportId: r.id, reportNo, bookingDate: String(r.booking_date).slice(0, 10), name, ref, moveType, empty, exact, lines, perRate,
    expected: { untaxed: untaxed / 100, tax: tax / 100, total: (untaxed + tax) / 100 },
    narration: buildNarration(r, rates, exact, split),
  };
  return { ok: true, plan };
}

// ---------------------------------------------------------------- teruglezen en vergelijken (R5)

export interface OdooMoveRead {
  id: number;
  state: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  /** Regels met display_type 'product'. price_subtotal in het teken van de boeking. */
  productLines: { tax_ids: number[]; price_subtotal: number }[];
  /** Btw-regels (tax_line_id gezet). balance: debet +, credit −. */
  taxLines: { tax_id: number; balance: number }[];
  /** Andere regels met een bedrag die de boeking zou kunnen scheeftrekken (afronding, korting…). */
  otherLines: { display_type: string; balance: number }[];
}

const c = (x: number) => Math.round(Number((Math.abs(Number(x) || 0) * 100).toFixed(6))) * ((Number(x) || 0) < 0 ? -1 : 1);

/** Lege lijst = Odoo staat tot op de cent gelijk aan het plan (totalen én per tarief). */
export function compareMove(plan: ZPlan, mv: OdooMoveRead, rateOfTax: Map<number, number>): string[] {
  const diffs: string[] = [];
  const abs = (x: number) => Math.abs(c(x));
  if (abs(mv.amount_untaxed) !== abs(plan.expected.untaxed)) diffs.push(`maatstaf ${mv.amount_untaxed} ≠ ${plan.expected.untaxed}`);
  if (abs(mv.amount_tax) !== abs(plan.expected.tax)) diffs.push(`btw ${mv.amount_tax} ≠ ${plan.expected.tax}`);
  if (abs(mv.amount_total) !== abs(plan.expected.total)) diffs.push(`totaal ${mv.amount_total} ≠ ${plan.expected.total}`);

  const net = new Map<number, number>();
  const vat = new Map<number, number>();
  if (mv.productLines.length !== plan.lines.length) diffs.push(`${mv.productLines.length} regels in Odoo, ${plan.lines.length} verwacht`);
  for (const l of mv.productLines) {
    const ids = l.tax_ids ?? [];
    const rate = ids.length === 1 ? rateOfTax.get(ids[0]) : undefined;
    if (rate === undefined) { diffs.push(`regel met onverwachte btw-codes [${ids.join(", ")}]`); continue; }
    net.set(rate, (net.get(rate) ?? 0) + c(l.price_subtotal));
  }
  // Btw-regels: credit bij een factuur, debet bij een creditnota.
  const vatSign = plan.moveType === "out_invoice" ? -1 : 1;
  for (const t of mv.taxLines) {
    const rate = rateOfTax.get(t.tax_id);
    if (rate === undefined) { diffs.push(`btw-regel met onverwachte code ${t.tax_id}`); continue; }
    vat.set(rate, (vat.get(rate) ?? 0) + vatSign * c(t.balance));
  }
  for (const o of mv.otherLines) if (c(o.balance) !== 0) diffs.push(`onverwachte regel (${o.display_type}) van ${o.balance}`);
  const rates = new Set<number>([...plan.perRate.map((x) => x.rate), ...net.keys(), ...vat.keys()]);
  for (const rate of rates) {
    const want = plan.perRate.find((x) => x.rate === rate) ?? { rate, gross: 0, vat: 0, net: 0 };
    if ((net.get(rate) ?? 0) !== want.net) diffs.push(`${rate}%: maatstaf ${(net.get(rate) ?? 0) / 100} ≠ ${want.net / 100}`);
    if ((vat.get(rate) ?? 0) !== want.vat) diffs.push(`${rate}%: btw ${(vat.get(rate) ?? 0) / 100} ≠ ${want.vat / 100}`);
  }
  return diffs;
}

// ---------------------------------------------------------------- uitvoeren per tenant

export type Db = { from: (table: string) => any };

export interface PosZOdoo {
  journal(id: number): Promise<{ id: number; name: string; type: string } | null>;
  /** Exacte naam (INCL_TAX_NAME / ZERO_TAX_NAME), verkoop, juiste inclusief-instelling. Gooit als ze ontbreekt. */
  findTax(rate: number, included: boolean): Promise<number>;
  findPartner(name: string): Promise<number | null>;
  createPartner(name: string): Promise<number>;
  partnerExists(id: number): Promise<boolean>;
  findMove(name: string, journalId: number, moveType: string): Promise<{ id: number; state: string; partner_id: number | null; invoice_date: string | null } | null>;
  createMove(data: Record<string, unknown>): Promise<number>;
  readMove(id: number): Promise<OdooMoveRead>;
  post(id: number): Promise<void>;
}

export interface PosZSettings {
  odoo_sync_enabled: boolean | null;
  odoo_journal_id: string | null;
  odoo_journal_name: string | null;
  odoo_auto_post: boolean | null;
  channel_aliases: Record<string, string> | null;
  channel_partner_ids: Record<string, number> | null;
  pos_z_sync_enabled: boolean | null;
  pos_z_sync_from: string | null;
  pos_z_journal_id: string | null;
  pos_z_journal_name: string | null;
}

export interface ZResult {
  report_id: string;
  report_no: number | null;
  booking_date: string;
  status: "synced" | "failed" | "skipped" | "busy" | "would_book" | "would_skip" | "invalid";
  name?: string;
  move_type?: string;
  odoo_move_id?: number;
  odoo_state?: string;
  existing_move?: number | null;
  expected?: Amounts;
  per_rate?: ZRate[];
  lines?: { name: string; price_unit: number; rate: number }[];
  exact?: boolean;
  error?: string;
}

export interface TenantZResult {
  skipped?: string;
  error?: string;
  from?: string;
  journal_id?: number;
  partner?: string;
  checks?: string[];
  reports: ZResult[];
  remaining: number;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

async function notify(db: Db, tenantId: string, dedupeKey: string, title: string, message: string, data: Record<string, unknown>) {
  const { error } = await db.from("notifications").insert({
    tenant_id: tenantId,
    category: "integrations",
    type: "integration_error",
    priority: "high",
    title,
    message,
    data: { ...data, dedupe_key: dedupeKey },
  });
  if (error && (error as { code?: string }).code !== "23505") console.error("odooPosZ notify:", errMsg(error));
}

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);

/** R8: een dagboek van een andere tenant op dezelfde Odoo (url + db) is taboe. */
async function journalTakenByOther(db: Db, tenantId: string, journalId: number): Promise<boolean> {
  const { data: me } = await db.from("tenant_odoo_credentials").select("odoo_url, odoo_db").eq("tenant_id", tenantId).maybeSingle();
  if (!me) return false;
  const { data: others } = await db.from("tenant_odoo_credentials").select("tenant_id").eq("odoo_url", me.odoo_url).eq("odoo_db", me.odoo_db).neq("tenant_id", tenantId);
  const ids = ((others ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id);
  if (!ids.length) return false;
  const { data: rows, error } = await db.from("tenant_odoo_settings").select("tenant_id, odoo_journal_id, pos_z_journal_id").in("tenant_id", ids);
  if (error) throw new Error(`dagboekcontrole: ${errMsg(error)}`);
  return ((rows ?? []) as { odoo_journal_id: string | null; pos_z_journal_id: string | null }[])
    .some((r) => String(r.odoo_journal_id ?? "") === String(journalId) || String(r.pos_z_journal_id ?? "") === String(journalId));
}

async function loadReports(db: Db, tenantId: string, from: string, reportIds?: string[]): Promise<ZReportRow[]> {
  const out: ZReportRow[] = [];
  for (let off = 0; ; off += 1000) {
    let q = db.from("kassa_reports")
      .select("id, tenant_id, kind, report_no, booking_date, period_start, period_end, data")
      .eq("tenant_id", tenantId)
      .eq("kind", "Z")
      .gte("booking_date", from);
    if (reportIds?.length) q = q.in("id", reportIds);
    const { data, error } = await q.order("report_no", { ascending: true }).range(off, off + 999);
    if (error) throw new Error(`kassa_reports: ${errMsg(error)}`);
    out.push(...((data ?? []) as ZReportRow[]));
    if (!data || data.length < 1000) return out;
  }
}

interface LogRow { id: string; kassa_report_id: string; sync_status: string; created_at: string; attempts: number | null }

async function loadLogs(db: Db, tenantId: string): Promise<LogRow[]> {
  const out: LogRow[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db.from("odoo_pos_z_sync_log")
      .select("id, kassa_report_id, sync_status, created_at, attempts")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .range(off, off + 999);
    if (error) throw new Error(`odoo_pos_z_sync_log: ${errMsg(error)}`);
    out.push(...((data ?? []) as LogRow[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function syncTenantZ(args: {
  db: Db;
  odoo: PosZOdoo | null;
  odooNote?: string;
  tenantId: string;
  tenantName: string;
  settings: PosZSettings;
  dryRun: boolean;
  deadline: number;
  maxPerRun?: number;
  fromDate?: string | null;
  reportIds?: string[];
  now?: () => Date;
}): Promise<TenantZResult> {
  const { db, odoo, tenantId, settings, dryRun } = args;
  const now = args.now ?? (() => new Date());
  const res: TenantZResult = { reports: [], remaining: 0 };
  const maxPerRun = Math.min(Math.max(args.maxPerRun ?? 20, 1), 100);

  // R8: standaard uit. Een proefrun mag een tenant met de schakelaar uit bekijken.
  if (!dryRun && settings.pos_z_sync_enabled !== true) return { ...res, skipped: "kassa-naar-Odoo staat uit" };
  if (!dryRun && settings.odoo_sync_enabled !== true) return { ...res, skipped: "Odoo-sync staat uit" };
  const today = now().toISOString().slice(0, 10);
  const from = args.fromDate ?? settings.pos_z_sync_from ?? (dryRun ? addDays(today, -31) : null);
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return { ...res, skipped: "geen startdatum (pos_z_sync_from)" };
  res.from = from;

  const journalId = Number(settings.pos_z_journal_id || settings.odoo_journal_id);
  const journalName = settings.pos_z_journal_id ? settings.pos_z_journal_name : settings.odoo_journal_name;
  if (!Number.isFinite(journalId) || journalId <= 0) return { ...res, error: "Geen Odoo-dagboek ingesteld voor de kassa of de facturen." };
  res.journal_id = journalId;
  if (await journalTakenByOther(db, tenantId, journalId)) {
    return { ...res, error: `Odoo-dagboek ${journalId} wordt al gebruikt door een andere winkel op dezelfde Odoo.` };
  }

  const label = (settings.channel_aliases?.pos ?? "").trim() || DEFAULT_POS_LABEL;
  const partnerName = `${label} — ${args.tenantName}`;
  res.partner = partnerName;

  // Welke Z's? Nooit eerder geclaimd (pending vers, synced, skipped) en niet historisch.
  const reports = (await loadReports(db, tenantId, from, args.reportIds)).filter((r) => !r.data?.historical_import);
  const logs = await loadLogs(db, tenantId);
  const done = new Set<string>();
  const busy = new Set<string>();
  const failedBefore = new Set<string>();
  // Eén logregel per Z: een nieuwe poging hergebruikt de laatste 'failed'-rij (geen hourly bloat).
  const failedRow = new Map<string, LogRow>();
  for (const l of logs) {
    if (l.sync_status === "synced" || l.sync_status === "skipped") done.add(l.kassa_report_id);
    else if (l.sync_status === "failed") { failedBefore.add(l.kassa_report_id); failedRow.set(l.kassa_report_id, l); }
    else if (l.sync_status === "pending") {
      if (now().getTime() - Date.parse(l.created_at) < STALE_PENDING_MS) busy.add(l.kassa_report_id);
      else if (!dryRun) {
        // Onderbroken run: de claim vrijgeven. Een eventueel concept in Odoo wordt bij de
        // volgende poging op naam teruggevonden en hergebruikt (R6).
        await db.from("odoo_pos_z_sync_log").update({ sync_status: "failed", error_message: "onderbroken run (claim verlopen)", finished_at: now().toISOString() })
          .eq("id", l.id).eq("sync_status", "pending");
        failedBefore.add(l.kassa_report_id);
        failedRow.set(l.kassa_report_id, { ...l, sync_status: "failed" });
      }
    }
  }
  const open = reports.filter((r) => !done.has(r.id) && !busy.has(r.id));
  const ordered = [...open.filter((r) => !failedBefore.has(r.id)), ...open.filter((r) => failedBefore.has(r.id))];
  const batch = ordered.slice(0, maxPerRun);
  res.remaining = ordered.length - batch.length;
  for (const r of reports) if (busy.has(r.id)) res.reports.push({ report_id: r.id, report_no: r.report_no, booking_date: r.booking_date, status: "busy" });
  if (!batch.length) return res;

  // Odoo vooraf: dagboek (verkoop, naam ongewijzigd). Bij een proefrun enkel melden.
  const checks: string[] = [];
  if (!odoo) {
    if (!dryRun) return { ...res, error: args.odooNote ?? "Geen Odoo-verbinding" };
    checks.push(`Odoo niet gelezen: ${args.odooNote ?? "geen verbinding"}`);
  } else {
    try {
      const j = await odoo.journal(journalId);
      if (!j) throw new Error(`Odoo-dagboek ${journalId} bestaat niet meer.`);
      if (j.type !== "sale") throw new Error(`Odoo-dagboek ${j.name} is geen verkoopdagboek (type=${j.type}).`);
      if (journalName && j.name !== journalName) throw new Error(`Odoo-dagboek heet nu '${j.name}' i.p.v. '${journalName}'. Kies het opnieuw in de instellingen.`);
    } catch (e) {
      if (!dryRun) {
        // Eén melding per dagboek (de dedupe-index houdt herhalingen tegen).
        await notify(db, tenantId, `odoo_pos_z_journal:${journalId}`, "Kassa-omzet niet naar Odoo",
          `De Z-rapporten van de kassa kunnen niet naar Odoo: ${errMsg(e)}`, { journal_id: journalId });
        return { ...res, error: errMsg(e) };
      }
      checks.push(errMsg(e));
    }
  }

  const taxCache = new Map<string, number>();
  const rateOfTax = new Map<number, number>();
  const taxFor = async (rate: number, included: boolean): Promise<number> => {
    const key = `${rate}:${included}`;
    const hit = taxCache.get(key);
    if (hit) return hit;
    const id = await odoo!.findTax(rate, included);
    taxCache.set(key, id);
    rateOfTax.set(id, rate);
    return id;
  };
  let partnerId: number | null = null;
  const partner = async (): Promise<number> => {
    if (partnerId) return partnerId;
    const cached = Number(settings.channel_partner_ids?.pos);
    if (Number.isFinite(cached) && cached > 0 && await odoo!.partnerExists(cached)) return (partnerId = cached);
    const found = await odoo!.findPartner(partnerName);
    partnerId = found ?? await odoo!.createPartner(partnerName);
    const ids = { ...(settings.channel_partner_ids ?? {}), pos: partnerId };
    await db.from("tenant_odoo_settings").update({ channel_partner_ids: ids }).eq("tenant_id", tenantId);
    settings.channel_partner_ids = ids;
    return partnerId;
  };

  for (const r of batch) {
    const base: ZResult = { report_id: r.id, report_no: r.report_no, booking_date: r.booking_date, status: "failed" };
    if (Date.now() > args.deadline) { res.remaining += 1; continue; }
    const planned = planZBooking(r, { partnerLabel: label });
    if (!planned.ok) {
      const out: ZResult = { ...base, status: "invalid", error: planned.reason };
      if (!dryRun) {
        const prev = failedRow.get(r.id);
        if (prev) {
          await db.from("odoo_pos_z_sync_log").update({ error_message: planned.reason, attempts: (prev.attempts ?? 1) + 1, finished_at: now().toISOString() })
            .eq("id", prev.id).eq("sync_status", "failed");
        } else {
          await db.from("odoo_pos_z_sync_log").insert({
            tenant_id: tenantId, kassa_report_id: r.id, report_no: r.report_no, booking_date: r.booking_date,
            sync_status: "failed", error_message: planned.reason, finished_at: now().toISOString(),
          });
        }
        await notify(db, tenantId, `odoo_pos_z_failed:${r.id}`, `Z-rapport ${r.report_no ?? "?"} niet naar Odoo`,
          `Z-rapport ${r.report_no ?? "?"} (${dateNl(r.booking_date)}) kon niet geboekt worden: ${planned.reason}.`, { kassa_report_id: r.id });
      }
      res.reports.push(out);
      continue;
    }
    const plan = planned.plan;
    const summary: ZResult = {
      ...base, name: plan.name, move_type: plan.moveType, expected: plan.expected, per_rate: plan.perRate, exact: plan.exact,
      lines: plan.lines.map((l) => ({ name: l.name, price_unit: l.price_unit, rate: l.rate })),
    };

    // R7: lege Z.
    if (plan.empty) {
      if (dryRun) { res.reports.push({ ...summary, status: "would_skip" }); continue; }
      const { error } = await db.from("odoo_pos_z_sync_log").insert({
        tenant_id: tenantId, kassa_report_id: r.id, report_no: r.report_no, booking_date: r.booking_date,
        sync_status: "skipped", error_message: "lege Z (geen omzet)", odoo_move_name: plan.name, finished_at: now().toISOString(),
      });
      res.reports.push({ ...summary, status: error ? "busy" : "skipped", ...(error && error.code !== "23505" ? { error: errMsg(error) } : {}) });
      continue;
    }

    if (dryRun) {
      // R9: enkel lezen.
      const out: ZResult = { ...summary, status: "would_book" };
      if (odoo) {
        try {
          for (const l of plan.lines) await taxFor(l.rate, l.included);
          const ex = await odoo.findMove(plan.name, journalId, plan.moveType);
          out.existing_move = ex?.id ?? null;
        } catch (e) { out.error = errMsg(e); }
      }
      res.reports.push(out);
      continue;
    }

    // R6: claimen. De unieke index laat maar één pending/synced/skipped-rij per Z toe.
    const amounts = { untaxed: plan.expected.untaxed, tax: plan.expected.tax, total: plan.expected.total, per_rate: plan.perRate, exact: plan.exact };
    // Een eerdere mislukte poging: diezelfde rij terug op pending zetten (voorwaardelijk op
    // 'failed', dus een gelijktijdige run kan ze niet ook nemen; de unieke index weigert een
    // tweede pending). Anders een nieuwe rij.
    const prev = failedRow.get(r.id);
    const { data: claim, error: claimErr } = prev
      ? await db.from("odoo_pos_z_sync_log").update({
          sync_status: "pending", created_at: now().toISOString(), finished_at: null, error_message: null,
          odoo_move_name: plan.name, move_type: plan.moveType, amounts, attempts: (prev.attempts ?? 1) + 1,
        }).eq("id", prev.id).eq("sync_status", "failed").select("id").maybeSingle()
      : await db.from("odoo_pos_z_sync_log").insert({
          tenant_id: tenantId, kassa_report_id: r.id, report_no: r.report_no, booking_date: r.booking_date,
          sync_status: "pending", odoo_move_name: plan.name, move_type: plan.moveType, amounts,
        }).select("id").single();
    // (update … maybeSingle geeft één rij; defensief ook een lijst aanvaarden)
    const claimRow = Array.isArray(claim) ? claim[0] : claim;
    if (claimErr || !claimRow?.id) {
      res.reports.push({ ...summary, status: "busy", ...(claimErr && claimErr.code !== "23505" ? { error: errMsg(claimErr) } : {}) });
      continue;
    }
    const logId = claimRow.id as string;

    let mismatchNotified = false;
    try {
      const odooLines: unknown[] = [];
      for (const l of plan.lines) {
        const taxId = await taxFor(l.rate, l.included);
        odooLines.push([0, 0, { name: l.name, quantity: 1, price_unit: l.price_unit, tax_ids: [[6, 0, [taxId]]] }]);
      }
      const pid = await partner();
      let moveId: number;
      const ex = await odoo!.findMove(plan.name, journalId, plan.moveType);
      if (ex) {
        // Hergebruik enkel als het echt deze Z is (zelfde verzamelklant en bedrijfsdag).
        if (ex.partner_id !== pid || String(ex.invoice_date ?? "").slice(0, 10) !== plan.bookingDate) {
          throw new Error(`In Odoo bestaat al een boeking ${plan.name} in dit dagboek die niet bij deze Z hoort (Odoo-id ${ex.id}). Niets gewijzigd.`);
        }
        moveId = ex.id;
      } else {
        moveId = await odoo!.createMove({
          move_type: plan.moveType,
          partner_id: pid,
          invoice_date: plan.bookingDate,
          name: plan.name,
          journal_id: journalId,
          ref: plan.ref,
          narration: plan.narration,
          fiscal_position_id: false,
          invoice_line_ids: odooLines,
        });
      }
      await db.from("odoo_pos_z_sync_log").update({ odoo_move_id: String(moveId) }).eq("id", logId);
      const mv = await odoo!.readMove(moveId);
      const diffs = compareMove(plan, mv, rateOfTax);
      if (diffs.length) {
        const msg = `ODOO_MISMATCH: ${diffs.join("; ")} (boeking ${plan.name}, Odoo-id ${moveId}, ${mv.state === "draft" ? "concept, niet geboekt" : mv.state})`;
        await notify(db, tenantId, `odoo_pos_z_mismatch:${r.id}`, `Odoo-boeking ${plan.name} (Z ${plan.reportNo}) wijkt af`,
          `${msg}. Niets definitief geboekt; kijk het concept in Odoo na. Verwacht volgens het Z-rapport: ${plan.perRate.map((x) => `${x.rate}% maatstaf ${(x.net / 100).toFixed(2)} btw ${(x.vat / 100).toFixed(2)}`).join(", ")}.`,
          { kassa_report_id: r.id, number: plan.name, odoo_move_id: moveId });
        mismatchNotified = true;
        throw new Error(msg);
      }
      let state = mv.state;
      if (state === "draft" && settings.odoo_auto_post !== false) {
        await odoo!.post(moveId);
        state = "posted";
      }
      await db.from("odoo_pos_z_sync_log").update({
        sync_status: "synced", odoo_move_id: String(moveId), odoo_state: state, error_message: null, finished_at: now().toISOString(),
      }).eq("id", logId);
      res.reports.push({ ...summary, status: "synced", odoo_move_id: moveId, odoo_state: state });
    } catch (e) {
      const msg = errMsg(e);
      await db.from("odoo_pos_z_sync_log").update({ sync_status: "failed", error_message: msg, finished_at: now().toISOString() }).eq("id", logId);
      if (!mismatchNotified) {
        await notify(db, tenantId, `odoo_pos_z_failed:${r.id}`, `Z-rapport ${plan.reportNo} niet naar Odoo`,
          `Z-rapport ${plan.reportNo} (${dateNl(plan.bookingDate)}) kon niet in Odoo geboekt worden: ${msg}`, { kassa_report_id: r.id, number: plan.name });
      }
      res.reports.push({ ...summary, status: "failed", error: msg });
    }
  }
  if (checks.length) res.checks = checks;
  return res;
}
