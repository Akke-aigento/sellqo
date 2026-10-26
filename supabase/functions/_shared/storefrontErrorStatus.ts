// EVENT-409-1 — HTTP-status voor een fout die storefront-api opgooit.
//
// cartAddItem gooit een gekende weigering als `new Error(JSON.stringify({ code, ... }))`.
// De vangst in storefront-api gaf daar altijd 500 op, ook bij "event volzet": een
// verwachte weigering leek zo een serverstoring. Voor precies twee codes wordt de
// status nu 409 (Conflict). De body blijft byte-gelijk: enkel de status verandert.
//
// Bewust NIET hier: checkout_complete. Die geeft EVENT_FULL/TICKET_TYPE_FULL in de
// data terug ({ success:true, data:{ success:false, error } }, HTTP 200), en de
// Fonske-frontend en sellqo-storefront tonen die melding enkel omdat de status 200 is.

export const CONFLICT_CODES: ReadonlySet<string> = new Set(['EVENT_FULL', 'TICKET_TYPE_FULL']);

/** De `code` uit een opgegooide JSON-foutboodschap, of null als het geen JSON met code is. */
export function storefrontErrorCode(message: unknown): string | null {
  if (typeof message !== 'string' || !message.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(message) as { code?: unknown };
    return typeof parsed?.code === 'string' ? parsed.code : null;
  } catch {
    return null;
  }
}

/** 409 voor EVENT_FULL en TICKET_TYPE_FULL, anders 500 (zoals voorheen). */
export function statusForStorefrontError(message: unknown): number {
  const code = storefrontErrorCode(message);
  return code !== null && CONFLICT_CODES.has(code) ? 409 : 500;
}
