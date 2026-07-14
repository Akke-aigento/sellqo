// Minimal stateless JSON-RPC helper for Odoo Online.
export interface OdooEnv {
  url: string;
  db: string;
  login: string;
  apiKey: string;
}

export function normalizeOdooUrl(url: string): string {
  let n = url.trim().replace(/\/+$/, '');
  if (!n.startsWith('http')) n = `https://${n}`;
  return n;
}

// Strict URL guard for user-supplied Odoo endpoints. https-only, hostname required, no IP literals.
// Throws with a Dutch error message when invalid — used at 'save'.
export function assertValidOdooUrl(raw: string): string {
  const normalized = normalizeOdooUrl(raw);
  let u: URL;
  try { u = new URL(normalized); } catch { throw new Error('Ongeldige Odoo-URL.'); }
  if (u.protocol !== 'https:') throw new Error('Odoo-URL moet met https:// beginnen.');
  const host = u.hostname;
  if (!host || !host.includes('.')) throw new Error('Odoo-URL moet een geldige hostnaam bevatten.');
  // IPv4 literal check
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) throw new Error('IP-adressen zijn niet toegestaan voor Odoo-URL.');
  // IPv6 literal check (brackets)
  if (host.startsWith('[') || host.includes(':')) throw new Error('IP-adressen zijn niet toegestaan voor Odoo-URL.');
  return normalized;
}

export async function odooRpc(env: OdooEnv, service: string, method: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(`${env.url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { service, method, args },
      id: Date.now() + Math.floor(Math.random() * 1000),
    }),
  });
  const data = await res.json() as { result?: unknown; error?: { data?: { message?: string }; message?: string } };
  if (data.error) throw new Error(data.error.data?.message || data.error.message || 'Odoo RPC error');
  return data.result;
}

export async function odooAuthenticate(env: OdooEnv): Promise<number> {
  const uid = await odooRpc(env, 'common', 'authenticate', [env.db, env.login, env.apiKey, {}]) as number | false;
  if (!uid || typeof uid !== 'number') throw new Error('Odoo-authenticatie mislukt (controleer database, login en API-key).');
  return uid;
}

export async function odooVersion(env: OdooEnv): Promise<{ server_version?: string; server_serie?: string; server_version_info?: number[] }> {
  return await odooRpc(env, 'common', 'version', []) as { server_version?: string; server_serie?: string; server_version_info?: number[] };
}

export function odooExecKw(env: OdooEnv, uid: number, model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) {
  return odooRpc(env, 'object', 'execute_kw', [env.db, uid, env.apiKey, model, method, args, kwargs]);
}