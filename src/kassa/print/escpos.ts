// PRINT-1 — TicketDoc als ESC/POS-bytes (Epson TM-reeks en compatibele LAN-printers).
//
// Codepage: PC858 (= PC850 + euroteken op 0xD5), gekozen met ESC t 19. Bevat alle tekens die
// NL/FR/DE-tickets nodig hebben (é è ê ë à â ç ï î ô ù û ü ä ö ß É È À Ç Ü Ä Ö €). Tekens die
// er niet in staan worden '?' (en Unicode-aanhalingstekens/streepjes eerst naar ASCII).
// ESC t 19 = PC858 volgens de Epson ESC/POS-referentie ("ESC t", codepagina-tabel); op
// printers van andere merken kan het nummer verschillen: OPEN PUNT, testen op de echte printer.
//
// Opmaak: ESC @ (init), ESC a (uitlijnen), ESC E (vet), GS ! 0x01 (dubbele hoogte, zelfde
// breedte zodat de kolommen kloppen), GS V 66 0 (papier door + gedeeltelijk snijden).
// QR: GS ( k model 2 (fn 165), modulegrootte (fn 167), foutcorrectie M (fn 169, n=49),
// opslaan (fn 180) en afdrukken (fn 181). De printer kiest zelf de kleinste QR-versie.
import { layout, type PaperWidth } from './layout';
import type { TicketDoc } from './types';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// Bytes 0x80..0xFF van PC858, in volgorde (gegenereerd met Python's cp858-codec).
const CP858_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';
const CP858 = new Map<string, number>();
for (let i = 0; i < CP858_HIGH.length; i++) CP858.set(CP858_HIGH[i], 0x80 + i);

const ASCII_FALLBACK: Record<string, string> = {
  '‘': "'", '’': "'", '‚': ',', '“': '"', '”': '"', '„': '"', '–': '-', '—': '-', '…': '...', ' ': ' ', ' ': ' ',
};

/** Unicode → PC858. Onbekende tekens worden '?'. */
export function encodeCp858(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0) as number;
    if (code >= 0x20 && code < 0x7f) { out.push(code); continue; }
    const mapped = CP858.get(ch);
    if (mapped !== undefined) { out.push(mapped); continue; }
    const fb = ASCII_FALLBACK[ch];
    if (fb) { out.push(...fb.split('').map((c) => c.charCodeAt(0))); continue; }
    out.push(0x3f);
  }
  return out;
}

/** Omgekeerde richting (tests, voorbeeld van wat de printer krijgt). Stuurcodes worden niet gefilterd. */
export function decodeCp858(bytes: ArrayLike<number>): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    s += b < 0x80 ? String.fromCharCode(b) : CP858_HIGH[b - 0x80];
  }
  return s;
}

export interface EscPosOptions {
  /** QR-modulegrootte in dots (1..16). 58 mm: 4, 80 mm: 5 is een goede start. */
  qrModuleSize?: number;
  /** Lege regels vóór het snijden. */
  feedLines?: number;
  cut?: boolean;
}

export const ESCPOS = {
  init: [ESC, 0x40],
  codepagePc858: [ESC, 0x74, 19],
  alignLeft: [ESC, 0x61, 0],
  alignCenter: [ESC, 0x61, 1],
  boldOn: [ESC, 0x45, 1],
  boldOff: [ESC, 0x45, 0],
  doubleHeightOn: [GS, 0x21, 0x01],
  sizeNormal: [GS, 0x21, 0x00],
  cut: [GS, 0x56, 66, 0],
} as const;

/** GS ( k: QR model 2, grootte, ECC M, opslaan, afdrukken. */
export function escposQr(data: string, moduleSize = 5): number[] {
  const bytes = encodeCp858(data);
  if (bytes.some((b) => b === 0x3f && !data.includes('?'))) throw new Error('PRT-03: QR-data bevat tekens buiten ASCII');
  const size = Math.min(16, Math.max(1, Math.round(moduleSize)));
  const len = bytes.length + 3;
  return [
    GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00, // fn 165: model 2
    GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, size, // fn 167: modulegrootte
    GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31, // fn 169: foutcorrectie M (49)
    GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...bytes, // fn 180: opslaan
    GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30, // fn 181: afdrukken
  ];
}

export function renderEscPos(doc: TicketDoc, width: PaperWidth, opts: EscPosOptions = {}): Uint8Array {
  const out: number[] = [...ESCPOS.init, ...ESCPOS.codepagePc858, ...ESCPOS.alignLeft];
  for (const l of layout(doc, width)) {
    if (l.kind === 'qr') {
      out.push(...ESCPOS.alignCenter, ...escposQr(l.data, opts.qrModuleSize ?? (width <= 32 ? 4 : 5)), LF, ...ESCPOS.alignLeft);
      continue;
    }
    if (l.bold) out.push(...ESCPOS.boldOn);
    if (l.big) out.push(...ESCPOS.doubleHeightOn);
    out.push(...encodeCp858(l.text), LF);
    if (l.big) out.push(...ESCPOS.sizeNormal);
    if (l.bold) out.push(...ESCPOS.boldOff);
  }
  for (let i = 0; i < (opts.feedLines ?? 4); i++) out.push(LF);
  if (opts.cut ?? true) out.push(...ESCPOS.cut);
  return Uint8Array.from(out);
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
