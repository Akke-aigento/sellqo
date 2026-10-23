// KASSA-0 — identificatievelden en hun validatie (ID-01..ID-10, USR-02).
import type { IdentificationInput, Language, TicketMedium } from './types';

const TZ = 'Europe/Brussels';

function mod97Check(body: bigint): number {
  return 97 - Number(body % 97n);
}

/** Btw-nummer: BE + 10 cijfers, eerste 0 of 1, controle mod 97 (ID-10). */
export function isValidVatNo(v: string): boolean {
  const m = /^BE([01]\d{9})$/.exec(v);
  if (!m) return false;
  const d = m[1];
  return mod97Check(BigInt(d.slice(0, 8))) === Number(d.slice(8));
}

/** Vestigingsnummer: 10 cijfers, start 2–8, controle mod 97 (ID-10). */
export function isValidEstNo(v: string): boolean {
  if (!/^[2-8]\d{9}$/.test(v)) return false;
  return mod97Check(BigInt(v.slice(0, 8))) === Number(v.slice(8));
}

/**
 * INSZ / rijksregisternummer: 11 cijfers, controle = 97 − (eerste 9 mod 97); voor wie in of
 * na 2000 geboren is staat er een 2 vóór de 9 cijfers. Systeemgebruikers 00000000097
 * (technicus) en 00000000029 (robot) volgen dezelfde regel (USR-03).
 */
export function isValidInsz(v: string): boolean {
  if (!/^\d{11}$/.test(v)) return false;
  const body = v.slice(0, 9);
  const check = Number(v.slice(9));
  return mod97Check(BigInt(body)) === check || mod97Check(BigInt('2' + body)) === check;
}

export const TECHNICIAN_EMPLOYEE_ID = '00000000097';
export const ROBOT_EMPLOYEE_ID = '00000000029';

/** posId: 14 tekens, hoofdletters/cijfers (ID-03). */
export function isValidPosId(v: string): boolean {
  return /^[A-Z0-9]{14}$/.test(v);
}

export const MAX_TICKET_NO = 999_999_999;
/** Volgend posFiscalTicketNo: 1..999999999, daarna opnieuw 1 (ID-04). */
export function nextTicketNo(current: number | null | undefined): number {
  if (!current || current >= MAX_TICKET_NO) return 1;
  return current + 1;
}

function partsIn(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(date)) p[x.type] = x.value;
  return p;
}

/** Brusselse lokale tijd in RFC 3339 met milliseconden en offset (ID-08), bv. 2024-07-29T13:00:00.000+02:00. */
export function posDateTime(date: Date = new Date()): string {
  const p = partsIn(date, TZ);
  const localAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offsetMin = Math.round((localAsUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const oh = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
  const om = String(Math.abs(offsetMin) % 60).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${ms}${sign}${oh}:${om}`;
}

/**
 * Bedrijfsdag (bookingDate, ID-09): vóór het afkappunt (standaard 05:00 Brusselse tijd) hoort
 * een event nog bij de vorige dag — een café dat om 02:00 sluit, boekt op de avond ervoor.
 */
export function bookingDateFor(date: Date, cutoffHour = 5): string {
  const shifted = new Date(date.getTime());
  const p = partsIn(date, TZ);
  if (+p.hour < cutoffHour) shifted.setTime(date.getTime() - 24 * 3600 * 1000);
  const q = partsIn(shifted, TZ);
  return `${q.year}-${q.month}-${q.day}`;
}

/** GUID in kleine letters (bookingPeriodId, ID-09). */
export function isLowerGuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
}

/** Vaste gegevens van één kassa (posId + terminal + toestel). */
export interface PosContext {
  language: Language;
  vatNo: string;
  estNo: string;
  posId: string;
  posSwVersion: string;
  terminalId: string;
  deviceId: string;
}

/** Per event wisselende gegevens. */
export interface EventMeta {
  posFiscalTicketNo: number;
  posDateTime: string;
  bookingPeriodId: string;
  bookingDate: string;
  ticketMedium: TicketMedium;
  employeeId: string;
}

export function identification(ctx: PosContext, meta: EventMeta): IdentificationInput {
  return {
    language: ctx.language,
    vatNo: ctx.vatNo,
    estNo: ctx.estNo,
    posId: ctx.posId,
    posFiscalTicketNo: meta.posFiscalTicketNo,
    posDateTime: meta.posDateTime,
    posSwVersion: ctx.posSwVersion,
    terminalId: ctx.terminalId,
    deviceId: ctx.deviceId,
    bookingPeriodId: meta.bookingPeriodId,
    bookingDate: meta.bookingDate,
    ticketMedium: meta.ticketMedium,
    employeeId: meta.employeeId,
  };
}

/** Problemen met de identificatievelden; leeg = in orde. */
export function checkIdentification(d: IdentificationInput): string[] {
  const e: string[] = [];
  if (!['EN', 'NL', 'FR', 'DE'].includes(d.language)) e.push('language');
  if (!isValidVatNo(d.vatNo)) e.push('vatNo');
  if (!isValidEstNo(d.estNo)) e.push('estNo');
  if (!isValidPosId(d.posId)) e.push('posId');
  if (!Number.isInteger(d.posFiscalTicketNo) || d.posFiscalTicketNo < 1 || d.posFiscalTicketNo > MAX_TICKET_NO) e.push('posFiscalTicketNo');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?[+-]\d{2}:\d{2}$/.test(d.posDateTime)) e.push('posDateTime');
  if (!d.posSwVersion || d.posSwVersion.length > 36) e.push('posSwVersion');
  if (!d.terminalId) e.push('terminalId');
  if (!d.deviceId) e.push('deviceId');
  if (!isLowerGuid(d.bookingPeriodId)) e.push('bookingPeriodId');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.bookingDate)) e.push('bookingDate');
  if (!isValidInsz(d.employeeId)) e.push('employeeId');
  return e;
}
