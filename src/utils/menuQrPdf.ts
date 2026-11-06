// QR-PRINT-1 — QR-codes voor de menukaart als PDF (A4): een affiche, tafelkaartjes (4 per A4,
// elk met eigen tafelnummer) en stickers (12 per A4). Zelfde aanpak als de tafel-QR's van het
// zaalplan (floorQrPdf): pdf-lib + qr.js, QR als vectorpad, en downloaden in plaats van een
// afdrukvenster. Een pop-up met window.print() werkt niet in Safari op gsm, in de app op het
// beginscherm en in de native app; een gedownloade PDF wel (en die druk je af of deel je).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import { hardenPdfFont } from '../../supabase/functions/_shared/pdfText';
import { qrPath } from './floorQrPdf';

const MM = 72 / 25.4;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;

export type MenuQrLayout = 'poster' | 'tables' | 'stickers';

export interface MenuQrInput {
  layout: MenuQrLayout;
  /** De menu-URL, bv. https://<winkel>.sellqo.shop/menu */
  url: string;
  storeName: string;
  heading: string;
  sub: string;
  /** Hex-kleur, bv. #c0392b. Ongeldig of leeg = zwart. */
  accent?: string | null;
  /** Logo-URL (png of jpg). Mislukt laden = de zaaknaam als tekst. */
  logoUrl?: string | null;
  /** Tafelnummers voor layout 'tables'. */
  tables?: number[];
  /** Label per tafel, bv. (n) => "Tafel 3". */
  tableLabel?: (n: number) => string;
}

/** #rgb of #rrggbb naar pdf-lib-kleur; anders zwart. */
export function hexColor(hex: string | null | undefined): RGB {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return rgb(0, 0, 0);
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, cx: number, y: number, maxW: number, color: RGB = rgb(0, 0, 0)) {
  if (!text) return;
  let s = size;
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5;
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, s) / 2, y, size: s, font, color });
}

/** QR met linkerbovenhoek (x, top), zijde `side` (punten). */
function drawQr(page: PDFPage, url: string, x: number, top: number, side: number) {
  const { d, size } = qrPath(url);
  page.drawSvgPath(d, { x, y: top, scale: side / size, color: rgb(0, 0, 0), borderWidth: 0 });
}

async function loadLogo(doc: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Herken het formaat aan de inhoud, niet aan de extensie.
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes);
    return null; // svg/webp: niet ondersteund door pdf-lib → zaaknaam als tekst
  } catch {
    return null;
  }
}

export async function generateMenuQrPdf(input: MenuQrInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`QR menu ${input.storeName}`);
  const font = hardenPdfFont(await doc.embedFont(StandardFonts.Helvetica));
  const bold = hardenPdfFont(await doc.embedFont(StandardFonts.HelveticaBold));
  const accent = hexColor(input.accent);
  const grey = rgb(0.33, 0.33, 0.33);
  const line = rgb(0.73, 0.73, 0.73);
  const shortUrl = input.url.replace(/^https?:\/\//, '');

  if (input.layout === 'poster') {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const cx = PAGE_W / 2;
    const maxW = PAGE_W - 36 * MM;
    let y = PAGE_H - 30 * MM;
    const logo = await loadLogo(doc, input.logoUrl);
    if (logo) {
      const s = Math.min((120 * MM) / logo.width, (28 * MM) / logo.height);
      const w = logo.width * s; const h = logo.height * s;
      page.drawImage(logo, { x: cx - w / 2, y: y - h, width: w, height: h });
      y -= h + 14 * MM;
    } else {
      centered(page, input.storeName, bold, 38, cx, y - 12 * MM, maxW);
      y -= 26 * MM;
    }
    centered(page, input.heading, bold, 46, cx, y - 14 * MM, maxW, accent);
    y -= 26 * MM;
    const side = 120 * MM;
    const pad = 6 * MM;
    page.drawRectangle({ x: cx - side / 2 - pad, y: y - side - 2 * pad, width: side + 2 * pad, height: side + 2 * pad, borderColor: accent, borderWidth: 1.2 * MM });
    drawQr(page, input.url, cx - side / 2, y - pad, side);
    y -= side + 2 * pad + 14 * MM;
    centered(page, input.sub, font, 20, cx, y, maxW);
    centered(page, shortUrl, font, 13, cx, y - 11 * MM, maxW, grey);
  } else if (input.layout === 'tables') {
    const tables = input.tables ?? [];
    const label = input.tableLabel ?? ((n: number) => String(n));
    const cw = PAGE_W / 2; const ch = PAGE_H / 2;
    for (let i = 0; i < tables.length; i += 4) {
      const page = doc.addPage([PAGE_W, PAGE_H]);
      tables.slice(i, i + 4).forEach((n, j) => {
        const x = (j % 2) * cw;
        const top = PAGE_H - Math.floor(j / 2) * ch;
        const cx = x + cw / 2;
        const maxW = cw - 16 * MM;
        page.drawRectangle({ x, y: top - ch, width: cw, height: ch, borderColor: line, borderWidth: 0.6, borderDashArray: [3, 3] });
        centered(page, input.storeName, bold, 14, cx, top - 20 * MM, maxW, grey);
        centered(page, label(n), bold, 30, cx, top - 34 * MM, maxW, accent);
        const side = 62 * MM;
        drawQr(page, `${input.url}?tafel=${n}`, cx - side / 2, top - 40 * MM, side);
        const below = top - 40 * MM - side;
        centered(page, input.heading, bold, 16, cx, below - 9 * MM, maxW);
        centered(page, input.sub, font, 11, cx, below - 16 * MM, maxW, grey);
      });
    }
  } else {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const m = 8 * MM; const gap = 4 * MM;
    const cw = (PAGE_W - 2 * m - 2 * gap) / 3;
    const ch = (PAGE_H - 2 * m - 3 * gap) / 4;
    for (let i = 0; i < 12; i++) {
      const x = m + (i % 3) * (cw + gap);
      const top = PAGE_H - m - Math.floor(i / 3) * (ch + gap);
      const cx = x + cw / 2;
      page.drawRectangle({ x, y: top - ch, width: cw, height: ch, borderColor: accent, borderWidth: 0.6 * MM });
      const side = 42 * MM;
      const qrTop = top - (ch - side - 9 * MM) / 2;
      drawQr(page, input.url, cx - side / 2, qrTop, side);
      centered(page, input.heading, bold, 11, cx, qrTop - side - 6 * MM, cw - 6 * MM, accent);
    }
  }
  return doc.save();
}
