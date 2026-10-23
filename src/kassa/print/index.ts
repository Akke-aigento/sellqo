// PRINT-1 — publieke ingang van de printlaag van SellQo Kassa.
export * from './types';
export {
  buildKasticket, buildRefundTicket, buildVoorrekening, buildBestelbon, buildTrainingTicket, buildCopyTicket,
  buildKitchenTicket, buildReport, buildTicketFor, isRefund, isSimulated, requireSigned, type KitchenOptions,
} from './ticketModel';
export { layout, PAPER_WIDTHS, type PaperWidth, type Line } from './layout';
export { renderText, type TextOptions } from './text';
export { renderEscPos, encodeCp858, decodeCp858, escposQr, toBase64, type EscPosOptions } from './escpos';
export { renderHtml } from './html';
export { qrMatrix, qrSvg } from './qr';
export { TICKET_STRINGS, strings, type TicketStrings } from './i18n';
export { buildPrintJob, dedupeKey, protocolPrintsQr, type PrinterConfig, type PrinterKind, type PrinterProtocol, type PrintJobInsert } from './queue';
