// PRINT-1 — van TicketDoc naar een rij in public.print_jobs (pure logica, geen DB, geen hardware).
//
// Regels:
// - Elke afdruk hoort bij precies één ondertekend event (doc.fdmRef). De dedupe_key is uniek per
//   zaak: hetzelfde event wordt nooit twee keer op dezelfde printer in de wachtrij gezet. Een
//   herafdruk van een ondertekend ticket MOET via een nieuw copy-event (FAQ Q503, EVT-12) en
//   krijgt dus vanzelf een nieuwe sleutel.
// - Fiscale afdrukken gaan naar een kassaprinter, keuken-/barbonnen naar een keuken-/barprinter.
// - PRT-03: een afdruk met QR (kasticket N, kopie ervan) kan niet naar een printer die enkel
//   tekst krijgt. Star CloudPRNT krijgt in PRINT-1 text/plain (geen QR mogelijk); het kasticket
//   gaat dan digitaal of via een ESC/POS-printer. StarPRNT-bytes met QR = vervolgbatch.
import { renderEscPos, toBase64 } from './escpos';
import type { PaperWidth } from './layout';
import { renderText } from './text';
import { PrintRefusedError, type TicketDoc, type TicketKind } from './types';

export type PrinterKind = 'receipt' | 'kitchen' | 'bar';
export type PrinterProtocol = 'star_cloudprnt' | 'epson_sdp' | 'escpos_lan';

export interface PrinterConfig {
  id: string;
  kind: PrinterKind;
  protocol: PrinterProtocol;
  widthChars: PaperWidth;
  isActive?: boolean;
}

export interface PrintJobInsert {
  printer_id: string;
  kind: TicketKind;
  payload_text: string;
  payload_escpos: string | null;
  dedupe_key: string;
}

const KITCHEN_KINDS: TicketKind[] = ['keuken', 'bar'];

/** Kan dit protocol een QR-code op papier zetten met wat PRINT-1 aanmaakt? */
export function protocolPrintsQr(p: PrinterProtocol): boolean {
  return p === 'escpos_lan' || p === 'epson_sdp';
}

export function dedupeKey(doc: TicketDoc, printerId: string): string {
  if (!doc.fdmRef) throw new PrintRefusedError('PRT-09', 'afdruk zonder ondertekend event');
  const r = doc.fdmRef;
  return `${r.fdmId}:${r.eventLabel}${r.eventCounter}/${r.totalCounter}:${doc.kind}:${printerId}`;
}

export function buildPrintJob(doc: TicketDoc, printer: PrinterConfig): PrintJobInsert {
  if (printer.isActive === false) throw new Error(`printer ${printer.id} staat uit`);
  const kitchenDoc = KITCHEN_KINDS.includes(doc.kind);
  if (kitchenDoc && printer.kind === 'receipt') throw new Error('keuken-/barbon hoort op een keuken- of barprinter');
  if (!kitchenDoc && printer.kind !== 'receipt') throw new Error(`${doc.kind} hoort op een kassaprinter`);
  const hasQr = doc.blocks.some((b) => b.t === 'qr');
  if (hasQr && !protocolPrintsQr(printer.protocol)) {
    throw new PrintRefusedError('PRT-03', `${printer.protocol} kan in deze versie geen QR afdrukken: kasticket digitaal uitreiken of naar een ESC/POS-printer sturen`);
  }
  return {
    printer_id: printer.id,
    kind: doc.kind,
    payload_text: renderText(doc, printer.widthChars),
    payload_escpos: protocolPrintsQr(printer.protocol) ? toBase64(renderEscPos(doc, printer.widthChars)) : null,
    dedupe_key: dedupeKey(doc, printer.id),
  };
}
