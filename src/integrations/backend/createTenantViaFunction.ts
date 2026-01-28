/**
 * Final fallback for tenant creation.
 * Calls a backend function that validates the user's JWT and performs an admin insert.
 * This avoids edge cases where PostgREST doesn't receive/accept the Authorization header.
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

export async function createTenantViaFunction<T>(
  accessToken: string,
  payload: Record<string, unknown>
): Promise<T> {
  assertEnv();
  if (!accessToken) throw new Error('Missing access token');

  const url = `${SUPABASE_URL}/functions/v1/create-tenant`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await readTextSafe(res);
    throw new Error(`create-tenant function failed (${res.status}): ${body || res.statusText}`);
  }

  const json = (await res.json()) as unknown;
  return json as T;
}
