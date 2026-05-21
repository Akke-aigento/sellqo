// export-vat-xlsx — generates a 9-tab Excel workbook from vat-report-engine
// output. Admin-only (JWT verified). Returns XLSX as binary download.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type PeriodType = 'monthly' | 'quarterly' | 'annual' | 'custom';
interface ReqBody {
  tenant_id: string;
  period_start: string;
  period_end: string;
  period_type: PeriodType;
}

// ---- Belgian VAT box descriptions (subset relevant to engine output) ----
const BOX_LABELS: Record<string, string> = {
  '00': 'Verkopen onderworpen aan 0% (BE)',
  '01': 'Verkopen onderworpen aan 6%',
  '02': 'Verkopen onderworpen aan 12%',
  '03': 'Verkopen onderworpen aan 21%',
  '44': 'Diensten verricht voor BTW-plichtigen in EU (IC-diensten)',
  '45': 'Werk in onroerende staat / medecontractant (verlegging)',
  '46': 'IC-leveringen van goederen / driehoeksverkeer',
  '47': 'Uitvoer buiten EU / overige vrijgestelde verkopen',
  '48': 'Negatieve correcties IC-omzet (CN op vakken 44/45/46)',
  '49': 'Negatieve correcties overige omzet (CN op vakken 00/03/47)',
  '54': 'Verschuldigde BTW op vakken 01/02/03',
  '55': 'Verschuldigde BTW op IC-aankopen (vak 86)',
  '56': 'Verschuldigde BTW op overige inkomende handelingen (medecontractant)',
  '57': 'Verschuldigde BTW op invoer (vak 87)',
  '59': 'Aftrekbare BTW op aankopen (vakken 81/82/83)',
  '61': 'Diverse BTW-regularisaties in voordeel van de Staat',
  '62': 'Diverse BTW-regularisaties in voordeel van de aangever',
  '63': 'Terug te storten BTW (uit 54+55+56+57-59+61-62-64)',
  '64': 'Te recupereren BTW op CN (compensatie)',
  '71': 'Aan de Staat verschuldigd saldo',
  '72': 'Door de Staat terug te storten saldo',
  '81': 'Inkopen handelsgoederen / grondstoffen',
  '82': 'Inkopen diensten en diverse goederen',
  '83': 'Inkopen bedrijfsmiddelen',
  '84': 'CN ontvangen op vakken 81/82/83',
  '85': 'CN ontvangen op IC-aankopen',
  '86': 'IC-aankopen van goederen',
  '87': 'Andere inkomende handelingen (verlegging / invoer)',
  '88': 'IC-aankopen van diensten',
};

const SALES_BOXES = ['00','01','02','03','44','45','46','47','48','49'];
const VAT_DUE_BOXES = ['54','55','56','57','59','61','62','63','64','71','72'];
const PURCHASE_BOXES = ['81','82','83','84','85','86','87','88'];

const BOX_FORMULA_NOTES: Record<string, string> = {
  '54': 'Verschuldigde output-BTW op vakken 01+02+03',
  '63': 'Berekend: 54+55+56+57-59+61-62-64',
  '71': 'Aan de Staat verschuldigd (saldo > 0)',
  '72': 'Door de Staat terug te storten (saldo < 0)',
};

const COUNTRY_NAMES: Record<string, string> = {
  BE: 'België', NL: 'Nederland', DE: 'Duitsland', FR: 'Frankrijk',
  LU: 'Luxemburg', IT: 'Italië', ES: 'Spanje', PT: 'Portugal',
  AT: 'Oostenrijk', IE: 'Ierland', DK: 'Denemarken', SE: 'Zweden',
  FI: 'Finland', PL: 'Polen', CZ: 'Tsjechië', SK: 'Slowakije',
  HU: 'Hongarije', RO: 'Roemenië', BG: 'Bulgarije', GR: 'Griekenland',
  HR: 'Kroatië', SI: 'Slovenië', EE: 'Estland', LV: 'Letland',
  LT: 'Litouwen', CY: 'Cyprus', MT: 'Malta', GB: 'Verenigd Koninkrijk',
  US: 'Verenigde Staten', CH: 'Zwitserland', NO: 'Noorwegen',
};

function slugify(s: string): string {
  return (s || 'tenant').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tenant';
}

function periodCode(start: string, end: string, type: PeriodType): string {
  const y = start.slice(0, 4);
  if (type === 'annual') return y;
  if (type === 'monthly') return start.slice(0, 7);
  if (type === 'quarterly') {
    const m = parseInt(start.slice(5, 7), 10);
    return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  }
  return `${start}_to_${end}`;
}

function fmtEur(n: number): string {
  if (!n) return '—';
  return n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map((w) => ({ wch: Math.min(w, 50) }));
}

function autoFilter(ws: XLSX.WorkSheet, range: string) {
  ws['!autofilter'] = { ref: range };
}

function freezeTopRow(ws: XLSX.WorkSheet) {
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  // openpyxl/xlsx libs use views; fallback via !views
  (ws as unknown as { ['!views']?: unknown[] })['!views'] = [{ state: 'frozen', ySplit: 1 }];
}

function styleHeader(ws: XLSX.WorkSheet, headerCells: string[]) {
  // xlsx (community build) ignores most styles; we still set cell types & number formats.
  for (const addr of headerCells) {
    const c = ws[addr] as { v?: unknown; s?: unknown } | undefined;
    if (c) {
      c.s = {
        fill: { fgColor: { rgb: 'F3F4F6' } },
        font: { name: 'Calibri', sz: 10, bold: true },
        alignment: { horizontal: 'left' },
      };
    }
  }
}

function applyEurFormat(ws: XLSX.WorkSheet, addrs: string[]) {
  for (const addr of addrs) {
    const c = ws[addr] as { t?: string; z?: string; s?: Record<string, unknown> } | undefined;
    if (c) {
      c.z = '#,##0.00';
      c.s = { ...(c.s || {}), font: { name: 'Calibri', sz: 10 }, alignment: { horizontal: 'right' } };
    }
  }
}

// ---- Tab builders ----

function buildTab1Declaration(payload: Record<string, unknown>): XLSX.WorkSheet {
  const meta = payload.metadata as Record<string, unknown>;
  const tenant = meta.tenant as Record<string, unknown>;
  const period = meta.period as Record<string, unknown>;
  const boxes = payload.declaration_boxes as Record<string, { amount: number; vat: number }>;

  const aoa: (string | number | null)[][] = [];
  aoa.push([`${tenant.name ?? 'Tenant'} — BTW-aangifte ${period.start} → ${period.end}`]);
  aoa.push([
    `BTW: ${tenant.vat_number ?? '—'}`,
    `KBO/KvK: ${tenant.kbo ?? '—'}`,
    `Gegenereerd: ${meta.generated_at}`,
  ]);
  aoa.push([]);
  aoa.push(['Vak', 'Omschrijving', 'Bedrag (EUR)']);

  const sections: [string, string[]][] = [
    ['Verkopen', SALES_BOXES],
    ['BTW verschuldigd / aftrek', VAT_DUE_BOXES],
    ['Aankopen', PURCHASE_BOXES],
  ];
  const boldRows: number[] = [];
  const noteCells: { addr: string; note: string }[] = [];

  for (const [, codes] of sections) {
    for (const code of codes) {
      const box = boxes?.[code] ?? { amount: 0, vat: 0 };
      // Vakken 54-72 dragen VAT-bedragen; vakken 00-49 / 81-88 dragen base.
      const display = VAT_DUE_BOXES.includes(code) ? box.vat : box.amount;
      aoa.push([code, BOX_LABELS[code] ?? '', display || 0]);
      const rowIdx = aoa.length; // 1-based
      if (display && Math.abs(display) > 0.005) boldRows.push(rowIdx);
      if (BOX_FORMULA_NOTES[code]) {
        noteCells.push({ addr: `A${rowIdx}`, note: BOX_FORMULA_NOTES[code] });
      }
    }
    aoa.push([]); // sectie-break
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  setColWidths(ws, [8, 60, 18]);

  // Merge title across A1:C1
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

  // Header styling row 4 (1-based) → A4..C4
  styleHeader(ws, ['A4', 'B4', 'C4']);

  // EUR formatting for column C from row 5 down
  const eurCells: string[] = [];
  for (let r = 5; r <= aoa.length; r++) eurCells.push(`C${r}`);
  applyEurFormat(ws, eurCells);

  // Bold rows where amount > 0
  for (const r of boldRows) {
    for (const col of ['A', 'B', 'C']) {
      const c = ws[`${col}${r}`] as { s?: Record<string, unknown> } | undefined;
      if (c) c.s = { ...(c.s || {}), font: { name: 'Calibri', sz: 10, bold: true } };
    }
  }

  // Cell comments for formula boxes
  for (const { addr, note } of noteCells) {
    const c = ws[addr] as { c?: Array<{ a: string; t: string }> } | undefined;
    if (c) c.c = [{ a: 'SellQo', t: note }];
  }

  return ws;
}

function buildTab2Audit(payload: Record<string, unknown>): XLSX.WorkSheet {
  const trail = (payload.audit_trail as Array<Record<string, unknown>>) ?? [];
  const rows: (string | number)[][] = [
    ['Vak', 'Factuur Nr', 'Datum', 'Klant', 'BTW-regime', 'Basis (EUR)', 'BTW (EUR)'],
  ];
  for (const e of trail) {
    rows.push([
      String(e.declaration_box ?? ''),
      String(e.invoice_number ?? ''),
      String(e.issue_date ?? ''),
      String(e.customer ?? ''),
      String(e.vat_regime ?? ''),
      Number(e.base_amount ?? 0),
      Number(e.vat_amount ?? 0),
    ]);
  }
  if (rows.length === 1) rows.push(['—', '', '', 'Geen audit-trail entries (include_audit_trail=false)', '', 0, 0]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [6, 18, 12, 30, 25, 14, 14]);
  styleHeader(ws, ['A1','B1','C1','D1','E1','F1','G1']);
  const last = rows.length;
  autoFilter(ws, `A1:G${last}`);
  freezeTopRow(ws);
  const eur: string[] = [];
  for (let r = 2; r <= last; r++) { eur.push(`F${r}`, `G${r}`); }
  applyEurFormat(ws, eur);
  return ws;
}

function buildTab3ByRate(payload: Record<string, unknown>): XLSX.WorkSheet {
  const list = (payload.by_rate as Array<Record<string, unknown>>) ?? [];
  const rows: (string | number)[][] = [
    ['Tarief (%)', 'Regime', 'Basis (EUR)', 'BTW (EUR)', 'Aantal Facturen'],
  ];
  let tBase = 0, tVat = 0, tCount = 0;
  for (const e of list) {
    const base = Number(e.base_amount ?? 0);
    const vat = Number(e.vat_amount ?? 0);
    const cnt = Number(e.invoice_count ?? 0);
    rows.push([Number(e.rate ?? 0), String(e.regime ?? ''), base, vat, cnt]);
    tBase += base; tVat += vat; tCount += cnt;
  }
  rows.push(['Totaal', '', tBase, tVat, tCount]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [10, 24, 16, 16, 16]);
  styleHeader(ws, ['A1','B1','C1','D1','E1']);
  const last = rows.length;
  const eur: string[] = [];
  for (let r = 2; r <= last; r++) { eur.push(`C${r}`, `D${r}`); }
  applyEurFormat(ws, eur);
  // Bold total row
  for (const col of ['A','B','C','D','E']) {
    const c = ws[`${col}${last}`] as { s?: Record<string, unknown> } | undefined;
    if (c) c.s = { ...(c.s || {}), font: { name: 'Calibri', sz: 10, bold: true } };
  }
  return ws;
}

function buildTab4ByCountry(payload: Record<string, unknown>): XLSX.WorkSheet {
  const list = (payload.by_country as Array<Record<string, unknown>>) ?? [];
  const rows: (string | number)[][] = [
    ['Land (ISO)', 'Land', 'Regime', 'Basis (EUR)', 'BTW (EUR)', 'Aantal Facturen'],
  ];
  for (const e of [...list].sort((a, b) => String(a.country_code).localeCompare(String(b.country_code)))) {
    const cc = String(e.country_code ?? '');
    rows.push([
      cc,
      COUNTRY_NAMES[cc] ?? cc,
      String(e.regime ?? ''),
      Number(e.base_amount ?? 0),
      Number(e.vat_amount ?? 0),
      Number(e.invoice_count ?? 0),
    ]);
  }
  if (rows.length === 1) rows.push(['—','','Geen data', 0, 0, 0]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [10, 22, 24, 16, 16, 16]);
  styleHeader(ws, ['A1','B1','C1','D1','E1','F1']);
  const last = rows.length;
  const eur: string[] = [];
  for (let r = 2; r <= last; r++) { eur.push(`D${r}`, `E${r}`); }
  applyEurFormat(ws, eur);
  freezeTopRow(ws);
  return ws;
}

function buildTab5IcListing(payload: Record<string, unknown>): XLSX.WorkSheet {
  const list = (payload.ic_listing as Array<Record<string, unknown>>) ?? [];
  const rows: (string | number)[][] = [
    ['BTW-nummer', 'Land', 'Bedrijfsnaam', 'Bedrag (EUR)', 'Type', 'Aantal Facturen'],
  ];
  let tot = 0;
  for (const e of list) {
    const amt = Number(e.amount ?? 0);
    tot += amt;
    rows.push([
      String(e.vat_number ?? ''),
      String(e.country_code ?? ''),
      String(e.company_name ?? ''),
      amt,
      String(e.type_code ?? ''),
      Array.isArray(e.invoice_ids) ? (e.invoice_ids as unknown[]).length : 0,
    ]);
  }
  if (list.length === 0) {
    rows.push(['—','','Geen IC-leveringen in deze periode', 0, '', 0]);
  } else {
    rows.push(['Totaal', '', '', tot, '', '']);
  }
  rows.push([]);
  rows.push(['Note: Deze data wordt geëxporteerd als XML voor INTERVAT-upload — zie BTW-aangifte.xml in dezelfde bundel.']);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [18, 8, 32, 16, 8, 16]);
  styleHeader(ws, ['A1','B1','C1','D1','E1','F1']);
  const eur: string[] = [];
  for (let r = 2; r <= rows.length - 2; r++) eur.push(`D${r}`);
  applyEurFormat(ws, eur);
  return ws;
}

function buildTab6Oss(payload: Record<string, unknown>): XLSX.WorkSheet {
  const list = (payload.oss_by_country as Array<Record<string, unknown>>) ?? [];
  if (list.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['Geen OSS-verkopen in deze periode']]);
    setColWidths(ws, [50]);
    return ws;
  }
  const rows: (string | number)[][] = [
    ['Land (ISO)', 'Land', 'Basis (EUR)', 'BTW-tarief (%)', 'BTW (EUR)', 'Aantal Facturen'],
  ];
  let tBase = 0, tVat = 0;
  for (const e of list) {
    const cc = String(e.country_code ?? '');
    const base = Number(e.base_amount ?? 0);
    const vat = Number(e.vat_amount ?? 0);
    tBase += base; tVat += vat;
    rows.push([cc, COUNTRY_NAMES[cc] ?? cc, base, Number(e.vat_rate ?? 0), vat, Number(e.invoice_count ?? 0)]);
  }
  rows.push(['Totaal', '', tBase, '', tVat, '']);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [10, 22, 16, 14, 16, 16]);
  styleHeader(ws, ['A1','B1','C1','D1','E1','F1']);
  const eur: string[] = [];
  for (let r = 2; r <= rows.length; r++) { eur.push(`C${r}`, `E${r}`); }
  applyEurFormat(ws, eur);
  return ws;
}

function buildTab7CreditNotes(payload: Record<string, unknown>): XLSX.WorkSheet {
  // Engine doesn't yet expose CN-detail array; derive from audit_trail filtered by is_credit_note.
  const trail = ((payload.audit_trail as Array<Record<string, unknown>>) ?? [])
    .filter((e) => Boolean(e.is_credit_note));
  if (trail.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['Geen creditnota\'s in deze periode']]);
    setColWidths(ws, [50]);
    return ws;
  }
  const rows: (string | number)[][] = [
    ['Creditnota Nr', 'Datum', 'Klant', 'Origineel Vak', 'Compenserend Vak', 'Basis (EUR)', 'BTW (EUR)'],
  ];
  for (const e of trail) {
    rows.push([
      String(e.invoice_number ?? ''),
      String(e.issue_date ?? ''),
      String(e.customer ?? ''),
      '',
      String(e.declaration_box ?? ''),
      Number(e.base_amount ?? 0),
      Number(e.vat_amount ?? 0),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [18, 12, 30, 14, 18, 16, 16]);
  styleHeader(ws, ['A1','B1','C1','D1','E1','F1','G1']);
  const eur: string[] = [];
  for (let r = 2; r <= rows.length; r++) { eur.push(`F${r}`, `G${r}`); }
  applyEurFormat(ws, eur);
  return ws;
}

function buildTab8Stripe(payload: Record<string, unknown>): XLSX.WorkSheet {
  const sr = payload.stripe_reconciliation as Record<string, unknown> | null;
  if (!sr || sr.status === 'not_implemented' || sr.status === 'not_connected') {
    const msg = sr?.status === 'not_implemented'
      ? 'Stripe-reconciliatie nog niet beschikbaar (engine status: not_implemented)'
      : 'Stripe niet verbonden voor deze tenant';
    const ws = XLSX.utils.aoa_to_sheet([[msg]]);
    setColWidths(ws, [60]);
    return ws;
  }
  const discrepancy = Number(sr.discrepancy ?? 0);
  const rows: (string | number)[][] = [
    ['Categorie', 'Bedrag (EUR)'],
    ['Brutobedrag gefactureerd', Number(sr.expected_payouts_based_on_invoices ?? 0)],
    ['Stripe payouts ontvangen', Number(sr.period_payouts_eur ?? 0)],
    ['Stripe fees', Number(sr.stripe_fees ?? 0)],
    ['Refunds via Stripe', Number(sr.refunds ?? 0)],
    ['FX-verschillen', Number(sr.fx_differences ?? 0)],
    ['Discrepantie', discrepancy],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [34, 18]);
  styleHeader(ws, ['A1', 'B1']);
  applyEurFormat(ws, ['B2','B3','B4','B5','B6','B7']);
  // Discrepantie styling
  const cell = ws['B7'] as { s?: Record<string, unknown> } | undefined;
  const acell = ws['A7'] as { s?: Record<string, unknown> } | undefined;
  const isBad = Math.abs(discrepancy) > 0.01;
  const style = {
    font: { name: 'Calibri', sz: 10, bold: true, color: isBad ? { rgb: 'B91C1C' } : undefined },
    alignment: { horizontal: 'right' },
  };
  if (cell) cell.s = { ...(cell.s || {}), ...style, z: '#,##0.00' };
  if (acell) acell.s = { ...(acell.s || {}), font: { name: 'Calibri', sz: 10, bold: true } };
  return ws;
}

function buildTab9Validation(
  payload: Record<string, unknown>,
  roundTrip: { pass: boolean; delta: number; computed: number; reported: number },
): XLSX.WorkSheet {
  const meta = payload.metadata as Record<string, unknown>;
  const warnings = (payload.warnings as string[]) ?? [];
  const rows: (string | number)[][] = [
    ['Validatie & Waarschuwingen'],
    [],
    ['Round-trip check (vak 63 = 54+55+56+57-59+61-62-64)', roundTrip.pass ? 'PASS' : 'FAIL'],
    ['  Berekend', roundTrip.computed],
    ['  Vak 63 in rapport', roundTrip.reported],
    ['  Delta', roundTrip.delta],
    [],
    ['Aantal facturen verwerkt', Number(meta.invoice_count ?? 0)],
    ['Aantal creditnota\'s verwerkt', Number(meta.credit_note_count ?? 0)],
    ['Engine duur (ms)', Number(meta.duration_ms ?? 0)],
    ['From cache', String(meta.from_cache ?? false)],
    [],
    ['Waarschuwingen:'],
  ];
  if (warnings.length === 0) rows.push(['  (geen)']);
  else for (const w of warnings) rows.push([`  • ${w}`]);
  const dqi = (payload.data_quality_issues as Array<Record<string, unknown>>) ?? [];
  if (dqi.length > 0) {
    rows.push([]);
    rows.push(['Data-quality issues:']);
    rows.push(['  Factuur', 'Line VAT', 'Header VAT', 'Delta']);
    for (const d of dqi) {
      rows.push([
        `  ${String(d.invoice_number ?? '')}`,
        Number(d.line_vat ?? 0),
        Number(d.header_vat ?? 0),
        Number(d.delta ?? 0),
      ]);
    }
  }
  rows.push([]);
  rows.push([`Dit rapport is gegenereerd door SellQo op ${new Date().toISOString()}. Cross-check met uw boekhouder verplicht.`]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [50, 16, 16, 16]);
  return ws;
}

function computeRoundTrip(payload: Record<string, unknown>) {
  const boxes = payload.declaration_boxes as Record<string, { amount: number; vat: number }> | undefined;
  const v = (code: string) => Number(boxes?.[code]?.vat ?? 0);
  const amt = (code: string) => Number(boxes?.[code]?.amount ?? 0);
  const computed = v('54') + v('55') + v('56') + v('57') - v('59') + v('61') - v('62') - v('64');
  const reported = amt('63');
  const delta = Math.round((reported - computed) * 100) / 100;
  return { pass: Math.abs(delta) < 0.02, delta, computed: Math.round(computed * 100) / 100, reported: Math.round(reported * 100) / 100 };
}

function badRequest(msg: string, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  let raw: unknown;
  try { raw = await req.json(); } catch { return badRequest('Invalid JSON body', cors); }
  const b = (raw ?? {}) as Record<string, unknown>;
  if (typeof b.tenant_id !== 'string') return badRequest('tenant_id required', cors);
  if (typeof b.period_start !== 'string' || !ISO_DATE.test(b.period_start)) return badRequest('period_start invalid', cors);
  if (typeof b.period_end !== 'string' || !ISO_DATE.test(b.period_end)) return badRequest('period_end invalid', cors);
  const pt = String(b.period_type ?? 'custom') as PeriodType;
  if (!['monthly','quarterly','annual','custom'].includes(pt)) return badRequest('period_type invalid', cors);
  const body: ReqBody = { tenant_id: b.tenant_id, period_start: b.period_start, period_end: b.period_end, period_type: pt };

  try {
    await authenticateRequest(req, body.tenant_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Call engine with audit trail enabled
    const engResp = await fetch(`${supabaseUrl}/functions/v1/vat-report-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        tenant_id: body.tenant_id,
        period_start: body.period_start,
        period_end: body.period_end,
        period_type: body.period_type,
        include_audit_trail: true,
        force_recompute: true,
      }),
    });
    if (!engResp.ok) {
      const txt = await engResp.text();
      throw new Error(`engine call failed: ${engResp.status} ${txt}`);
    }
    const engine = await engResp.json();
    if (!engine?.success) throw new Error(`engine error: ${engine?.error ?? 'unknown'}`);
    const payload = engine.payload as Record<string, unknown>;

    // Build workbook
    const wb = XLSX.utils.book_new();
    const tabs: [string, XLSX.WorkSheet][] = [
      ['Aangifte-formulier', buildTab1Declaration(payload)],
      ['Audit per vak', buildTab2Audit(payload)],
      ['BTW per tarief', buildTab3ByRate(payload)],
      ['Verkopen per land', buildTab4ByCountry(payload)],
      ['IC-Listing', buildTab5IcListing(payload)],
      ['OSS-detail', buildTab6Oss(payload)],
      ['Creditnota\'s', buildTab7CreditNotes(payload)],
      ['Stripe Reconciliatie', buildTab8Stripe(payload)],
      ['Validatie & Waarschuwingen', buildTab9Validation(payload, computeRoundTrip(payload))],
    ];
    for (const [name, ws] of tabs) {
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    }

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const meta = payload.metadata as Record<string, unknown>;
    const tenant = meta.tenant as Record<string, unknown>;
    const filename = `SellQo_BTW-aangifte_${slugify(String(tenant.name ?? 'tenant'))}_${periodCode(body.period_start, body.period_end, body.period_type)}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error('[export-vat-xlsx] error', e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});