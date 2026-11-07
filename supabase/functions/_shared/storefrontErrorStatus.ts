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

// FIXES-0711 — nooit een ruwe Stripe-fout naar de gast.
//
// Een Stripe-fout (bv. "The provided key 'sk_live_***' does not have access to account
// 'acct_…'") belandde via de algemene vangst letterlijk als `error` bij de gast. De foutvorm
// blijft dezelfde ({ success:false, error:<string> }, zelfde HTTP-status); enkel de tekst wordt
// een gecodeerde JSON-fout zoals de andere weigeringen: { code:'ONLINE_PAY_UNAVAILABLE', message }.
// De echte fout blijft in console.error (functielogs).

export const ONLINE_PAY_UNAVAILABLE = 'ONLINE_PAY_UNAVAILABLE';

/** Acties aan tafel: de gast kan dan altijd aan de bediening de rekening vragen. */
const TABLE_ACTIONS: ReadonlySet<string> = new Set([
  'table_check_pay', 'table_check_pay_status', 'table_check_pay_cancel', 'checkout_table', 'table_group_place',
]);

export function onlinePayUnavailable(action: string): { code: string; message: string } {
  return {
    code: ONLINE_PAY_UNAVAILABLE,
    message: TABLE_ACTIONS.has(action)
      ? 'Online betalen lukt nu niet. Vraag de rekening aan de bediening.'
      : 'Online betalen lukt nu niet. Probeer het later opnieuw of kies een andere betaalwijze.',
  };
}

/** Fout uit de Stripe-SDK (StripeAuthenticationError, StripePermissionError, …). */
export function isStripeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { type?: unknown; raw?: unknown; statusCode?: unknown; name?: unknown };
  if (typeof e.type === 'string' && e.type.startsWith('Stripe')) return true;
  if (typeof e.name === 'string' && e.name.startsWith('Stripe')) return true;
  return e.raw !== undefined && typeof e.statusCode === 'number';
}

// Sleutels en account-ID's horen nooit in een antwoord, ook niet in een fout van elders.
const SECRET_RE = /\b(?:sk|rk|pk)_(?:live|test)_|\bwhsec_|\bacct_[A-Za-z0-9]{6,}/;

/**
 * De foutboodschap die naar de client mag: Stripe-fouten en lekkende sleutels worden ONLINE_PAY_UNAVAILABLE.
 * Anders komt `message` ongewijzigd terug (ook als het geen string is: zelfde body als voorheen).
 */
export function publicStorefrontError(action: string, error: unknown, message: unknown): unknown {
  if (isStripeError(error) || (typeof message === 'string' && SECRET_RE.test(message))) return JSON.stringify(onlinePayUnavailable(action));
  return message;
}
