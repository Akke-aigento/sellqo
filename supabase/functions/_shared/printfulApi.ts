// Shared Printful API helpers. The token is never logged and never returned.

export interface PrintfulTestResult {
  ok: boolean;
  error?: string;
  storeName?: string;
}

export async function testPrintfulToken(token: string, storeId?: string | null): Promise<PrintfulTestResult> {
  if (!token || token.trim().length < 10) {
    return { ok: false, error: 'Printful private token is verplicht' };
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token.trim()}` };
  if (storeId && storeId.trim()) headers['X-PF-Store-Id'] = storeId.trim();

  let res: Response;
  try {
    res = await fetch('https://api.printful.com/stores', { method: 'GET', headers });
  } catch (_err) {
    return { ok: false, error: 'Kan geen verbinding maken met Printful' };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: 'Token is ongeldig of verlopen' };
  }
  if (!res.ok) {
    return { ok: false, error: `Printful gaf een fout terug (status ${res.status})` };
  }

  let body: { result?: Array<{ id?: number; name?: string }> } | null = null;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: 'Onverwacht antwoord van Printful' };
  }

  const stores = Array.isArray(body?.result) ? body!.result! : [];
  if (stores.length === 0) {
    return { ok: false, error: 'Geen Printful-winkel gevonden voor dit token' };
  }
  return { ok: true, storeName: stores[0]?.name ?? undefined };
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const PRINTFUL_WEBHOOK_TYPES = [
  'package_shipped',
  'order_canceled',
  'order_failed',
  'order_refunded',
  'order_put_hold',
  'order_remove_hold',
] as const;

function pfHeaders(token: string, storeId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.trim()}`,
    'Content-Type': 'application/json',
  };
  if (storeId && storeId.trim()) headers['X-PF-Store-Id'] = storeId.trim();
  return headers;
}

// Printful allows exactly one webhook URL per store, so POST overwrites any
// previously registered URL. Never logs the token or the secret.
export async function registerPrintfulWebhook(
  token: string,
  url: string,
  storeId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.printful.com/webhooks', {
      method: 'POST',
      headers: pfHeaders(token, storeId),
      body: JSON.stringify({ url, types: [...PRINTFUL_WEBHOOK_TYPES] }),
    });
    if (!res.ok) return { ok: false, error: `Printful webhook-registratie mislukte (status ${res.status})` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Kan geen verbinding maken met Printful voor webhook-registratie' };
  }
}

export async function deletePrintfulWebhook(
  token: string,
  storeId?: string | null,
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch('https://api.printful.com/webhooks', {
      method: 'DELETE',
      headers: pfHeaders(token, storeId),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}