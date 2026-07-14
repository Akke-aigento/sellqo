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

// Strict URL guard for user-supplied Odoo endpoints. Blocks SSRF-style abuse:
// https-only, domain hostname required (no IPs, no localhost, must contain a dot),
// and no path/query/fragment beyond an optional trailing slash.
// Throws a single Dutch error on any violation — used at 'save' and as defense
// in depth when reading stored credentials in the sync runner.
const INVALID_ODOO_URL = 'Ongeldige Odoo-URL: alleen https://-adressen met een domeinnaam zijn toegestaan';
export function assertValidOdooUrl(raw: string): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error(INVALID_ODOO_URL);
  // Require an explicit scheme in the input — do not silently upgrade http/missing to https.
  if (!/^https:\/\//i.test(raw.trim())) throw new Error(INVALID_ODOO_URL);
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new Error(INVALID_ODOO_URL); }
  if (u.protocol !== 'https:') throw new Error(INVALID_ODOO_URL);
  if (u.username || u.password) throw new Error(INVALID_ODOO_URL);
  if (u.search || u.hash) throw new Error(INVALID_ODOO_URL);
  if (u.pathname && u.pathname !== '' && u.pathname !== '/') throw new Error(INVALID_ODOO_URL);
  const host = u.hostname;
  if (!host) throw new Error(INVALID_ODOO_URL);
  const lowered = host.toLowerCase();
  if (lowered === 'localhost' || lowered.endsWith('.localhost')) throw new Error(INVALID_ODOO_URL);
  if (!lowered.includes('.')) throw new Error(INVALID_ODOO_URL);
  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lowered)) throw new Error(INVALID_ODOO_URL);
  // IPv6 literal (URL puts these in brackets; also reject bare colons)
  if (lowered.startsWith('[') || lowered.includes(':')) throw new Error(INVALID_ODOO_URL);
  // Normalized form: strip trailing slash so callers get a consistent value.
  return `${u.protocol}//${u.host}`;
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