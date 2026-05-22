/**
 * Peppol Participant / EndpointID scheme identifiers.
 *
 * Maps an ISO-2 country code to the preferred Peppol scheme + the value
 * extraction strategy for a customer / supplier party.
 *
 * References:
 * - Peppol Policy for use of Identifiers v4.x (PEPPOL-EDN-Policy-for-use-of-Identifiers)
 * - https://docs.peppol.eu/poacc/billing/3.0/codelist/eas/
 */

export interface PartyIdentity {
  /** Company registration number / KBO / KvK / national reg-id. */
  registrationNumber?: string | null;
  /** Full VAT number incl. country prefix, e.g. "BE1017500207". */
  vatNumber?: string | null;
  /** ISO-2 country code, e.g. "BE", "NL", "DE". */
  country?: string | null;
}

export interface PeppolEndpoint {
  schemeId: string;        // e.g. "0208"
  value: string;           // e.g. "1017500207"
}

/**
 * Preferred EAS scheme per country.
 * Falls back to scheme 9925 (VAT identifier) when no national registry is configured.
 */
const COUNTRY_PREFERRED_SCHEME: Record<string, { scheme: string; source: 'registration' | 'vat' }> = {
  // Belgium — KBO/CBE
  BE: { scheme: '0208', source: 'registration' },
  // Netherlands — KvK
  NL: { scheme: '0106', source: 'registration' },
  // Luxembourg — uses VAT
  LU: { scheme: '9938', source: 'vat' },
  // Germany — Leitweg-ID is B2G only; for B2B use VAT scheme 9930
  DE: { scheme: '9930', source: 'vat' },
  // France — SIRET when available, else VAT
  FR: { scheme: '0009', source: 'registration' },
  // Italy — Codice Destinatario; we fall back to VAT for simplicity
  IT: { scheme: '0211', source: 'vat' },
  // Spain — VAT-based
  ES: { scheme: '9920', source: 'vat' },
  // Austria
  AT: { scheme: '9915', source: 'vat' },
  // Sweden — Organisation number
  SE: { scheme: '0007', source: 'registration' },
  // Denmark — CVR
  DK: { scheme: '0184', source: 'registration' },
  // Finland — OVT
  FI: { scheme: '0037', source: 'registration' },
  // Ireland
  IE: { scheme: '9935', source: 'vat' },
  // Poland
  PL: { scheme: '9945', source: 'vat' },
  // Portugal
  PT: { scheme: '9946', source: 'vat' },
};

/**
 * Resolve the EndpointID for a party.
 *
 * - For BE: schemeID 0208 + KBO digits (without "BE" prefix).
 * - For NL: schemeID 0106 + KvK digits.
 * - For other EU countries: prefer national registration scheme, else fall back to
 *   scheme 9925 (EU VAT identifier) using the full VAT number incl. country prefix.
 *
 * Throws when neither a VAT number nor a registration number is available.
 */
export function resolveEndpointId(p: PartyIdentity): PeppolEndpoint {
  const country = (p.country ?? '').toUpperCase();
  const vat = (p.vatNumber ?? '').replace(/\s+/g, '').toUpperCase();
  const reg = (p.registrationNumber ?? '').replace(/\s+/g, '');

  const pref = COUNTRY_PREFERRED_SCHEME[country];

  if (pref?.source === 'registration' && reg) {
    return { schemeId: pref.scheme, value: reg };
  }
  if (pref?.source === 'vat' && vat) {
    return { schemeId: pref.scheme, value: vat };
  }

  // Generic EU VAT fallback (scheme 9925).
  if (vat) {
    return { schemeId: '9925', value: vat };
  }
  if (reg) {
    // Last-resort: national reg without a recognised scheme — use 9925 with a
    // VAT-style synthetic value is invalid; better to error.
    throw new Error(`Cannot resolve Peppol EndpointID — no VAT number and no scheme for country "${country}".`);
  }
  throw new Error('Cannot resolve Peppol EndpointID — party has no VAT or registration number.');
}

/**
 * Strip the ISO country prefix from a VAT number.
 * "BE1017500207" → "1017500207"; "NL123456789B01" → "123456789B01".
 */
export function stripVatCountry(vatNumber: string): string {
  const v = vatNumber.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}/.test(v) ? v.slice(2) : v;
}

/** Country code from a VAT number, e.g. "BE1017500207" → "BE". */
export function vatCountryCode(vatNumber: string): string {
  const v = vatNumber.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}/.test(v) ? v.slice(0, 2) : '';
}