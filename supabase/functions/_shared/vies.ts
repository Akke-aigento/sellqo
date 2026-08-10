/**
 * Shared VIES (EU VAT) validation core.
 * Extracted from validate-vat/index.ts (B2B-1) so both the admin function and
 * the public storefront-api checkout action reuse identical logic.
 */

export const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES',
  'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI', // EL = Greece, XI = Northern Ireland
] as const;

export interface ViesRawResponse {
  isValid: boolean;
  requestDate: string;
  userError?: string;
  name?: string;
  address?: string;
  requestIdentifier?: string;
  vatNumber?: string;
}

export interface ViesResult {
  valid: boolean;
  company_name: string | null;
  address: string | null;
  request_identifier: string | null;
  request_date?: string | null;
  /** Set when VIES could not validate (bad format / service down). */
  error?: string;
  service_unavailable?: boolean;
}

export function cleanVatNumber(raw: string): string {
  return String(raw).replace(/[\s.-]/g, '').toUpperCase();
}

export function parseVatCountry(clean: string): { countryCode: string; number: string } {
  return { countryCode: clean.substring(0, 2), number: clean.substring(2) };
}

export function isEuCountry(code: string): boolean {
  return (EU_COUNTRIES as readonly string[]).includes(code);
}

export function viesLog(step: string, details?: Record<string, unknown>) {
  console.log(`[VIES] ${step}`, details ? JSON.stringify(details) : '');
}

export async function callVies(countryCode: string, number: string): Promise<ViesResult> {
  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${number}`;
  viesLog('Calling VIES API', { url });

  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });

  if (!response.ok) {
    viesLog('VIES API error', { status: response.status });

    if (response.status === 400) {
      return {
        valid: false, company_name: null, address: null, request_identifier: null,
        error: 'Ongeldig BTW-nummer formaat',
      };
    }
    if (response.status === 503) {
      return {
        valid: false, company_name: null, address: null, request_identifier: null,
        error: 'VIES service tijdelijk niet beschikbaar. Probeer later opnieuw.',
        service_unavailable: true,
      };
    }
    throw new Error(`VIES API returned status ${response.status}`);
  }

  const data: ViesRawResponse = await response.json();
  viesLog('VIES response received', { isValid: data.isValid, hasName: !!data.name });

  return {
    valid: !!data.isValid,
    company_name: data.name || null,
    address: data.address || null,
    request_identifier: data.requestIdentifier || null,
    request_date: data.requestDate || null,
  };
}