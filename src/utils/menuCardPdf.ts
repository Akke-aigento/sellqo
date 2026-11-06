// MENUKAART-PRINT-1 — de papieren menukaart als PDF (pdf-lib, in de browser). Zelfde aanpak als
// menuQrPdf/allergenChartPdf (QR-PRINT-1): downloaden in plaats van een afdrukvenster, want
// window.print werkt niet in Safari op gsm, de beginscherm-app en de native app.
//
// Drie sjablonen:
//  - booklet_a5: A5-boekje op A4 liggend (twee A5-pagina's per zijde), met echte imposition
//    zodat je dubbelzijdig afdrukt, de vellen op elkaar legt en dubbelvouwt;
//  - a4: losse A4-pagina's staand (kaft, binnenpagina's in twee kolommen, achterkant),
//    dubbelzijdig in leesvolgorde — voor een menumap of -houder;
//  - photo_cover: het A5-boekje met een grote foto op de kaft.
//
// Lettertypes: de standaardfonts van pdf-lib (Times voor de kaart, Helvetica voor kleine
// labels), gehard met hardenPdfFont (tekens buiten WinAnsi worden vervangen in plaats van te
// crashen). Een eigen font inbedden vraagt @pdf-lib/fontkit, en dat zit niet in dit project.
import {
  Duplex, LineCapStyle, PDFDocument, PrintScaling, StandardFonts, clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb, setCharacterSpacing,
  type PDFFont, type PDFImage, type PDFPage, type RGB,
} from 'pdf-lib';
import { hardenPdfFont } from '../../supabase/functions/_shared/pdfText';
import { qrPath } from './floorQrPdf';
import { hexColor } from './menuQrPdf';
import { bookletPrintOrder, totalPages, type MenuItem, type MenuPrintTemplate, type MenuSection } from '@/lib/menuPrint';

export const MM = 72 / 25.4;

export interface PdfImageBytes { bytes: Uint8Array; kind: 'png' | 'jpg' }

export interface MenuCardLabels {
  /** Groot woord op de kaft, bv. "Menu" of "Kaart". */
  coverTitle: string;
  /** Achter een categoriekop die op een nieuwe kolom verdergaat, bv. "vervolg". */
  continued: string;
  allergensTitle: string;
  /** De 14 allergenen in de volgorde van ALLERGENS. */
  allergenNames: string[];
  /** Dieetcode → { kort label op de kaart, uitleg in de legende }. */
  dietary: Record<string, { short: string; label: string }>;
  hoursTitle: string;
  qrCaption: string;
  priceNote: string;
}

export interface MenuCardInput {
  template: MenuPrintTemplate;
  storeName: string;
  subtitle?: string;
  accent?: string | null;
  logo?: PdfImageBytes | null;
  /** Enkel voor photo_cover. */
  cover?: PdfImageBytes | null;
  sections: MenuSection[];
  showDescriptions: boolean;
  showAllergens: boolean;
  labels: MenuCardLabels;
  back: {
    /** Adresregels, telefoon, website; leeg = niet tonen. */
    lines: string[];
    hours: { days: string; value: string }[];
    qrUrl?: string | null;
    qrText?: string | null;
  };
  /** Standaard: boekjes geïmponeerd (vellen). false = losse pagina's in leesvolgorde (drukkerij, scherm). */
  impose?: boolean;
  /** Locale voor de prijzen (bv. nl-BE, fr-BE); standaard nl-BE. Zonder euroteken: de achterkant zegt "prijzen in euro". */
  priceLocale?: string;
}

export interface MenuCardResult {
  bytes: Uint8Array;
  /** Logische pagina's (kaft t.e.m. achterkant, met opvulpagina's). */
  pages: number;
  /** Fysieke vellen papier (dubbelzijdig). */
  sheets: number;
  /** Lettergrootte-schaal die gekozen werd om de kaart compact te houden (1 = normaal). */
  scale: number;
  warnings: ('logo' | 'cover')[];
}

// ---------------------------------------------------------------------------------------------
// Geometrie en lay-out (puur, met de echte fontbreedtes)
// ---------------------------------------------------------------------------------------------

export interface PageGeo { w: number; h: number; mx: number; top: number; bottom: number; cols: number; gutter: number }

export const GEO_A5: PageGeo = { w: 148 * MM, h: 210 * MM, mx: 14 * MM, top: 15 * MM, bottom: 17 * MM, cols: 1, gutter: 0 };
export const GEO_A4: PageGeo = { w: 210 * MM, h: 297 * MM, mx: 16 * MM, top: 20 * MM, bottom: 20 * MM, cols: 2, gutter: 10 * MM };
export const geoFor = (template: MenuPrintTemplate) => (template === 'a4' ? GEO_A4 : GEO_A5);
export const colWidth = (g: PageGeo) => (g.w - 2 * g.mx - (g.cols - 1) * g.gutter) / g.cols;

export interface Fonts { serif: PDFFont; bold: PDFFont; italic: PDFFont; sans: PDFFont; sansBold: PDFFont }

export interface LayoutOptions { showDescriptions: boolean; showAllergens: boolean; labels: MenuCardLabels; priceLocale?: string }

export type Block =
  | { kind: 'heading'; title: string; continued: boolean; gap: number; height: number }
  | { kind: 'item'; item: MenuItem; nameLines: string[]; descLines: string[]; suffix: Suffix; price: string; height: number }
  | { kind: 'legend'; lines: { text: string; bold?: boolean }[]; height: number };

export interface Placed { block: Block; col: number; top: number }
export interface LaidOutPage { blocks: Placed[] }

interface Suffix { allergens: string; dietary: string; width: number }

/**
 * Prijs op de kaart in de taal van de kaart (gasten lezen hem, geen boekhouding), zonder euroteken:
 * de achterkant vermeldt "prijzen in euro". Prijs ≤ 0 (of geen getal) = geen prijs op de kaart.
 * U+202F (smalle harde spatie in fr) bestaat niet in WinAnsi: gewone harde spatie.
 */
export function formatMenuPrice(n: number, locale = 'nl-BE'): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  let f: Intl.NumberFormat;
  try { f = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch { f = new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  return f.format(n).replace(/\u202f/g, '\u00a0');
}

/** Maten bij schaal s. A4 iets groter dan A5. */
export function sizes(g: PageGeo, s: number) {
  const k = g === GEO_A4 ? 1.08 : 1;
  return {
    name: 10.5 * s * k, desc: 8.6 * s * k, small: 6.2 * s * k, heading: 11.5 * s * k, legend: 7 * s * k,
    itemGap: 2.6 * MM * s, headGap: 6.5 * MM * s, headAfter: 3.2 * MM * s,
  };
}

export function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxW;
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (fits(test)) { cur = test; continue; }
    if (cur) lines.push(cur);
    if (fits(w)) { cur = w; continue; }
    // Eén woord breder dan de kolom: op tekens afbreken.
    let part = '';
    for (const ch of Array.from(w)) {
      if (part && !fits(part + ch)) { lines.push(part); part = ch; } else part += ch;
    }
    cur = part;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function measureItem(item: MenuItem, f: Fonts, g: PageGeo, s: number, o: LayoutOptions): Block {
  const z = sizes(g, s);
  const cw = colWidth(g);
  const price = formatMenuPrice(item.price, o.priceLocale);
  const priceW = price ? f.bold.widthOfTextAtSize(price, z.name) : 0;
  const allergens = o.showAllergens && item.allergens.length ? item.allergens.join(',') : '';
  const dietary = item.dietary.map((d) => o.labels.dietary[d]?.short).filter(Boolean).join(' ');
  const suffixW = (allergens ? f.sans.widthOfTextAtSize(allergens, z.small) + 2 : 0) + (dietary ? f.sansBold.widthOfTextAtSize(dietary, z.small) + 3 : 0);
  // Ruimte voor de naam: kolom min prijs min een minimale stippellijn, min de kleine codes erachter.
  const nameW = Math.max(30 * MM, cw - (price ? priceW + 7 * MM : 0) - suffixW);
  const nameLines = wrapText(item.name, f.bold, z.name, nameW);
  const descW = cw - Math.max(priceW, 10 * MM) - 4 * MM;
  const descLines = o.showDescriptions && item.description ? wrapText(item.description, f.italic, z.desc, descW).slice(0, 4) : [];
  const height = nameLines.length * z.name * 1.22 + (descLines.length ? 1.2 + descLines.length * z.desc * 1.3 : 0) + z.itemGap;
  return { kind: 'item', item, nameLines, descLines, suffix: { allergens, dietary, width: suffixW }, price, height };
}

function headingBlock(title: string, continued: boolean, atTop: boolean, g: PageGeo, s: number): Block {
  const z = sizes(g, s);
  const gap = atTop ? 0 : z.headGap;
  return { kind: 'heading', title, continued, gap, height: gap + z.heading + 2.2 * MM * s + z.headAfter };
}

function legendBlock(sections: MenuSection[], f: Fonts, g: PageGeo, s: number, o: LayoutOptions): Block | null {
  const z = sizes(g, s);
  const cw = colWidth(g);
  const used = new Set(sections.flatMap((x) => x.items.flatMap((i) => i.dietary)));
  const anyAllergen = sections.some((x) => x.items.some((i) => i.allergens.length));
  const lines: { text: string; bold?: boolean }[] = [];
  if (o.showAllergens && anyAllergen) {
    lines.push({ text: o.labels.allergensTitle, bold: true });
    const text = o.labels.allergenNames.map((n, i) => `${i + 1} ${n}`).join('  ·  ');
    wrapText(text, f.sans, z.legend, cw).forEach((l) => lines.push({ text: l }));
  }
  const diet = Object.entries(o.labels.dietary).filter(([code]) => used.has(code)).map(([, d]) => `${d.short} ${d.label}`);
  if (diet.length) wrapText(diet.join('  ·  '), f.sans, z.legend, cw).forEach((l) => lines.push({ text: l }));
  if (!lines.length) return null;
  return { kind: 'legend', lines, height: z.headGap + lines.length * z.legend * 1.45 };
}

/**
 * Verdeelt de kaart over pagina's en kolommen. Regels: een gerecht wordt nooit gesplitst; een
 * categoriekop staat nooit alleen onderaan (hij gaat mee met zijn eerste gerecht); loopt een
 * categorie door op een nieuwe kolom, dan komt de kop terug met "vervolg".
 */
export function layoutMenu(sections: MenuSection[], f: Fonts, g: PageGeo, s: number, o: LayoutOptions): LaidOutPage[] {
  const pages: LaidOutPage[] = [{ blocks: [] }];
  const topY = g.h - g.top;
  let col = 0;
  let y = topY;
  const atTop = () => y >= topY - 0.01;
  const next = () => {
    col += 1;
    if (col >= g.cols) { col = 0; pages.push({ blocks: [] }); }
    y = topY;
  };
  const place = (block: Block) => {
    pages[pages.length - 1].blocks.push({ block, col, top: y });
    y -= block.height;
  };
  for (const sec of sections) {
    sec.items.forEach((item, i) => {
      const it = measureItem(item, f, g, s, o);
      if (i === 0) {
        let h = headingBlock(sec.title, false, atTop(), g, s);
        if (y - h.height - it.height < g.bottom && !atTop()) { next(); h = headingBlock(sec.title, false, true, g, s); }
        place(h);
      } else if (y - it.height < g.bottom) {
        next();
        place(headingBlock(sec.title, true, true, g, s));
      }
      place(it);
    });
  }
  const legend = legendBlock(sections, f, g, s, o);
  if (legend) {
    if (y - legend.height < g.bottom && !atTop()) next();
    place(legend);
  }
  return pages.filter((p, i) => p.blocks.length || i === 0);
}

const SCALES = [1, 0.94, 0.88, 0.82];

/** Kiest de grootste letterschaal met het kleinste aantal vellen (lange kaarten worden compacter). */
export function chooseLayout(sections: MenuSection[], f: Fonts, template: MenuPrintTemplate, o: LayoutOptions) {
  const g = geoFor(template);
  let best: { scale: number; pages: LaidOutPage[]; total: number } | null = null;
  for (const s of SCALES) {
    const pages = layoutMenu(sections, f, g, s, o);
    const total = totalPages(template, pages.length);
    if (!best || total < best.total) best = { scale: s, pages, total };
  }
  return best!;
}

// ---------------------------------------------------------------------------------------------
// Tekenen
// ---------------------------------------------------------------------------------------------

const INK = rgb(0.11, 0.11, 0.12);
const GREY = rgb(0.42, 0.42, 0.44);
const LIGHT = rgb(0.72, 0.72, 0.74);
const WHITE = rgb(1, 1, 1);

/** Kleur gemengd met wit (t = 0 → kleur, 1 → wit). */
const tint = (c: RGB, t: number) => rgb(c.red + (1 - c.red) * t, c.green + (1 - c.green) * t, c.blue + (1 - c.blue) * t);
/** Merkkleur die te licht is voor tekst op wit: donkerder maken. */
function readable(c: RGB): RGB {
  const lum = 0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue;
  if (lum < 0.6) return c;
  const k = 0.55 / lum;
  return rgb(c.red * k, c.green * k, c.blue * k);
}

function tracked(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color: RGB, tracking: number) {
  page.pushOperators(setCharacterSpacing(tracking));
  page.drawText(text, { x, y, size, font, color });
  page.pushOperators(setCharacterSpacing(0));
}
const trackedWidth = (text: string, font: PDFFont, size: number, tracking: number) =>
  font.widthOfTextAtSize(text, size) + tracking * Math.max(0, Array.from(text).length - 1);

function centeredTracked(page: PDFPage, text: string, cx: number, y: number, size: number, font: PDFFont, color: RGB, tracking: number, maxW: number) {
  let s = size;
  let tr = tracking;
  while (s > 5 && trackedWidth(text, font, s, tr) > maxW) { s -= 0.5; tr = tracking * (s / size); }
  tracked(page, text, cx - trackedWidth(text, font, s, tr) / 2, y, s, font, color, tr);
  return s;
}

/** Fijne lijn met een ruitje in het midden. */
function ornament(page: PDFPage, cx: number, y: number, half: number, color: RGB) {
  page.drawLine({ start: { x: cx - half, y }, end: { x: cx - 3, y }, thickness: 0.5, color });
  page.drawLine({ start: { x: cx + 3, y }, end: { x: cx + half, y }, thickness: 0.5, color });
  page.drawSvgPath('M 0 -1.8 L 1.8 0 L 0 1.8 L -1.8 0 Z', { x: cx, y, color, borderWidth: 0 });
}

function drawImageFit(page: PDFPage, img: PDFImage, cx: number, top: number, maxW: number, maxH: number) {
  const k = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * k; const h = img.height * k;
  page.drawImage(img, { x: cx - w / 2, y: top - h, width: w, height: h });
  return h;
}

/** Afbeelding die het vlak volledig vult (bijsnijden zoals object-fit: cover). */
function drawImageCover(page: PDFPage, img: PDFImage, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / img.width, h / img.height);
  const iw = img.width * k; const ih = img.height * k;
  page.pushOperators(pushGraphicsState(), rectangle(x, y, w, h), clip(), endPath());
  page.drawImage(img, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
  page.pushOperators(popGraphicsState());
}

interface Ctx { doc: PDFDocument; f: Fonts; accent: RGB; accentText: RGB; logo: PDFImage | null; cover: PDFImage | null; input: MenuCardInput; g: PageGeo; scale: number }

function drawInside(page: PDFPage, blocks: Placed[], c: Ctx, pageNo: number) {
  const { f, g } = c;
  const z = sizes(g, c.scale);
  const cw = colWidth(g);
  for (const { block, col, top } of blocks) {
    const x = g.mx + col * (cw + g.gutter);
    if (block.kind === 'heading') {
      const base = top - block.gap - z.heading * 0.8;
      const title = block.title.toLocaleUpperCase();
      tracked(page, title, x, base, z.heading, f.bold, c.accentText, 1.3 * c.scale);
      if (block.continued) {
        const w = trackedWidth(title, f.bold, z.heading, 1.3 * c.scale);
        page.drawText(c.input.labels.continued, { x: x + w + 5, y: base, size: z.desc, font: f.italic, color: GREY });
      }
      const ry = base - 2.2 * MM * c.scale;
      page.drawLine({ start: { x, y: ry }, end: { x: x + 14 * MM, y: ry }, thickness: 0.8, color: c.accent });
    } else if (block.kind === 'item') {
      const lh = z.name * 1.22;
      let y = top - z.name * 0.82;
      const priceW = f.bold.widthOfTextAtSize(block.price, z.name);
      const priceX = x + cw - priceW;
      block.nameLines.forEach((line, i) => {
        page.drawText(line, { x, y, size: z.name, font: f.bold, color: INK });
        let end = x + f.bold.widthOfTextAtSize(line, z.name);
        if (i === block.nameLines.length - 1) {
          if (block.suffix.allergens) {
            page.drawText(block.suffix.allergens, { x: end + 2, y: y + z.name * 0.38, size: z.small, font: f.sans, color: GREY });
            end += 2 + f.sans.widthOfTextAtSize(block.suffix.allergens, z.small);
          }
          if (block.suffix.dietary) {
            page.drawText(block.suffix.dietary, { x: end + 3, y: y + 0.6, size: z.small, font: f.sansBold, color: c.accentText });
            end += 3 + f.sansBold.widthOfTextAtSize(block.suffix.dietary, z.small);
          }
        }
        if (i === 0 && block.price) {
          // Stippellijn tussen naam en prijs (enkel op de eerste regel, waar de prijs staat): één lijn
          // met ronde streepjes van lengte ~0, i.p.v. een cirkel per stip (veel kleinere PDF).
          const from = (block.nameLines.length === 1 ? end : x + f.bold.widthOfTextAtSize(line, z.name)) + 4;
          if (priceX - 4 - from > 4) {
            page.drawLine({ start: { x: from, y: y + 1.2 }, end: { x: priceX - 4, y: y + 1.2 }, thickness: 0.76, color: LIGHT, dashArray: [0.01, 2.8], lineCap: LineCapStyle.Round });
          }
          page.drawText(block.price, { x: priceX, y, size: z.name, font: f.bold, color: INK });
        }
        y -= lh;
      });
      if (block.descLines.length) {
        // y staat nu op de basislijn van een volgende naamregel; terug naar de eerste omschrijvingsregel.
        y += lh - z.desc * 1.25 - 1.2;
        for (const line of block.descLines) {
          page.drawText(line, { x, y, size: z.desc, font: f.italic, color: GREY });
          y -= z.desc * 1.3;
        }
      }
    } else {
      let y = top - z.headGap + 2 * MM;
      page.drawLine({ start: { x, y: y + 2.5 * MM }, end: { x: x + 10 * MM, y: y + 2.5 * MM }, thickness: 0.5, color: LIGHT });
      for (const l of block.lines) {
        y -= z.legend * 1.45;
        if (l.bold) tracked(page, l.text.toLocaleUpperCase(), x, y, z.legend, f.sansBold, GREY, 0.8);
        else page.drawText(l.text, { x, y, size: z.legend, font: f.sans, color: GREY });
      }
    }
  }
  // Paginanummer tussen twee korte lijntjes.
  const n = String(pageNo);
  const nw = f.serif.widthOfTextAtSize(n, 8);
  const y = g.bottom / 2 - 2;
  const cx = g.w / 2;
  page.drawText(n, { x: cx - nw / 2, y, size: 8, font: f.serif, color: GREY });
  page.drawLine({ start: { x: cx - nw / 2 - 4 - 8 * MM, y: y + 2.6 }, end: { x: cx - nw / 2 - 4, y: y + 2.6 }, thickness: 0.4, color: LIGHT });
  page.drawLine({ start: { x: cx + nw / 2 + 4, y: y + 2.6 }, end: { x: cx + nw / 2 + 4 + 8 * MM, y: y + 2.6 }, thickness: 0.4, color: LIGHT });
}

function drawTypoCover(page: PDFPage, c: Ctx) {
  const { g, f, input } = c;
  const big = g === GEO_A4;
  const cx = g.w / 2;
  const inset = (big ? 10 : 7) * MM;
  page.drawRectangle({ x: inset, y: inset, width: g.w - 2 * inset, height: g.h - 2 * inset, borderColor: c.accent, borderWidth: 0.9 });
  const in2 = inset + 1.6 * MM;
  page.drawRectangle({ x: in2, y: in2, width: g.w - 2 * in2, height: g.h - 2 * in2, borderColor: c.accent, borderWidth: 0.3 });
  const maxW = g.w - 2 * in2 - 16 * MM;
  // Zonder logo staat het blok (naam, ornament, MENU) iets lager, optisch in het midden.
  let y = g.h * (c.logo ? 0.66 : 0.6);
  if (c.logo) {
    const h = drawImageFit(page, c.logo, cx, y + (big ? 30 : 22) * MM, maxW * 0.8, (big ? 48 : 34) * MM);
    y = y + (big ? 30 : 22) * MM - h - 9 * MM;
    centeredTracked(page, input.storeName.toLocaleUpperCase(), cx, y, big ? 10 : 8, f.serif, GREY, 2, maxW);
  } else {
    let s = big ? 40 : 28;
    while (s > 12 && f.bold.widthOfTextAtSize(input.storeName, s) > maxW) s -= 1;
    page.drawText(input.storeName, { x: cx - f.bold.widthOfTextAtSize(input.storeName, s) / 2, y, size: s, font: f.bold, color: INK });
  }
  y -= (big ? 22 : 16) * MM;
  ornament(page, cx, y + 4 * MM, (big ? 30 : 22) * MM, c.accent);
  centeredTracked(page, input.labels.coverTitle.toLocaleUpperCase(), cx, y - (big ? 14 : 10) * MM, big ? 30 : 22, f.serif, c.accentText, big ? 9 : 6.5, maxW);
  if (input.subtitle) {
    const s = big ? 13 : 10;
    const w = f.italic.widthOfTextAtSize(input.subtitle, s);
    page.drawText(input.subtitle, { x: cx - Math.min(w, maxW) / 2, y: y - (big ? 26 : 19) * MM, size: s, font: f.italic, color: GREY, maxWidth: maxW });
  }
}

function drawPhotoCover(page: PDFPage, c: Ctx) {
  const { g, f, input } = c;
  const m = 6 * MM;
  const cx = g.w / 2;
  drawImageCover(page, c.cover!, m, m, g.w - 2 * m, g.h - 2 * m);
  // Band onderaan in de merkkleur, licht doorschijnend, met naam en "Menu".
  const bandH = (input.subtitle ? 50 : 42) * MM;
  page.drawRectangle({ x: m, y: m, width: g.w - 2 * m, height: bandH, color: c.accent, opacity: 0.88 });
  const maxW = g.w - 2 * m - 14 * MM;
  let s = 24;
  while (s > 11 && f.bold.widthOfTextAtSize(input.storeName, s) > maxW) s -= 1;
  let y = m + bandH - 10 * MM - s * 0.5;
  page.drawText(input.storeName, { x: cx - f.bold.widthOfTextAtSize(input.storeName, s) / 2, y, size: s, font: f.bold, color: WHITE });
  y -= 7 * MM;
  ornament(page, cx, y + 1.5 * MM, 18 * MM, WHITE);
  y -= 8 * MM;
  centeredTracked(page, input.labels.coverTitle.toLocaleUpperCase(), cx, y, 15, f.serif, WHITE, 5, maxW);
  if (input.subtitle) {
    const w = Math.min(f.italic.widthOfTextAtSize(input.subtitle, 10), maxW);
    page.drawText(input.subtitle, { x: cx - w / 2, y: y - 8 * MM, size: 10, font: f.italic, color: WHITE, maxWidth: maxW });
  }
  if (c.logo) {
    // Logo op een wit kaartje bovenaan, zodat het op elke foto leesbaar blijft.
    const k = Math.min((44 * MM) / c.logo.width, (16 * MM) / c.logo.height);
    const w = c.logo.width * k; const h = c.logo.height * k;
    const pad = 3.5 * MM;
    const top = g.h - m - 8 * MM;
    page.drawRectangle({ x: cx - w / 2 - pad, y: top - h - 2 * pad, width: w + 2 * pad, height: h + 2 * pad, color: WHITE, opacity: 0.94 });
    page.drawImage(c.logo, { x: cx - w / 2, y: top - h - pad, width: w, height: h });
  }
}

function drawBack(page: PDFPage, c: Ctx) {
  const { g, f, input } = c;
  const big = g === GEO_A4;
  const cx = g.w / 2;
  const maxW = g.w - 2 * g.mx;
  let y = g.h - (big ? 34 : 24) * MM;
  if (c.logo) {
    y -= drawImageFit(page, c.logo, cx, y, maxW * 0.55, (big ? 26 : 18) * MM) + 7 * MM;
  } else {
    let s = big ? 24 : 18;
    while (s > 10 && f.bold.widthOfTextAtSize(input.storeName, s) > maxW) s -= 1;
    page.drawText(input.storeName, { x: cx - f.bold.widthOfTextAtSize(input.storeName, s) / 2, y: y - s, size: s, font: f.bold, color: INK });
    y -= s + 7 * MM;
  }
  ornament(page, cx, y, 18 * MM, c.accent);
  y -= 8 * MM;
  const ls = big ? 10.5 : 9;
  for (const line of input.back.lines) {
    const w = Math.min(f.serif.widthOfTextAtSize(line, ls), maxW);
    page.drawText(line, { x: cx - w / 2, y, size: ls, font: f.serif, color: INK, maxWidth: maxW });
    y -= ls * 1.45;
  }
  if (input.back.hours.length) {
    y -= 5 * MM;
    centeredTracked(page, input.labels.hoursTitle.toLocaleUpperCase(), cx, y, big ? 9 : 7.5, f.sansBold, c.accentText, 1.2, maxW);
    y -= ls * 1.7;
    const dw = Math.max(...input.back.hours.map((r) => f.serif.widthOfTextAtSize(r.days, ls)));
    const vw = Math.max(...input.back.hours.map((r) => f.serif.widthOfTextAtSize(r.value, ls)));
    const gap = 6 * MM;
    const left = cx - (dw + gap + vw) / 2;
    for (const r of input.back.hours) {
      page.drawText(r.days, { x: left, y, size: ls, font: f.serif, color: GREY });
      page.drawText(r.value, { x: left + dw + gap, y, size: ls, font: f.serif, color: INK });
      y -= ls * 1.4;
    }
  }
  if (input.back.qrUrl) {
    const side = (big ? 42 : 30) * MM;
    const qrTop = g.bottom + (big ? 30 : 24) * MM + side;
    const { d, size } = qrPath(input.back.qrUrl);
    page.drawRectangle({ x: cx - side / 2 - 3 * MM, y: qrTop - side - 3 * MM, width: side + 6 * MM, height: side + 6 * MM, borderColor: c.accent, borderWidth: 0.8 });
    page.drawSvgPath(d, { x: cx - side / 2, y: qrTop, scale: side / size, color: INK, borderWidth: 0 });
    const cap = big ? 10 : 8.5;
    const capW = Math.min(f.italic.widthOfTextAtSize(input.labels.qrCaption, cap), maxW);
    page.drawText(input.labels.qrCaption, { x: cx - capW / 2, y: qrTop - side - 9 * MM, size: cap, font: f.italic, color: INK, maxWidth: maxW });
    if (input.back.qrText) {
      const tw = Math.min(f.sans.widthOfTextAtSize(input.back.qrText, 7.5), maxW);
      page.drawText(input.back.qrText, { x: cx - tw / 2, y: qrTop - side - 14 * MM, size: 7.5, font: f.sans, color: GREY });
    }
  }
  const note = input.labels.priceNote;
  const nw = Math.min(f.italic.widthOfTextAtSize(note, 7.5), maxW);
  page.drawText(note, { x: cx - nw / 2, y: g.bottom / 2 + 2, size: 7.5, font: f.italic, color: GREY, maxWidth: maxW });
}

/** Opvulpagina (boekje = veelvoud van 4): een rustig ornament, geen lege witte pagina. */
function drawFiller(page: PDFPage, c: Ctx) {
  const { g, f } = c;
  const cx = g.w / 2;
  ornament(page, cx, g.h / 2 + 4 * MM, 16 * MM, tint(c.accent, 0.35));
  centeredTracked(page, c.input.storeName.toLocaleUpperCase(), cx, g.h / 2 - 4 * MM, 7.5, f.serif, LIGHT, 1.6, g.w - 2 * g.mx);
}

/** Viewer-voorkeuren die de afdrukdialoog van de meeste lezers overneemt (PDF 1.7, /ViewerPreferences). */
function setPrintPrefs(doc: PDFDocument, duplex: Duplex | null) {
  const vp = doc.catalog.getOrCreateViewerPreferences();
  vp.setPrintScaling(PrintScaling.None);
  if (duplex) vp.setDuplex(duplex);
}

async function embedImage(doc: PDFDocument, img: PdfImageBytes | null | undefined): Promise<PDFImage | null> {
  if (!img) return null;
  try {
    return img.kind === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
  } catch {
    return null;
  }
}

export async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  return {
    serif: hardenPdfFont(await doc.embedFont(StandardFonts.TimesRoman)),
    bold: hardenPdfFont(await doc.embedFont(StandardFonts.TimesRomanBold)),
    italic: hardenPdfFont(await doc.embedFont(StandardFonts.TimesRomanItalic)),
    sans: hardenPdfFont(await doc.embedFont(StandardFonts.Helvetica)),
    sansBold: hardenPdfFont(await doc.embedFont(StandardFonts.HelveticaBold)),
  };
}

export async function generateMenuCardPdf(input: MenuCardInput): Promise<MenuCardResult> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.labels.coverTitle} ${input.storeName}`);
  const f = await embedFonts(doc);
  const accent = hexColor(input.accent || '#1c1c1e');
  const warnings: MenuCardResult['warnings'] = [];
  const logo = await embedImage(doc, input.logo);
  if (input.logo && !logo) warnings.push('logo');
  const cover = input.template === 'photo_cover' ? await embedImage(doc, input.cover) : null;
  if (input.template === 'photo_cover' && !cover) warnings.push('cover');
  const g = geoFor(input.template);
  const o: LayoutOptions = { showDescriptions: input.showDescriptions, showAllergens: input.showAllergens, labels: input.labels, priceLocale: input.priceLocale };
  const chosen = chooseLayout(input.sections, f, input.template, o);
  const c: Ctx = { doc, f, accent, accentText: readable(accent), logo, cover, input, g, scale: chosen.scale };

  const total = chosen.total;
  const content = chosen.pages.length;
  for (let p = 1; p <= total; p++) {
    const page = doc.addPage([g.w, g.h]);
    if (p === 1) {
      if (c.cover) drawPhotoCover(page, c); else drawTypoCover(page, c);
    } else if (p === total) drawBack(page, c);
    else if (p - 1 <= content) drawInside(page, chosen.pages[p - 2].blocks, c, p);
    else drawFiller(page, c);
  }

  const impose = input.template !== 'a4' && input.impose !== false;
  if (!impose) {
    // Afdrukvoorkeuren: altijd op ware grootte; A4-kaart dubbelzijdig omslaan langs de lange kant.
    setPrintPrefs(doc, input.template === 'a4' ? Duplex.DuplexFlipLongEdge : null);
    return { bytes: await doc.save(), pages: total, sheets: input.template === 'a4' ? total / 2 : total / 4, scale: chosen.scale, warnings };
  }
  // Imposition: twee A5-pagina's naast elkaar op A4 liggend, in de volgorde van de vellen.
  const out = await PDFDocument.create();
  out.setTitle(`${input.labels.coverTitle} ${input.storeName}`);
  // Liggende vellen: dubbelzijdig omslaan langs de korte kant, op ware grootte (anders klopt de vouw niet).
  setPrintPrefs(out, Duplex.DuplexFlipShortEdge);
  // Eerst bewaren: pdf-lib bedt fonts en beelden pas in bij save(); embedPages op een niet-bewaarde
  // pagina verwijst naar fonts die niet bestaan (gemeten: pdftoppm "Unknown font tag").
  const embedded = await out.embedPdf(await doc.save(), Array.from({ length: total }, (_, i) => i));
  for (const [l, r] of bookletPrintOrder(total)) {
    // A4 = 297 mm breed, twee keer A5 = 296 mm: beide pagina's raken elkaar precies op de vouw.
    const sheet = out.addPage([297 * MM, 210 * MM]);
    const fold = (297 * MM) / 2;
    sheet.drawPage(embedded[l - 1], { x: fold - g.w, y: 0 });
    sheet.drawPage(embedded[r - 1], { x: fold, y: 0 });
  }
  return { bytes: await out.save(), pages: total, sheets: total / 4, scale: chosen.scale, warnings };
}
