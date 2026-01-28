/**
 * Minimal REST helper for critical writes where we must guarantee the Authorization header.
 * This bypasses any potential supabase-js header propagation issues.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function assertEnv() {
  if (!SUPABASE_URL) throw new Error('Missing VITE_SUPABASE_URL');
  if (!SUPABASE_PUBLISHABLE_KEY) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
}

async function readTextSafe(res: Response) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

export async function restInsertSingle<T>(
  table: string,
  accessToken: string,
  row: Record<string, unknown>
): Promise<T> {
  assertEnv();
  if (!accessToken) throw new Error('Missing access token');

  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const body = await readTextSafe(res);
    throw new Error(`REST insert failed (${res.status}): ${body || res.statusText}`);
  }

  const json = (await res.json()) as unknown;
  if (Array.isArray(json) && json.length > 0) return json[0] as T;
  // Some setups might return a single object; support that too.
  return json as T;
}
