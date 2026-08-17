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

/**
 * VIES-FIX — userError-classificatie.
 * VIES antwoordt met HTTP 200 + isValid:false ook wanneer de lidstaat-service
 * de call weigerde (MS_MAX_CONCURRENT_REQ e.d.). Alleen VALID en INVALID zijn
 * definitieve uitkomsten; al het andere is tijdelijke onbeschikbaarheid en mag
 * NOOIT als ongeldig nummer gelogd of gecachet worden.
 */
const DEFINITIVE_USER_ERRORS = ['VALID', 'INVALID'] as const;

function classify(data: ViesRawResponse): ViesResult {
  const userError = (data.userError || '').toUpperCase();

  // Achterwaartse compatibiliteit: geen userError → gedraag als voorheen.
  if (!userError) {
    return {
      valid: !!data.isValid,
      company_name: data.name || null,
      address: data.address || null,
      request_identifier: data.requestIdentifier || null,
      request_date: data.requestDate || null,
    };
  }

  if (userError === 'VALID') {
    return {
      valid: true,
      company_name: data.name || null,
      address: data.address || null,
      request_identifier: data.requestIdentifier || null,
      request_date: data.requestDate || null,
    };
  }

  if (userError === 'INVALID') {
    return {
      valid: false,
      company_name: null,
      address: null,
      request_identifier: data.requestIdentifier || null,
      request_date: data.requestDate || null,
    };
  }

  if (userError === 'INVALID_INPUT') {
    // Format/landcode-fout: herproberen helpt niet, maar niet cachen als "false".
    return {
      valid: false, company_name: null, address: null, request_identifier: null,
      error: 'Ongeldig BTW-nummer formaat',
    };
  }

  // MS_MAX_CONCURRENT_REQ, GLOBAL_MAX_CONCURRENT_REQ, MS_UNAVAILABLE,
  // SERVICE_UNAVAILABLE, TIMEOUT of onbekend → tijdelijk onbeschikbaar.
  return {
    valid: false, company_name: null, address: null, request_identifier: null,
    error: 'VIES tijdelijk niet beschikbaar. Probeer later opnieuw.',
    service_unavailable: true,
  };
}

function isDefinitive(data: ViesRawResponse): boolean {
  const userError = (data.userError || '').toUpperCase();
  if (!userError) return true;
  if (userError === 'INVALID_INPUT') return true;
  return (DEFINITIVE_USER_ERRORS as readonly string[]).includes(userError);
}

async function callViesOnce(countryCode: string, number: string): Promise<ViesResult | ViesRawResponse> {
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
  viesLog('VIES response received', { isValid: data.isValid, userError: data.userError, hasName: !!data.name });
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callVies(countryCode: string, number: string): Promise<ViesResult> {
  const backoffs = [400, 1000];
  let last: ViesResult | null = null;

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    const res = await callViesOnce(countryCode, number);

    // HTTP-level uitkomst (al een ViesResult): direct teruggeven.
    if ('valid' in res) {
      if (!res.service_unavailable) return res;
      last = res;
    } else {
      if (isDefinitive(res)) return classify(res);
      last = classify(res);
      viesLog('Temporary VIES userError, retrying', { userError: res.userError, attempt });
    }

    if (attempt < backoffs.length) await sleep(backoffs[attempt]);
  }

  return last ?? {
    valid: false, company_name: null, address: null, request_identifier: null,
    error: 'VIES tijdelijk niet beschikbaar. Probeer later opnieuw.',
    service_unavailable: true,
  };
}