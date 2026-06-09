// export-vat-pdf — generates a multi-page PDF VAT declaration report.
// Admin-only (JWT). Returns PDF as binary download.
//
// NOTE on library choice: @react-pdf/renderer bundles React + reconciler and
// does not reliably boot in Deno edge functions (npm: resolution loops, cold
// start failures). pdf-lib is the Deno-native standard for server PDF gen:
// compact, fully embedded (no external network requests), and produces files
// that open cleanly in Adobe, Preview, Chrome and Firefox.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "https://esm.sh/pdf-lib@1.17.1";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError, requireRole } from "../_shared/auth.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
type PeriodType = 'monthly' | 'quarterly' | 'annual' | 'custom';
interface ReqBody {
  tenant_id: string;
  period_start: string;
  period_end: string;
  period_type: PeriodType;
}

// ===== Layout constants (A4 portrait, points) =====
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_TOP = 56.7;    // 2cm
const MARGIN_BOT = 56.7;
const MARGIN_LEFT = 42.5;   // 1.5cm
const MARGIN_RIGHT = 42.5;
const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;
const HEADER_Y = PAGE_H - 28;
const FOOTER_Y = 28;
const TEXT_GRAY = rgb(0.35, 0.35, 0.38);
const HEAD_GRAY = rgb(0.93, 0.94, 0.96);
const ALT_GRAY  = rgb(0.97, 0.97, 0.98);
const ACCENT    = rgb(0.13, 0.18, 0.35);
const BLACK     = rgb(0.1, 0.1, 0.12);
const HILITE    = rgb(1.0, 0.97, 0.85);

// ===== Belgian VAT box labels (subset) =====
const BOX_LABELS: Record<string, string> = {
  '00': 'Verkopen aan 0% (BE)',
  '01': 'Verkopen aan 6%',
  '02': 'Verkopen aan 12%',
  '03': 'Verkopen aan 21%',
  '44': 'IC-diensten aan EU BTW-plichtigen',
  '45': 'Verlegging / medecontractant',
  '46': 'IC-leveringen / driehoek',
  '47': 'Uitvoer / overige vrijgesteld',
  '48': 'Negatieve correcties IC',
  '49': 'Negatieve correcties overige omzet',
  '54': 'Verschuldigde BTW op 01/02/03',
  '55': 'Verschuldigde BTW op IC-aankopen',
  '56': 'Verschuldigde BTW medecontractant',
  '57': 'Verschuldigde BTW op invoer',
  '59': 'Aftrekbare BTW op aankopen',
  '61': 'BTW-regularisaties t.v.v. Staat',
  '62': 'BTW-regularisaties t.v.v. aangever',
  '63': 'Terug te storten BTW',
  '64': 'Te recupereren BTW op CN',
  '71': 'Aan de Staat verschuldigd saldo',
  '72': 'Door de Staat terug te storten saldo',
  '81': 'Inkopen handelsgoederen',
  '82': 'Inkopen diensten / diverse',
  '83': 'Inkopen bedrijfsmiddelen',
  '84': 'CN ontvangen op 81/82/83',
  '85': 'CN ontvangen op IC-aankopen',
  '86': 'IC-aankopen van goederen',
  '87': 'Andere inkomende handelingen',
  '88': 'IC-aankopen van diensten',
};
const SALES_BOXES = ['00','01','02','03','44','45','46','47','48','49'];
const VAT_DUE_BOXES = ['54','55','56','57','59','61','62','63','64','71','72'];
const PURCHASE_BOXES = ['81','82','83','84','85','86','87','88'];
const HIGHLIGHTED = new Set(['71', '72']);

// Regime → standard VAT rate (BE) and box-based fallback. Used by pageByRate
// to aggregate header-driven from audit_trail (consistent with XLSX Tab 3).
const REGIME_STANDARD_RATE: Record<string, number> = {
  domestic_standard: 21,
  domestic_reduced_12: 12,
  domestic_reduced_6: 6,
  domestic_reduced: 6,
  domestic_zero: 0,
  domestic_exempt: 0,
  ic_supply_b2b: 0,
  ic_services_b2b: 0,
  ic_triangulation: 0,
  export_non_eu: 0,
  reverse_charge_b2b: 0,
  oss_b2c_eu: 0,
};
const BOX_STANDARD_RATE: Record<string, number> = {
  '00': 0, '01': 6, '02': 12, '03': 21,
  '44': 0, '45': 0, '46': 0, '47': 0, '48': 0, '49': 0,
};
const COUNTRY_NAMES: Record<string, string> = {
  BE: 'Belgie', NL: 'Nederland', DE: 'Duitsland', FR: 'Frankrijk',
  LU: 'Luxemburg', IT: 'Italie', ES: 'Spanje', PT: 'Portugal',
  AT: 'Oostenrijk', IE: 'Ierland', DK: 'Denemarken', SE: 'Zweden',
  FI: 'Finland', PL: 'Polen', CZ: 'Tsjechie', SK: 'Slowakije',
  HU: 'Hongarije', RO: 'Roemenie', BG: 'Bulgarije', GR: 'Griekenland',
  HR: 'Kroatie', SI: 'Slovenie', EE: 'Estland', LV: 'Letland',
  LT: 'Litouwen', CY: 'Cyprus', MT: 'Malta', GB: 'Verenigd Koninkrijk',
  US: 'Verenigde Staten', CH: 'Zwitserland', NO: 'Noorwegen',
};

const MONTH_NL = [
  'januari','februari','maart','april','mei','juni',
  'juli','augustus','september','oktober','november','december',
];

function slugify(s: string): string {
  return (s || 'tenant').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tenant';
}
function formatDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
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
function periodLabel(start: string, end: string, type: PeriodType): string {
  const y = start.slice(0, 4);
  if (type === 'annual') return y;
  if (type === 'monthly') {
    const m = parseInt(start.slice(5, 7), 10);
    const name = MONTH_NL[m - 1] ?? '';
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
  }
  if (type === 'quarterly') {
    const m = parseInt(start.slice(5, 7), 10);
    return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
  }
  return `${formatDdMmYyyy(start)} t/m ${formatDdMmYyyy(end)}`;
}
function fmtEur(n: number): string {
  // EPSILON-safe rounding so PDF & XLSX present identical 2dp values
  // for the same raw float (e.g. 178.185 → 178.19 in both).
  const v = Math.round(((n || 0) + Number.EPSILON) * 100) / 100;
  return v.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';
}

// WinAnsi-safe sanitiser (Helvetica only supports WinAnsi glyphs).
function safe(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    // strip anything outside WinAnsi printable range
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '?');
}

// ===== PDF writer with header/footer + auto pagination =====
class Doc {
  pdf!: PDFDocument;
  reg!: PDFFont;
  bold!: PDFFont;
  ital!: PDFFont;
  pages: PDFPage[] = [];
  current!: PDFPage;
  y = 0;
  tenantLabel = '';
  generatedAt = '';

  async init(tenantLabel: string, generatedAt: string) {
    this.pdf = await PDFDocument.create();
    this.reg = await this.pdf.embedFont(StandardFonts.Helvetica);
    this.bold = await this.pdf.embedFont(StandardFonts.HelveticaBold);
    this.ital = await this.pdf.embedFont(StandardFonts.HelveticaOblique);
    this.tenantLabel = safe(tenantLabel);
    this.generatedAt = generatedAt;
  }

  newPage() {
    const p = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.pages.push(p);
    this.current = p;
    // header tenant name
    p.drawText(this.tenantLabel, {
      x: MARGIN_LEFT, y: HEADER_Y, size: 8, font: this.reg, color: TEXT_GRAY,
    });
    // footer timestamp
    const footer = `Gegenereerd door SellQo op ${this.generatedAt}`;
    p.drawText(footer, {
      x: MARGIN_LEFT, y: FOOTER_Y, size: 7.5, font: this.reg, color: TEXT_GRAY,
    });
    // thin top rule
    p.drawLine({
      start: { x: MARGIN_LEFT, y: HEADER_Y - 6 },
      end: { x: PAGE_W - MARGIN_RIGHT, y: HEADER_Y - 6 },
      thickness: 0.4, color: TEXT_GRAY,
    });
    this.y = HEADER_Y - 22;
    return p;
  }

  ensure(h: number) {
    if (this.y - h < MARGIN_BOT + 14) this.newPage();
  }

  text(s: string, opts: { size?: number; bold?: boolean; ital?: boolean; color?: ReturnType<typeof rgb>; x?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : opts.ital ? this.ital : this.reg;
    const lineH = size * 1.25;
    this.ensure(lineH);
    this.current.drawText(safe(s), {
      x: opts.x ?? MARGIN_LEFT,
      y: this.y - size,
      size, font,
      color: opts.color ?? BLACK,
    });
    this.y -= lineH + (opts.gap ?? 0);
  }

  spacer(h: number) { this.y -= h; }

  heading(s: string, size = 18) {
    this.ensure(size * 1.6);
    this.current.drawText(safe(s), {
      x: MARGIN_LEFT, y: this.y - size, size, font: this.bold, color: ACCENT,
    });
    this.y -= size * 1.4;
    // underline
    this.current.drawLine({
      start: { x: MARGIN_LEFT, y: this.y + 2 },
      end: { x: MARGIN_LEFT + 60, y: this.y + 2 },
      thickness: 2, color: ACCENT,
    });
    this.spacer(10);
  }

  subheading(s: string) {
    this.spacer(4);
    this.text(s, { size: 12, bold: true, color: ACCENT, gap: 4 });
  }

  // Draw a table. cols = widths in pt summing <= CONTENT_W.
  // align per column: 'l' | 'r'. header row + body rows of strings.
  table(opts: {
    cols: number[];
    align: ('l' | 'r')[];
    headers: string[];
    rows: string[][];
    highlightRow?: (i: number) => boolean;
  }) {
    const { cols, align, headers, rows } = opts;
    const rowH = 16;
    const headH = 18;
    const drawRow = (cells: string[], yTop: number, font: PDFFont, bg?: ReturnType<typeof rgb>) => {
      if (bg) {
        this.current.drawRectangle({
          x: MARGIN_LEFT, y: yTop - rowH + 2, width: cols.reduce((a, b) => a + b, 0),
          height: rowH, color: bg,
        });
      }
      let cx = MARGIN_LEFT;
      for (let i = 0; i < cells.length; i++) {
        const w = cols[i];
        const txt = safe(cells[i]);
        const tw = font.widthOfTextAtSize(txt, 9);
        const tx = align[i] === 'r' ? cx + w - tw - 4 : cx + 4;
        this.current.drawText(txt, { x: tx, y: yTop - 11, size: 9, font, color: BLACK });
        cx += w;
      }
    };

    // Header
    this.ensure(headH + rowH);
    this.current.drawRectangle({
      x: MARGIN_LEFT, y: this.y - headH + 2, width: cols.reduce((a, b) => a + b, 0),
      height: headH, color: HEAD_GRAY,
    });
    let cx = MARGIN_LEFT;
    for (let i = 0; i < headers.length; i++) {
      const w = cols[i];
      const txt = safe(headers[i]);
      const tw = this.bold.widthOfTextAtSize(txt, 9);
      const tx = align[i] === 'r' ? cx + w - tw - 4 : cx + 4;
      this.current.drawText(txt, { x: tx, y: this.y - 12, size: 9, font: this.bold, color: ACCENT });
      cx += w;
    }
    this.y -= headH;

    for (let i = 0; i < rows.length; i++) {
      this.ensure(rowH);
      const highlight = opts.highlightRow?.(i);
      const bg = highlight ? HILITE : i % 2 === 1 ? ALT_GRAY : undefined;
      drawRow(rows[i], this.y, highlight ? this.bold : this.reg, bg);
      this.y -= rowH;
    }
  }

  // After all content rendered, write "Pagina X van Y" to top-right of each page.
  paginate() {
    const total = this.pages.length;
    for (let i = 0; i < total; i++) {
      const p = this.pages[i];
      const label = `Pagina ${i + 1} van ${total}`;
      const w = this.reg.widthOfTextAtSize(label, 8);
      p.drawText(label, {
        x: PAGE_W - MARGIN_RIGHT - w, y: HEADER_Y, size: 8, font: this.reg, color: TEXT_GRAY,
      });
    }
  }
}

// ===== Logo embed =====
async function tryEmbedLogo(doc: Doc, url: string | null | undefined) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 600_000) return null; // keep under file size budget
    if (ct.includes('png') || url.toLowerCase().endsWith('.png')) {
      return await doc.pdf.embedPng(buf);
    }
    if (ct.includes('jpeg') || ct.includes('jpg') || /\.(jpe?g)$/i.test(url)) {
      return await doc.pdf.embedJpg(buf);
    }
  } catch (_e) {
    return null;
  }
  return null;
}

// ===== Page builders =====

async function pageCover(doc: Doc, payload: any, periodType: PeriodType, tenantLogoUrl: string | null) {
  doc.newPage();
  const tenant = payload.metadata?.tenant ?? {};
  const period = payload.metadata?.period ?? {};
  const logoImg = await tryEmbedLogo(doc, tenantLogoUrl);

  // Logo top-center
  let cursorY = PAGE_H - MARGIN_TOP - 40;
  if (logoImg) {
    const maxW = 180, maxH = 80;
    const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height);
    const w = logoImg.width * scale;
    const h = logoImg.height * scale;
    doc.current.drawImage(logoImg, {
      x: (PAGE_W - w) / 2, y: cursorY - h, width: w, height: h,
    });
    cursorY -= h + 24;
  } else {
    // SellQo fallback wordmark
    const wm = 'SellQo';
    const ws = doc.bold.widthOfTextAtSize(wm, 24);
    doc.current.drawText(wm, { x: (PAGE_W - ws) / 2, y: cursorY - 24, size: 24, font: doc.bold, color: ACCENT });
    cursorY -= 48;
  }

  // Title
  const title = 'BTW-aangifte';
  const tw = doc.bold.widthOfTextAtSize(title, 36);
  doc.current.drawText(title, { x: (PAGE_W - tw) / 2, y: cursorY - 36, size: 36, font: doc.bold, color: BLACK });
  cursorY -= 60;

  // Subtitle: period label
  const sub = periodLabel(String(period.start ?? ''), String(period.end ?? ''), periodType);
  const sw = doc.reg.widthOfTextAtSize(sub, 16);
  doc.current.drawText(sub, { x: (PAGE_W - sw) / 2, y: cursorY - 16, size: 16, font: doc.reg, color: TEXT_GRAY });
  cursorY -= 60;

  // Tenant block
  const lines = [
    safe(tenant.name ?? '—'),
    `BTW-nummer: ${safe(tenant.vat_number ?? '—')}`,
    `KBO/KvK: ${safe(tenant.kbo ?? '—')}`,
    `Periode: ${formatDdMmYyyy(String(period.start ?? ''))} t/m ${formatDdMmYyyy(String(period.end ?? ''))}`,
  ];
  for (const ln of lines) {
    const w = doc.reg.widthOfTextAtSize(ln, 11);
    doc.current.drawText(safe(ln), { x: (PAGE_W - w) / 2, y: cursorY - 12, size: 11, font: doc.reg, color: BLACK });
    cursorY -= 18;
  }

  // Generation date small grey at bottom of cover
  const gen = `Gegenereerd op ${payload.metadata?.generated_at ?? ''}`;
  const gw = doc.reg.widthOfTextAtSize(gen, 8);
  doc.current.drawText(gen, { x: (PAGE_W - gw) / 2, y: MARGIN_BOT + 14, size: 8, font: doc.ital, color: TEXT_GRAY });
}

function pageSummary(doc: Doc, payload: any) {
  doc.newPage();
  doc.heading('Samenvatting BTW-vakken');

  const boxes = (payload.declaration_boxes ?? {}) as Record<string, { amount: number; vat: number }>;
  const rows: string[][] = [];
  const highlights: number[] = [];
  let idx = 0;
  const push = (code: string) => {
    const b = boxes[code] ?? { amount: 0, vat: 0 };
    const val = VAT_DUE_BOXES.includes(code) ? b.vat : b.amount;
    rows.push([code, BOX_LABELS[code] ?? '', fmtEur(val)]);
    if (HIGHLIGHTED.has(code)) highlights.push(idx);
    idx++;
  };
  for (const c of SALES_BOXES) push(c);
  for (const c of VAT_DUE_BOXES) push(c);
  for (const c of PURCHASE_BOXES) push(c);

  doc.table({
    cols: [40, CONTENT_W - 40 - 110, 110],
    align: ['l', 'l', 'r'],
    headers: ['Vak', 'Omschrijving', 'Bedrag'],
    rows,
    highlightRow: (i) => highlights.includes(i),
  });

  doc.spacer(12);
  doc.text('Cross-check via uw boekhouder verplicht.', { size: 9, ital: true, color: TEXT_GRAY });
}

function pageByRate(doc: Doc, payload: any) {
  doc.newPage();
  doc.heading('BTW per tarief');
  // Header-driven aggregation from audit_trail (matches XLSX Tab 3 and
  // Tab 1 declaration_boxes). Engine's payload.by_rate is line-driven and
  // can drift from header totals when Shopify imports have line/header VAT
  // mismatches — never use it for declaration totals.
  const trail = (payload.audit_trail ?? []) as Array<Record<string, unknown>>;
  const salesEntries = trail.filter((e) =>
    SALES_BOXES.includes(String((e as any).declaration_box ?? '')),
  );
  type Bucket = { rate: number; regime: string; base: number; vat: number; invs: Set<string> };
  const buckets = new Map<string, Bucket>();
  for (const e of salesEntries) {
    const base = Number((e as any).base_amount ?? 0);
    const vat = Number((e as any).vat_amount ?? 0);
    const regime = String((e as any).vat_regime ?? '');
    const box = String((e as any).declaration_box ?? '');
    const rate = REGIME_STANDARD_RATE[regime] ?? BOX_STANDARD_RATE[box] ?? 0;
    const key = `${rate}|${regime}`;
    let b = buckets.get(key);
    if (!b) { b = { rate, regime, base: 0, vat: 0, invs: new Set() }; buckets.set(key, b); }
    b.base += base; b.vat += vat;
    const inv = String((e as any).invoice_number ?? '');
    if (inv) b.invs.add(inv);
  }
  if (buckets.size === 0) {
    doc.text('Geen BTW-omzet in deze periode.', { ital: true, color: TEXT_GRAY });
    return;
  }
  const sorted = [...buckets.values()].sort((a, b) =>
    a.rate !== b.rate ? b.rate - a.rate : a.regime.localeCompare(b.regime),
  );
  const rows: string[][] = [];
  let tBase = 0, tVat = 0;
  const allInvs = new Set<string>();
  for (const b of sorted) {
    rows.push([`${b.rate}%`, b.regime, fmtEur(b.base), fmtEur(b.vat), String(b.invs.size)]);
    tBase += b.base; tVat += b.vat;
    for (const i of b.invs) allInvs.add(i);
  }
  rows.push(['Totaal', '', fmtEur(tBase), fmtEur(tVat), String(allInvs.size)]);

  doc.table({
    cols: [70, 150, 110, 110, CONTENT_W - 70 - 150 - 110 - 110],
    align: ['l', 'l', 'r', 'r', 'r'],
    headers: ['Tarief', 'Regime', 'Basis', 'BTW', '# Facturen'],
    rows,
    highlightRow: (i) => i === rows.length - 1,
  });
}

function pageByCountry(doc: Doc, payload: any): boolean {
  const list = (payload.by_country ?? []) as Array<Record<string, unknown>>;
  if (!list.length) return false;
  doc.newPage();
  doc.heading('Verkopen per land');
  const sorted = [...list].sort((a, b) =>
    String(a.country_code ?? '').localeCompare(String(b.country_code ?? '')),
  );
  const rows: string[][] = [];
  let tBase = 0, tVat = 0, tInv = 0;
  for (const e of sorted) {
    const cc = String(e.country_code ?? '');
    const base = Number(e.base_amount ?? 0);
    const vat = Number(e.vat_amount ?? 0);
    const inv = Number(e.invoice_count ?? 0);
    rows.push([
      cc,
      COUNTRY_NAMES[cc] ?? cc,
      String(e.regime ?? ''),
      fmtEur(base),
      fmtEur(vat),
      String(inv),
    ]);
    tBase += base; tVat += vat; tInv += inv;
  }
  rows.push(['', 'Totaal', '', fmtEur(tBase), fmtEur(tVat), String(tInv)]);
  doc.table({
    cols: [50, 130, 120, 100, 100, CONTENT_W - 50 - 130 - 120 - 100 - 100],
    align: ['l', 'l', 'l', 'r', 'r', 'r'],
    headers: ['ISO', 'Land', 'Regime', 'Basis', 'BTW', '# Facturen'],
    rows,
    highlightRow: (i) => i === rows.length - 1,
  });
  return true;
}

function pageIcListing(doc: Doc, payload: any): boolean {
  const arr = (payload.ic_listing ?? []) as Array<{ vat_number: string; country_code: string; company_name: string; amount: number; type_code: string }>;
  if (!arr.length) return false;
  doc.newPage();
  doc.heading('IC-Listing');
  const rows = arr.map((e) => [
    e.vat_number ?? '', e.country_code ?? '', e.company_name ?? '', e.type_code ?? 'L', fmtEur(e.amount),
  ]);
  const total = arr.reduce((a, b) => a + Number(b.amount || 0), 0);
  rows.push(['', '', 'Totaal', '', fmtEur(total)]);
  doc.table({
    cols: [110, 50, CONTENT_W - 110 - 50 - 50 - 110, 50, 110],
    align: ['l', 'l', 'l', 'l', 'r'],
    headers: ['BTW-nummer', 'Land', 'Klant', 'Type', 'Bedrag'],
    rows,
    highlightRow: (i) => i === rows.length - 1,
  });
  return true;
}

function pageOss(doc: Doc, payload: any): boolean {
  const arr = (payload.oss_by_country ?? []) as Array<{ country_code: string; base_amount: number; vat_rate: number; vat_amount: number; invoice_count: number }>;
  if (!arr.length) return false;
  doc.newPage();
  doc.heading('OSS-detail per land');
  const rows = arr.map((e) => [
    e.country_code ?? '', `${e.vat_rate ?? 0}%`, fmtEur(e.base_amount), fmtEur(e.vat_amount), String(e.invoice_count ?? 0),
  ]);
  const tBase = arr.reduce((a, b) => a + Number(b.base_amount || 0), 0);
  const tVat = arr.reduce((a, b) => a + Number(b.vat_amount || 0), 0);
  const tInv = arr.reduce((a, b) => a + Number(b.invoice_count || 0), 0);
  rows.push(['Totaal', '', fmtEur(tBase), fmtEur(tVat), String(tInv)]);
  doc.table({
    cols: [60, 60, 140, 140, CONTENT_W - 400],
    align: ['l', 'r', 'r', 'r', 'r'],
    headers: ['Land', 'Tarief', 'Basis', 'BTW', '# Facturen'],
    rows,
    highlightRow: (i) => i === rows.length - 1,
  });
  return true;
}

function pageCreditNotes(doc: Doc, payload: any): boolean {
  // engine doesn't expose credit_notes array directly; derive from audit_trail
  const trail = (payload.audit_trail ?? []) as Array<{ invoice_number: string; issue_date: string; customer: string; base_amount: number; vat_amount: number; is_credit_note: boolean }>;
  const cn = trail.filter((e) => e.is_credit_note);
  if (!cn.length) return false;
  doc.newPage();
  doc.heading('Creditnota\'s');
  const rows = cn.map((e) => [
    e.invoice_number ?? '', String(e.issue_date ?? '').slice(0, 10), e.customer ?? '',
    fmtEur(e.base_amount), fmtEur(e.vat_amount),
  ]);
  const tB = cn.reduce((a, b) => a + Number(b.base_amount || 0), 0);
  const tV = cn.reduce((a, b) => a + Number(b.vat_amount || 0), 0);
  rows.push(['', '', 'Totaal', fmtEur(tB), fmtEur(tV)]);
  doc.table({
    cols: [90, 70, CONTENT_W - 90 - 70 - 110 - 110, 110, 110],
    align: ['l', 'l', 'l', 'r', 'r'],
    headers: ['Nummer', 'Datum', 'Klant', 'Basis', 'BTW'],
    rows,
    highlightRow: (i) => i === rows.length - 1,
  });
  return true;
}

function pageStripe(doc: Doc, payload: any): boolean {
  const s = payload.stripe_reconciliation;
  if (!s) return false;
  doc.newPage();
  doc.heading('Stripe reconciliatie');
  const rows: [string, string][] = [
    ['Stripe-uitbetalingen in periode', fmtEur(s.period_payouts_eur ?? 0)],
    ['Verwachte uitbetalingen o.b.v. facturen', fmtEur(s.expected_payouts_based_on_invoices ?? 0)],
    ['Stripe-fees', fmtEur(s.stripe_fees ?? 0)],
    ['Refunds', fmtEur(s.refunds ?? 0)],
    ['FX-verschillen', fmtEur(s.fx_differences ?? 0)],
    ['Discrepantie', fmtEur(s.discrepancy ?? 0)],
  ];
  doc.table({
    cols: [CONTENT_W - 160, 160],
    align: ['l', 'r'],
    headers: ['Post', 'Bedrag'],
    rows,
  });
  doc.spacer(8);
  doc.text(`Status: ${s.status ?? '—'}`, { size: 10, bold: true });
  return true;
}

function pageAudit(doc: Doc, payload: any) {
  doc.newPage();
  doc.heading('Audit-trail');
  const trail = (payload.audit_trail ?? []) as Array<any>;
  if (!trail.length) {
    doc.text('Geen audit-trail entries beschikbaar.', { ital: true, color: TEXT_GRAY });
    return;
  }
  const slice = trail.slice(0, 50);
  const rows = slice.map((e) => [
    String(e.declaration_box ?? ''),
    String(e.invoice_number ?? ''),
    String(e.issue_date ?? '').slice(0, 10),
    String(e.customer ?? '').slice(0, 36),
    fmtEur(Number(e.base_amount ?? 0)),
    fmtEur(Number(e.vat_amount ?? 0)),
  ]);
  doc.table({
    cols: [32, 80, 60, CONTENT_W - 32 - 80 - 60 - 100 - 90, 100, 90],
    align: ['l', 'l', 'l', 'l', 'r', 'r'],
    headers: ['Vak', 'Factuur', 'Datum', 'Klant', 'Basis', 'BTW'],
    rows,
  });
  if (trail.length > 50) {
    doc.spacer(8);
    doc.text(`Volledig audit-trail (${trail.length} regels) beschikbaar in XLSX-versie van dit rapport.`, {
      size: 9, ital: true, color: TEXT_GRAY,
    });
  }
}

function pageValidation(doc: Doc, payload: any) {
  doc.newPage();
  doc.heading('Validatie & waarschuwingen');

  // Round-trip check
  const boxes = (payload.declaration_boxes ?? {}) as Record<string, { amount: number; vat: number }>;
  const v = (c: string) => Number(boxes?.[c]?.vat ?? 0);
  const amt = (c: string) => Number(boxes?.[c]?.amount ?? 0);
  const computed = v('54') + v('55') + v('56') + v('57') - v('59') + v('61') - v('62') - v('64');
  const reported = amt('63');
  const delta = Math.round((reported - computed) * 100) / 100;
  const pass = Math.abs(delta) < 0.02;

  doc.subheading('Round-trip check (vak 63)');
  doc.text(`Berekend: ${fmtEur(computed)}`);
  doc.text(`Gerapporteerd: ${fmtEur(reported)}`);
  doc.text(`Verschil: ${fmtEur(delta)}`);
  doc.text(pass ? 'Resultaat: PASS' : 'Resultaat: FAIL', {
    bold: true, color: pass ? rgb(0.1, 0.5, 0.2) : rgb(0.75, 0.2, 0.1),
  });

  doc.spacer(8);
  doc.subheading('Statistieken');
  const meta = payload.metadata ?? {};
  doc.text(`Aantal facturen: ${meta.invoice_count ?? 0}`);
  doc.text(`Aantal creditnota's: ${meta.credit_note_count ?? 0}`);
  doc.text(`OSS-landen: ${(payload.oss_by_country ?? []).length}`);
  doc.text(`IC-listing entries: ${(payload.ic_listing ?? []).length}`);
  doc.text(`Client listing entries: ${(payload.client_listing ?? []).length}`);

  doc.spacer(8);
  doc.subheading('Waarschuwingen');
  const warnings = (payload.warnings ?? []) as string[];
  if (!warnings.length) {
    doc.text('Geen waarschuwingen.', { ital: true, color: TEXT_GRAY });
  } else {
    warnings.forEach((w, i) => {
      // wrap long warnings naively at ~110 chars
      const txt = `${i + 1}. ${w}`;
      const max = 110;
      for (let off = 0; off < txt.length; off += max) {
        doc.text(txt.slice(off, off + max), { size: 9 });
      }
    });
  }
}

// ===== HTTP handler =====
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
  const body: ReqBody = {
    tenant_id: b.tenant_id, period_start: b.period_start,
    period_end: b.period_end, period_type: pt,
  };

  try {
    const auth = await authenticateRequest(req, body.tenant_id);
    requireRole(auth, body.tenant_id, ['tenant_admin', 'accountant']);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Call engine
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
    if (!engResp.ok) throw new Error(`engine call failed: ${engResp.status} ${await engResp.text()}`);
    const engine = await engResp.json();
    if (!engine?.success) throw new Error(`engine error: ${engine?.error ?? 'unknown'}`);
    const payload = engine.payload as any;

    // Fetch tenant logo + slug
    const tenantResp = await fetch(`${supabaseUrl}/rest/v1/tenants?id=eq.${body.tenant_id}&select=name,slug,logo_url`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const tenantRow = (await tenantResp.json())?.[0] ?? {};
    const logoUrl = tenantRow.logo_url ?? null;
    const tenantName = tenantRow.name ?? payload?.metadata?.tenant?.name ?? 'Tenant';

    // Build PDF
    const doc = new Doc();
    await doc.init(tenantName, payload?.metadata?.generated_at ?? new Date().toISOString());

    await pageCover(doc, payload, body.period_type, logoUrl);
    pageSummary(doc, payload);
    pageByRate(doc, payload);
    pageByCountry(doc, payload);
    pageIcListing(doc, payload);
    pageOss(doc, payload);
    pageCreditNotes(doc, payload);
    pageStripe(doc, payload);
    pageAudit(doc, payload);
    pageValidation(doc, payload);

    doc.paginate();
    const bytes = await doc.pdf.save();

    const slug = slugify(String(tenantRow.slug ?? tenantName));
    const filename = `SellQo_BTW-aangifte_${slug}_${periodCode(body.period_start, body.period_end, body.period_type)}.pdf`;

    return new Response(bytes, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error('[export-vat-pdf] error', e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});