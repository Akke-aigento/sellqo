// QR-PRINT-1 — allergenenkaart als PDF (A4 liggend), in plaats van een afdrukvenster
// (window.open + print werkt niet in Safari op gsm, de app op het beginscherm en de native app).
// Inhoud zoals ALLERGEN-3: per groep de gerechten tegen de 14 EU-allergenen, met een bolletje
// waar het allergeen aanwezig is. Herhaalt de kop op elke pagina.
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { hardenPdfFont } from '../../supabase/functions/_shared/pdfText';

const MM = 72 / 25.4;
const PAGE_W = 297 * MM;
const PAGE_H = 210 * MM;

export interface AllergenChartRow { name: string; marks: boolean[]; note?: string }
export interface AllergenChartGroup { title: string; rows: AllergenChartRow[] }
export interface AllergenChartInput {
  title: string;
  subtitle: string;
  footer: string;
  /** Kolomkoppen, in de volgorde van `marks`. */
  allergens: string[];
  groups: AllergenChartGroup[];
}

function fit(text: string, font: PDFFont, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

export async function generateAllergenChartPdf(input: AllergenChartInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  const font = hardenPdfFont(await doc.embedFont(StandardFonts.Helvetica));
  const bold = hardenPdfFont(await doc.embedFont(StandardFonts.HelveticaBold));
  const line = rgb(0.73, 0.73, 0.73);
  const grey = rgb(0.33, 0.33, 0.33);
  const band = rgb(0.93, 0.93, 0.93);

  const m = 10 * MM;
  const colW = 7.6 * MM;
  const headH = 34 * MM;
  const rowH = 5.2 * MM;
  const n = input.allergens.length;
  const nameW = PAGE_W - 2 * m - n * colW;
  const fs = 8;

  let page!: PDFPage;
  let y = 0;
  const newPage = (first: boolean) => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - m;
    if (first) {
      page.drawText(fit(input.title, bold, 14, PAGE_W - 2 * m), { x: m, y: y - 12, size: 14, font: bold });
      page.drawText(fit(input.subtitle, font, 8.5, PAGE_W - 2 * m), { x: m, y: y - 24, size: 8.5, font, color: grey });
      y -= 32;
    }
    // Kop: schuine/verticale allergeennamen.
    page.drawRectangle({ x: m, y: y - headH, width: nameW + n * colW, height: headH, borderColor: line, borderWidth: 0.5 });
    input.allergens.forEach((a, i) => {
      const x = m + nameW + i * colW;
      page.drawLine({ start: { x, y }, end: { x, y: y - headH }, thickness: 0.5, color: line });
      page.drawText(fit(a, bold, 7.5, headH - 4), { x: x + colW / 2 + 2.6, y: y - headH + 2, size: 7.5, font: bold, rotate: degrees(90) });
    });
    y -= headH;
  };
  newPage(true);

  const row = (label: string, opts: { group?: boolean; marks?: boolean[]; note?: string }) => {
    if (y - rowH < m + 10) newPage(false);
    const p = page;
    if (opts.group) p.drawRectangle({ x: m, y: y - rowH, width: nameW + n * colW, height: rowH, color: band });
    p.drawRectangle({ x: m, y: y - rowH, width: nameW + n * colW, height: rowH, borderColor: line, borderWidth: 0.5 });
    const f = opts.group ? bold : font;
    const text = opts.note ? `${label} (${opts.note})` : label;
    p.drawText(fit(text, f, fs, nameW - 6), { x: m + 3, y: y - rowH + 1.6 * MM, size: fs, font: f });
    if (!opts.group) {
      (opts.marks ?? []).forEach((on, i) => {
        const x = m + nameW + i * colW;
        p.drawLine({ start: { x, y }, end: { x, y: y - rowH }, thickness: 0.5, color: line });
        if (on) p.drawCircle({ x: x + colW / 2, y: y - rowH / 2, size: 1.4 * MM, color: rgb(0, 0, 0) });
      });
    }
    y -= rowH;
  };

  for (const g of input.groups) {
    row(g.title, { group: true });
    for (const r of g.rows) row(r.name, { marks: r.marks, note: r.note });
  }
  if (y - 14 < m) newPage(false);
  page!.drawText(fit(input.footer, font, 8, PAGE_W - 2 * m), { x: m, y: y - 12, size: 8, font, color: grey });
  return doc.save();
}
