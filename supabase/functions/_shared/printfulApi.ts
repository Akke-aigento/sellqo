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