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
/** Kanaalsleutel in channel_aliases/channel_partner_ids. Niet 'pos': dat is een orders.sales_channel
 *  dat sync-odoo-invoices ook als kanaal gebruikt (review 1, punt 9). */
export const POS_Z_CHANNEL = "pos_z";
/** Standaardnaam van de verzamelklant (channel_aliases.pos_z overschrijft). */
export const DEFAULT_POS_LABEL = "Kassaverkopen";
/** Een claim zonder afloop ouder dan dit = onderbroken run. */
export const STALE_PENDING_MS = 30 * 60_000;
/** Backoff (review 1, punt 4): tot zoveel pogingen elke run, daarna één per dag. */
export const HOURLY_ATTEMPTS = 3;
/** Na zoveel pogingen: eindstatus needs_review, geen automatische pogingen meer. */
export const MAX_ATTEMPTS = 10;
export const DAILY_MS = 24 * 3600_000;

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
  // Review 1 (punt 7): eerst over ALLE m een oplossing zoeken waarbij de rest het teken van de
  // omzet houdt; pas als die er niet is (kleine dag) een rest met omgekeerd teken. Beide zijn
  // even exact; dit kiest enkel de leesbaarste.
  for (const strict of [true, false]) {
    for (let m = 1; m < maxLines; m++) {
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
  // Review 1 (punt 4): bij een inclusieve btw-code kan je het btw-bedrag niet los aanpassen.
  if (!exact) lines.push("LET OP: de btw-verdeling over regels lukte niet. Odoo rekent hierdoor een andere btw dan het Z-rapport. Pas de regels van dit concept aan tot Odoo per tarief dezelfde maatstaf en btw toont als het Z-rapport, of boek deze Z apart met de hand. Aanvaard de boeking daarna in SellQo (Odoo Boekhouding › Laatste Z-rapporten).");
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
  /** Factuurdatum en boekingsdatum zoals Odoo ze bewaart (review 2 punt 5). */
  invoice_date?: string | null;
  date?: string | null;
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
  // Review 2 punt 5: een vergrendelde periode kan de boekingsdatum verschuiven.
  for (const [label, v] of [["factuurdatum", mv.invoice_date], ["boekingsdatum", mv.date]] as const) {
    if (v !== undefined && String(v ?? "").slice(0, 10) !== plan.bookingDate) diffs.push(`${label} ${v || "leeg"} ≠ bedrijfsdag ${plan.bookingDate}`);
  }
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

export interface OdooMoveHead { id: number; name: string; state: string; move_type: string; partner_id: number | null; invoice_date: string | null }

export interface PosZOdoo {
  journal(id: number): Promise<{ id: number; name: string; type: string } | null>;
  /** Exacte naam (INCL_TAX_NAME / ZERO_TAX_NAME), verkoop, juiste inclusief-instelling. Gooit als ze ontbreekt. */
  findTax(rate: number, included: boolean): Promise<number>;
  findPartner(name: string): Promise<number | null>;
  createPartner(name: string): Promise<number>;
  /** Naam van een partner, null als die niet (meer) bestaat. */
  partnerName(id: number): Promise<string | null>;
  /** Boekingen met deze naam en soort, niet geannuleerd; journalId null = in elk dagboek (review 2 punt 9). */
  findMoves(name: string, journalId: number | null, moveType: string): Promise<OdooMoveHead[]>;
  /** Een boeking op id, ongeacht dagboek (review 1, punt 8). null als ze niet bestaat. */
  getMove(id: number): Promise<OdooMoveHead | null>;
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
  /** Gezet door de trigger bij het aanzetten (review 1, punt 1). */
  pos_z_enabled_at?: string | null;
  /** Vroegste bevestigde startdatum (enkel via de RPC odoo_pos_z_confirm_backfill). */
  pos_z_backfill_from?: string | null;
}

export interface ZResult {
  report_id: string;
  report_no: number | null;
  booking_date: string;
  status: "synced" | "failed" | "skipped" | "busy" | "needs_review" | "would_book" | "would_skip" | "invalid" | "deferred" | "stopped";
  name?: string;
  move_type?: string;
  odoo_move_id?: number;
  odoo_state?: string;
  existing_move?: number | null;
  expected?: Amounts;
  per_rate?: ZRate[];
  lines?: { name: string; price_unit: number; rate: number }[];
  exact?: boolean;
  attempts?: number;
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
  /** Bedrijfsdag van de oudste open Z (voor de volgorde over tenants). */
  oldest_open?: string | null;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

/** Tijdsbudget op: geen poging, telt niet mee voor de backoff (review 1, punt 6). */
export class DeadlineError extends Error {
  constructor() { super("tijdsbudget op, volgende run"); }
}

/** Elke Odoo-aanroep pas na een blik op de klok. */
export function guardOdoo(odoo: PosZOdoo, deadline: number): PosZOdoo {
  const g = <A extends unknown[], R>(f: (...a: A) => Promise<R>) => (...a: A): Promise<R> =>
    Date.now() > deadline ? Promise.reject(new DeadlineError()) : f(...a);
  return {
    journal: g(odoo.journal.bind(odoo)), findTax: g(odoo.findTax.bind(odoo)), findPartner: g(odoo.findPartner.bind(odoo)),
    createPartner: g(odoo.createPartner.bind(odoo)), partnerName: g(odoo.partnerName.bind(odoo)), findMoves: g(odoo.findMoves.bind(odoo)),
    getMove: g(odoo.getMove.bind(odoo)), createMove: g(odoo.createMove.bind(odoo)), readMove: g(odoo.readMove.bind(odoo)), post: g(odoo.post.bind(odoo)),
  };
}

/** Kalenderdag in Brussel (JJJJ-MM-DD). */
export function brusselsDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
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

/** Review 1 (punt 3): een fout op winkelniveau meldt één keer per soort en per dag. */
function notifyTenant(db: Db, tenantId: string, kind: string, now: Date, message: string) {
  return notify(db, tenantId, `odoo_pos_z_tenant:${kind}:${brusselsDate(now)}`, "Kassa-omzet niet naar Odoo",
    `De Z-rapporten van de kassa kunnen niet naar Odoo: ${message}`, { kind });
}

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);

/** Odoo-URL vergelijkbaar maken (hoofdletters, slash, poort 443). */
export function normalizeOdooUrlKey(u: string | null | undefined): string {
  return String(u ?? "").trim().toLowerCase().replace(/\/+$/, "").replace(/:443$/, "");
}

/** R8: een dagboek van een andere tenant op dezelfde Odoo (url + db) is taboe. */
async function journalTakenByOther(db: Db, tenantId: string, journalId: number): Promise<boolean> {
  const { data: me } = await db.from("tenant_odoo_credentials").select("odoo_url, odoo_db").eq("tenant_id", tenantId).maybeSingle();
  if (!me) return false;
  // Op db filteren, de URL genormaliseerd in het geheugen vergelijken (review 1, punt 8).
  const { data: sameDb } = await db.from("tenant_odoo_credentials").select("tenant_id, odoo_url").eq("odoo_db", me.odoo_db).neq("tenant_id", tenantId);
  const ids = ((sameDb ?? []) as { tenant_id: string; odoo_url: string }[])
    .filter((r) => normalizeOdooUrlKey(r.odoo_url) === normalizeOdooUrlKey(me.odoo_url)).map((r) => r.tenant_id);
  if (!ids.length) return false;
  const { data: rows, error } = await db.from("tenant_odoo_settings").select("tenant_id, odoo_journal_id, pos_z_journal_id").in("tenant_id", ids);
  if (error) throw new Error(`dagboekcontrole: ${errMsg(error)}`);
  return ((rows ?? []) as { odoo_journal_id: string | null; pos_z_journal_id: string | null }[])
    .some((r) => String(r.odoo_journal_id ?? "") === String(journalId) || String(r.pos_z_journal_id ?? "") === String(journalId));
}

interface ZLite { id: string; report_no: number | null; booking_date: string }

/** Review 1 (punt 5): eerst enkel id, nummer en dag (geen data-jsonb). */
async function loadReportIds(db: Db, tenantId: string, from: string, reportIds?: string[]): Promise<ZLite[]> {
  const out: ZLite[] = [];
  for (let off = 0; ; off += 1000) {
    // Review 2 punt 12: historische imports al hier weglaten (json-pad is null = sleutel ontbreekt).
    let q = db.from("kassa_reports").select("id, report_no, booking_date").eq("tenant_id", tenantId).eq("kind", "Z").gte("booking_date", from)
      .is("data->historical_import", null);
    if (reportIds?.length) q = q.in("id", reportIds);
    const { data, error } = await q.order("report_no", { ascending: true }).range(off, off + 999);
    if (error) throw new Error(`kassa_reports: ${errMsg(error)}`);
    out.push(...((data ?? []) as ZLite[]));
    if (!data || data.length < 1000) return out;
  }
}

async function loadReportsData(db: Db, tenantId: string, ids: string[]): Promise<Map<string, ZReportRow>> {
  if (!ids.length) return new Map();
  const { data, error } = await db.from("kassa_reports")
    .select("id, tenant_id, kind, report_no, booking_date, period_start, period_end, data")
    .eq("tenant_id", tenantId).in("id", ids);
  if (error) throw new Error(`kassa_reports: ${errMsg(error)}`);
  return new Map(((data ?? []) as ZReportRow[]).map((r) => [r.id, r]));
}

export interface LogRow {
  id: string; kassa_report_id: string; sync_status: string; created_at: string;
  attempts: number | null; finished_at: string | null; odoo_move_id: string | null;
  deferrals?: number | null; retry_round?: number | null;
}

/** Na zoveel uitgestelde runs (tijdsbudget) een melding (review 2 M1). */
export const MAX_DEFERRALS = 5;

async function loadLogs(db: Db, tenantId: string): Promise<LogRow[]> {
  const out: LogRow[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db.from("odoo_pos_z_sync_log")
      .select("id, kassa_report_id, sync_status, created_at, attempts, finished_at, odoo_move_id, deferrals, retry_round")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .range(off, off + 999);
    if (error) throw new Error(`odoo_pos_z_sync_log: ${errMsg(error)}`);
    out.push(...((data ?? []) as LogRow[]));
    if (!data || data.length < 1000) return out;
  }
}

/** Mag een mislukte Z nu opnieuw? (review 1, punt 4) */
export function retryDue(l: Pick<LogRow, "attempts" | "finished_at">, now: Date): boolean {
  const n = l.attempts ?? 1;
  if (n >= MAX_ATTEMPTS) return false;
  if (n < HOURLY_ATTEMPTS) return true;
  const last = l.finished_at ? Date.parse(l.finished_at) : 0;
  return now.getTime() - last >= DAILY_MS;
}

const first = (x: any) => (Array.isArray(x) ? x[0] : x);

export interface TenantArgs {
  db: Db;
  tenantId: string;
  tenantName: string;
  settings: PosZSettings;
  dryRun: boolean;
  maxPerRun?: number;
  fromDate?: string | null;
  reportIds?: string[];
  now?: () => Date;
}

export interface PreparedTenant {
  result: TenantZResult;
  /** null = klaar (overgeslagen, fout of niets te doen). */
  work: null | {
    from: string; journalId: number; journalName: string | null; label: string; partnerName: string;
    batch: ZLite[]; failedRow: Map<string, LogRow>;
  };
}

/**
 * Stap 1 (zonder Odoo): instellingen, startdatum, dagboek, welke Z's open staan. Verlopen claims
 * worden hier vrijgegeven. Index.ts doet dit voor alle tenants en begint met de oudste open Z.
 */
export async function prepareTenantZ(args: TenantArgs): Promise<PreparedTenant> {
  const { db, tenantId, settings, dryRun } = args;
  const now = args.now ?? (() => new Date());
  const res: TenantZResult = { reports: [], remaining: 0 };
  const done = (r: TenantZResult): PreparedTenant => ({ result: r, work: null });
  const maxPerRun = Math.min(Math.max(args.maxPerRun ?? 20, 1), 100);

  // R8: standaard uit. Een proefrun mag een tenant met de schakelaar uit bekijken.
  if (!dryRun && settings.pos_z_sync_enabled !== true) return done({ ...res, skipped: "kassa-naar-Odoo staat uit" });
  if (!dryRun && settings.odoo_sync_enabled !== true) return done({ ...res, skipped: "Odoo-sync staat uit" });
  const today = brusselsDate(now());
  const from = (dryRun ? args.fromDate : null) ?? settings.pos_z_sync_from ?? (dryRun ? addDays(today, -31) : null);
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return done({ ...res, skipped: "geen startdatum (pos_z_sync_from)" });
  res.from = from;

  // Review 1 (punt 1), tweede slot naast de trigger: nooit vóór het aanzetmoment, tenzij de
  // terugwerkende kracht via de RPC bevestigd werd (pos_z_backfill_from). De trigger rekent exact met
  // de bedrijfsdag (afkapuur); die kan één kalenderdag vóór de Brusselse dag liggen, vandaar -1 hier.
  if (!dryRun) {
    if (!settings.pos_z_enabled_at) {
      await notifyTenant(db, tenantId, "no_enabled_at", now(), "het aanzetmoment ontbreekt; zet de schakelaar opnieuw aan.");
      return done({ ...res, error: "aanzetmoment (pos_z_enabled_at) ontbreekt" });
    }
    const minDay = [addDays(brusselsDate(new Date(settings.pos_z_enabled_at)), -1), settings.pos_z_backfill_from].filter(Boolean).sort()[0] as string;
    if (from < minDay) {
      await notifyTenant(db, tenantId, "from_unconfirmed", now(), `de startdatum ${dateNl(from)} ligt vóór het aanzetten en is niet bevestigd.`);
      return done({ ...res, error: `startdatum ${from} vóór het aanzetmoment zonder bevestiging` });
    }
  }

  const journalId = Number(settings.pos_z_journal_id || settings.odoo_journal_id);
  const journalName = settings.pos_z_journal_id ? settings.pos_z_journal_name : settings.odoo_journal_name;
  if (!Number.isFinite(journalId) || journalId <= 0) {
    if (!dryRun) await notifyTenant(db, tenantId, "no_journal", now(), "er is geen Odoo-dagboek ingesteld.");
    return done({ ...res, error: "Geen Odoo-dagboek ingesteld voor de kassa of de facturen." });
  }
  res.journal_id = journalId;
  if (await journalTakenByOther(db, tenantId, journalId)) {
    if (!dryRun) await notifyTenant(db, tenantId, "journal_taken", now(), `Odoo-dagboek ${journalId} wordt al gebruikt door een andere winkel op dezelfde Odoo.`);
    return done({ ...res, error: `Odoo-dagboek ${journalId} wordt al gebruikt door een andere winkel op dezelfde Odoo.` });
  }

  const label = (settings.channel_aliases?.[POS_Z_CHANNEL] ?? "").trim() || DEFAULT_POS_LABEL;
  const partnerName = `${label} — ${args.tenantName}`;
  res.partner = partnerName;

  const reports = await loadReportIds(db, tenantId, from, args.reportIds);
  const logs = await loadLogs(db, tenantId);
  const closed = new Set<string>(); // synced, skipped, accepted, needs_review: nooit automatisch
  const busy = new Set<string>();
  const waiting = new Set<string>(); // backoff
  const failedRow = new Map<string, LogRow>();
  for (const l of logs) {
    if (["synced", "skipped", "accepted", "needs_review"].includes(l.sync_status)) closed.add(l.kassa_report_id);
    else if (l.sync_status === "failed") failedRow.set(l.kassa_report_id, l);
    else if (l.sync_status === "pending") {
      if (now().getTime() - Date.parse(l.created_at) < STALE_PENDING_MS) busy.add(l.kassa_report_id);
      else if (!dryRun) {
        // Onderbroken run: de claim vrijgeven, enkel als ze nog is wat we zagen (review 1, punt 2).
        const { data: rel } = await db.from("odoo_pos_z_sync_log")
          .update({ sync_status: "failed", error_message: "onderbroken run (claim verlopen)", finished_at: now().toISOString() })
          .eq("id", l.id).eq("sync_status", "pending").eq("created_at", l.created_at).eq("attempts", l.attempts ?? 1)
          .select("id");
        if (first(rel)?.id) failedRow.set(l.kassa_report_id, { ...l, sync_status: "failed", finished_at: now().toISOString() });
        else busy.add(l.kassa_report_id);
      } else busy.add(l.kassa_report_id);
    }
  }
  for (const [id, l] of failedRow) if (!retryDue(l, now())) waiting.add(id);
  const open = reports.filter((r) => !closed.has(r.id) && !busy.has(r.id) && !waiting.has(r.id));
  const ordered = [...open.filter((r) => !failedRow.has(r.id)), ...open.filter((r) => failedRow.has(r.id))];
  const batch = ordered.slice(0, maxPerRun);
  res.remaining = ordered.length - batch.length;
  res.oldest_open = open.length ? open.map((r) => r.booking_date).sort()[0] : null;
  for (const r of reports) if (busy.has(r.id)) res.reports.push({ report_id: r.id, report_no: r.report_no, booking_date: r.booking_date, status: "busy" });
  if (!batch.length) return done(res);
  return { result: res, work: { from, journalId, journalName: journalName ?? null, label, partnerName, batch, failedRow } };
}

/** Stap 2: de batch boeken (of tonen bij een proefrun). */
export async function runPreparedZ(args: TenantArgs & {
  prepared: PreparedTenant; odoo: PosZOdoo | null; odooNote?: string; deadline: number;
}): Promise<TenantZResult> {
  const { db, tenantId, settings, dryRun, prepared } = args;
  const now = args.now ?? (() => new Date());
  const res = prepared.result;
  if (!prepared.work) return res;
  const { journalId, journalName, label, partnerName, batch, failedRow } = prepared.work;
  const odoo = args.odoo ? guardOdoo(args.odoo, args.deadline) : null;

  const checks: string[] = [];
  if (!odoo) {
    if (!dryRun) {
      await notifyTenant(db, tenantId, "odoo_connection", now(), args.odooNote ?? "geen Odoo-verbinding");
      return { ...res, error: args.odooNote ?? "Geen Odoo-verbinding" };
    }
    checks.push(`Odoo niet gelezen: ${args.odooNote ?? "geen verbinding"}`);
  } else {
    try {
      const j = await odoo.journal(journalId);
      if (!j) throw new Error(`Odoo-dagboek ${journalId} bestaat niet meer.`);
      if (j.type !== "sale") throw new Error(`Odoo-dagboek ${j.name} is geen verkoopdagboek (type=${j.type}).`);
      if (journalName && j.name !== journalName) throw new Error(`Odoo-dagboek heet nu '${j.name}' i.p.v. '${journalName}'. Kies het opnieuw in de instellingen.`);
    } catch (e) {
      if (e instanceof DeadlineError) return { ...res, remaining: res.remaining + batch.length };
      if (!dryRun) {
        await notifyTenant(db, tenantId, "journal", now(), errMsg(e));
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
  // De verzamelklant zoals ze bij de start gecachet was (een oude boeking kan die nog dragen).
  const initialPartnerId = Number(settings.channel_partner_ids?.[POS_Z_CHANNEL]) || null;
  let partnerId: number | null = null;
  const partner = async (): Promise<number> => {
    if (partnerId) return partnerId;
    // Gecachet id enkel als die partner nog bestaat én (nog) zo heet (review 1, punt 8).
    const cached = Number(settings.channel_partner_ids?.[POS_Z_CHANNEL]);
    if (Number.isFinite(cached) && cached > 0 && await odoo!.partnerName(cached) === partnerName) return (partnerId = cached);
    const found = await odoo!.findPartner(partnerName);
    partnerId = found ?? await odoo!.createPartner(partnerName);
    const ids = { ...(settings.channel_partner_ids ?? {}), [POS_Z_CHANNEL]: partnerId };
    await db.from("tenant_odoo_settings").update({ channel_partner_ids: ids }).eq("tenant_id", tenantId);
    settings.channel_partner_ids = ids;
    return partnerId;
  };

  const data = await loadReportsData(db, tenantId, batch.map((b) => b.id));

  for (const lite of batch) {
    const base: ZResult = { report_id: lite.id, report_no: lite.report_no, booking_date: lite.booking_date, status: "failed" };
    if (Date.now() > args.deadline) { res.remaining += 1; continue; }
    const r = data.get(lite.id);
    if (!r) continue; // intussen weg
    const prev = failedRow.get(r.id);
    const round = prev?.retry_round ?? 0;
    if (r.data?.historical_import) {
      // R8: nooit boeken; als skipped loggen zodat ze niet elke run opnieuw in de batch komt.
      if (!dryRun && !prev) {
        await db.from("odoo_pos_z_sync_log").insert({ tenant_id: tenantId, kassa_report_id: r.id, report_no: r.report_no, booking_date: r.booking_date,
          sync_status: "skipped", attempts: 1, error_message: "historische import", finished_at: now().toISOString() });
      }
      res.reports.push({ ...base, status: dryRun ? "would_skip" : "skipped", error: "historische import" });
      continue;
    }
    const planned = planZBooking(r, { partnerLabel: label });
    if (!planned.ok) {
      // Een ongeldige Z wordt niet vanzelf geldig: meteen needs_review, geen herhaling.
      const out: ZResult = { ...base, status: "invalid", error: planned.reason };
      if (!dryRun) {
        if (prev) {
          await db.from("odoo_pos_z_sync_log").update({ sync_status: "needs_review", error_message: planned.reason, finished_at: now().toISOString() })
            .eq("id", prev.id).eq("sync_status", "failed").eq("attempts", prev.attempts ?? 1);
        } else {
          await db.from("odoo_pos_z_sync_log").insert({
            tenant_id: tenantId, kassa_report_id: r.id, report_no: r.report_no, booking_date: r.booking_date,
            sync_status: "needs_review", attempts: 1, error_message: planned.reason, finished_at: now().toISOString(),
          });
        }
        await notify(db, tenantId, `odoo_pos_z_needs_review:${r.id}:r${round}`, `Z-rapport ${r.report_no ?? "?"} niet naar Odoo`,
          `Z-rapport ${r.report_no ?? "?"} (${dateNl(r.booking_date)}) kan niet geboekt worden: ${planned.reason}. Boek het met de hand en aanvaard het in SellQo.`, { kassa_report_id: r.id });
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
      const patch = { sync_status: "skipped", error_message: "lege Z (geen omzet)", odoo_move_name: plan.name, finished_at: now().toISOString() };
      const { error } = prev
        ? await db.from("odoo_pos_z_sync_log").update(patch).eq("id", prev.id).eq("sync_status", "failed").eq("attempts", prev.attempts ?? 1)
        : await db.from("odoo_pos_z_sync_log").insert({ tenant_id: tenantId, kassa_report_id: r.id, report_no: r.report_no, booking_date: r.booking_date, attempts: 1, ...patch });
      res.reports.push({ ...summary, status: error ? "busy" : "skipped", ...(error && error.code !== "23505" ? { error: errMsg(error) } : {}) });
      continue;
    }

    if (dryRun) {
      // R9: enkel lezen.
      const out: ZResult = { ...summary, status: "would_book" };
      if (odoo) {
        try {
          for (const l of plan.lines) await taxFor(l.rate, l.included);
          const ex = await odoo.findMoves(plan.name, journalId, plan.moveType);
          out.existing_move = ex[0]?.id ?? null;
        } catch (e) { out.error = errMsg(e); }
      }
      res.reports.push(out);
      continue;
    }

    // Review 2 punt 13: staat de schakelaar (of de factuursync) intussen uit? Dan stoppen.
    const { data: live } = await db.from("tenant_odoo_settings").select("pos_z_sync_enabled, odoo_sync_enabled").eq("tenant_id", tenantId).maybeSingle();
    if (!live?.pos_z_sync_enabled || !live?.odoo_sync_enabled) {
      res.reports.push({ ...summary, status: "stopped", error: "intussen uitgezet" });
      break;
    }

    // R6: claimen. Een eerdere mislukte poging: diezelfde rij, compare-and-swap op status én
    // aantal pogingen (review 1, punt 2). Anders een nieuwe rij; de unieke index weigert een tweede.
    const attempts = (prev?.attempts ?? 0) + 1;
    const amounts = { untaxed: plan.expected.untaxed, tax: plan.expected.tax, total: plan.expected.total, per_rate: plan.perRate, exact: plan.exact };
    const claimPatch = { sync_status: "pending", odoo_move_name: plan.name, move_type: plan.moveType, amounts, attempts, error_message: null, finished_at: null };
    const { data: claim, error: claimErr } = prev
      ? await db.from("odoo_pos_z_sync_log").update({ ...claimPatch, created_at: now().toISOString() })
          .eq("id", prev.id).eq("sync_status", "failed").eq("attempts", prev.attempts ?? 1).select("id").maybeSingle()
      : await db.from("odoo_pos_z_sync_log").insert({ tenant_id: tenantId, kassa_report_id: r.id, report_no: r.report_no, booking_date: r.booking_date, ...claimPatch })
          .select("id").single();
    const claimRow = first(claim);
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
      // Is dit echt deze Z? Zelfde naam, soort en bedrijfsdag, en als klant de huidige verzamelklant,
      // de gecachete van bij de start, of een partner met de huidige naam (review 2 punt 8).
      const ours = async (m: OdooMoveHead | null): Promise<boolean> => {
        if (!m || m.state === "cancel" || m.name !== plan.name || m.move_type !== plan.moveType) return false;
        if (String(m.invoice_date ?? "").slice(0, 10) !== plan.bookingDate) return false;
        if (m.partner_id != null && (m.partner_id === pid || m.partner_id === initialPartnerId)) return true;
        return m.partner_id != null && (await odoo!.partnerName(m.partner_id)) === partnerName;
      };
      let moveId: number | null = null;
      // Review 1 (punt 8): eerst de boeking van een vorige poging, ongeacht het dagboek.
      const prevMoveId = Number(prev?.odoo_move_id);
      if (Number.isFinite(prevMoveId) && prevMoveId > 0) {
        const pm = await odoo!.getMove(prevMoveId);
        if (pm && pm.state !== "cancel") {
          if (!(await ours(pm))) throw new Error(`De Odoo-boeking van de vorige poging (Odoo-id ${pm.id}, ${pm.name}) hoort niet meer bij deze Z. Niets gewijzigd.`);
          moveId = pm.id;
        }
      }
      if (!moveId) {
        // In het dagboek: een vreemde boeking met dezelfde naam blokkeert (Odoo eist een unieke naam).
        const inJournal = await odoo!.findMoves(plan.name, journalId, plan.moveType);
        for (const m of inJournal) {
          if (await ours(m)) { moveId = m.id; break; }
        }
        if (!moveId && inJournal.length) {
          throw new Error(`In Odoo bestaat al een boeking ${plan.name} in dit dagboek die niet bij deze Z hoort (Odoo-id ${inJournal[0].id}). Niets gewijzigd.`);
        }
        // Daarna in elk dagboek (bv. na een wissel van kassadagboek): enkel hergebruiken als het de onze is.
        if (!moveId) {
          for (const m of await odoo!.findMoves(plan.name, null, plan.moveType)) {
            if (await ours(m)) { moveId = m.id; break; }
          }
        }
      }
      if (!moveId) {
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
        await notify(db, tenantId, `odoo_pos_z_mismatch:${r.id}:r${round}`, `Odoo-boeking ${plan.name} (Z ${plan.reportNo}) wijkt af`,
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
      res.reports.push({ ...summary, status: "synced", odoo_move_id: moveId, odoo_state: state, attempts });
    } catch (e) {
      const msg = errMsg(e);
      if (e instanceof DeadlineError) {
        // Geen echte poging: de teller terug. Wel tellen: blijft een Z telkens liggen, dan melden
        // (review 2 M1).
        const deferrals = (prev?.deferrals ?? 0) + 1;
        await db.from("odoo_pos_z_sync_log").update({ sync_status: "failed", attempts: attempts - 1, deferrals, error_message: msg, finished_at: now().toISOString() }).eq("id", logId);
        if (deferrals >= MAX_DEFERRALS) {
          await notify(db, tenantId, `odoo_pos_z_deferred:${r.id}:r${round}`, `Z-rapport ${plan.reportNo} blijft liggen`,
            `Z-rapport ${plan.reportNo} (${dateNl(plan.bookingDate)}) werd ${deferrals} keer uitgesteld omdat Odoo te traag antwoordt.`, { kassa_report_id: r.id });
        }
        res.reports.push({ ...summary, status: "deferred", error: msg });
        res.remaining += 1;
        continue;
      }
      const final = attempts >= MAX_ATTEMPTS;
      await db.from("odoo_pos_z_sync_log").update({ sync_status: final ? "needs_review" : "failed", error_message: msg, finished_at: now().toISOString() }).eq("id", logId);
      if (final) {
        await notify(db, tenantId, `odoo_pos_z_needs_review:${r.id}:r${round}`, `Z-rapport ${plan.reportNo} na ${attempts} pogingen niet in Odoo`,
          `Z-rapport ${plan.reportNo} (${dateNl(plan.bookingDate)}) lukte niet na ${attempts} pogingen: ${msg}. SellQo probeert niet meer vanzelf. Boek het met de hand en aanvaard het, of kies "Opnieuw proberen".`,
          { kassa_report_id: r.id, number: plan.name });
      } else if (!mismatchNotified) {
        await notify(db, tenantId, `odoo_pos_z_failed:${r.id}:r${round}`, `Z-rapport ${plan.reportNo} niet naar Odoo`,
          `Z-rapport ${plan.reportNo} (${dateNl(plan.bookingDate)}) kon niet in Odoo geboekt worden: ${msg}`, { kassa_report_id: r.id, number: plan.name });
      }
      res.reports.push({ ...summary, status: final ? "needs_review" : "failed", error: msg, attempts });
    }
  }
  if (checks.length) res.checks = checks;
  return res;
}

/** Beide stappen na elkaar (tests en losse aanroep). */
export async function syncTenantZ(args: TenantArgs & { odoo: PosZOdoo | null; odooNote?: string; deadline: number }): Promise<TenantZResult> {
  const prepared = await prepareTenantZ(args);
  return runPreparedZ({ ...args, prepared });
}
