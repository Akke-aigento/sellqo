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

/**
 * Custom error class for slug conflicts with structured data
 */
export class SlugConflictError extends Error {
  readonly originalSlug: string;
  readonly suggestedSlug: string;
  
  constructor(originalSlug: string, suggestedSlug: string, message?: string) {
    super(message || `Slug '${originalSlug}' is already taken`);
    this.name = 'SlugConflictError';
    this.originalSlug = originalSlug;
    this.suggestedSlug = suggestedSlug;
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

  // Handle slug conflict (409) with structured error
  if (res.status === 409) {
    try {
      const body = await res.json();
      if (body.error === 'slug_conflict' && body.suggested_slug) {
        console.log('[createTenantViaFunction] Slug conflict detected:', body);
        throw new SlugConflictError(
          body.original_slug || payload.slug as string || '',
          body.suggested_slug,
          body.message || `Slug is already taken`
        );
      }
    } catch (parseError) {
      // If it's already a SlugConflictError, re-throw it
      if (parseError instanceof SlugConflictError) {
        throw parseError;
      }
      // Otherwise fall through to generic error handling
    }
    const body = await readTextSafe(res);
    throw new Error(`create-tenant function failed (409): ${body || res.statusText}`);
  }

  if (!res.ok) {
    const body = await readTextSafe(res);
    throw new Error(`create-tenant function failed (${res.status}): ${body || res.statusText}`);
  }

  const json = (await res.json()) as unknown;
  return json as T;
}
