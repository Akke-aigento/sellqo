// ZAAL-H1 — QR-stickers per tafel als PDF: A4, 12 per blad (3 × 4), elk met de QR-code
// (vectorpad, altijd scherp), het tafellabel, de ruimte en de zaaknaam. De QR wijst naar
// https://<winkel>.sellqo.shop/menu?t=<qr_token>. Hergebruikt pdf-lib (zit al in de app)
// en qr.js (de motor onder react-qr-code); geen nieuwe dependency.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qr.js/lib/QRCode';
import ErrorCorrectLevel from 'qr.js/lib/ErrorCorrectLevel';
import { hardenPdfFont } from '../../supabase/functions/_shared/pdfText';
import { chunk, stickerCell } from '@/lib/floorplan/qr';

const MM = 72 / 25.4;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;

export interface QrSticker {
  label: string;
  area: string;
  url: string;
}

export interface QrPdfText {
  storeName: string;
  /** Korte oproep onder het label, bv. "Scan en bestel aan tafel". */
  callToAction: string;
}

/** QR-matrix als één SVG-pad (een vierkantje per donkere module). */
export function qrPath(value: string): { d: string; size: number } {
  const qr = new QRCode(-1, ErrorCorrectLevel.M);
  qr.addData(value);
  qr.make();
  const parts: string[] = [];
  qr.modules.forEach((row, y) => row.forEach((on, x) => { if (on) parts.push(`M${x} ${y}h1v1h-1z`); }));
  return { d: parts.join(''), size: qr.modules.length };
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, cx: number, y: number, maxW: number, color = rgb(0, 0, 0)) {
  let s = size;
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5;
  const w = font.widthOfTextAtSize(text, s);
  page.drawText(text, { x: cx - w / 2, y, size: s, font, color });
}

export async function generateFloorQrPdf(stickers: QrSticker[], text: QrPdfText): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`QR ${text.storeName}`);
  const font = hardenPdfFont(await doc.embedFont(StandardFonts.Helvetica));
  const bold = hardenPdfFont(await doc.embedFont(StandardFonts.HelveticaBold));
  const grey = rgb(0.4, 0.4, 0.4);
  const line = rgb(0.75, 0.75, 0.75);

  for (const sheet of chunk(stickers, 12)) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    sheet.forEach((s, i) => {
      const c = stickerCell(i);
      // pdf-lib telt y van onder; stickerCell van boven.
      const x = c.x * MM;
      const top = PAGE_H - c.y * MM;
      const w = c.w * MM;
      const h = c.h * MM;
      const cx = x + w / 2;
      page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: line, borderWidth: 0.6, borderDashArray: [3, 3] });

      centered(page, text.storeName, font, 7.5, cx, top - 5 * MM, w - 6 * MM, grey);
      centered(page, s.label, bold, 20, cx, top - 13 * MM, w - 6 * MM);

      const qrSide = Math.min(w - 16 * MM, h - 30 * MM);
      const { d, size } = qrPath(s.url);
      const scale = qrSide / size;
      // drawSvgPath: (x, y) is de linkerbovenhoek van het pad, y van het pad loopt naar onder.
      page.drawSvgPath(d, { x: cx - qrSide / 2, y: top - 15.5 * MM, scale, color: rgb(0, 0, 0), borderWidth: 0 });

      const below = top - 15.5 * MM - qrSide;
      if (s.area) centered(page, s.area, font, 7.5, cx, below - 4 * MM, w - 6 * MM, grey);
      centered(page, text.callToAction, bold, 8, cx, below - 8 * MM, w - 6 * MM);
    });
  }
  return doc.save();
}

/** Download in de browser (geen popup nodig: alles staat al klaar vóór de klik eindigt). */
export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
