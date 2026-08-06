import { supabase } from '@/integrations/supabase/client';

/**
 * Wrapper rond supabase.functions.invoke die bij non-2xx responses de
 * JSON-body uitleest en de daarin gevatte `error`-string als Error-message
 * teruggeeft. Zonder deze helper krijgt de UI alleen de generieke
 * "Edge Function returned a non-2xx status code" boodschap.
 *
 * Gebruik:
 *   const data = await invokeWithErrorBody<{ success: boolean }>('fn-name', { body });
 */
export async function invokeWithErrorBody<T = unknown>(
  fnName: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
  fallbackMessage = 'Edge function aanroep mislukt',
): Promise<T> {
  let response: Awaited<ReturnType<typeof supabase.functions.invoke>>;
  try {
    response = await supabase.functions.invoke(fnName, options as never);
  } catch (err) {
    // UX-POLISH-1 — netwerk-level fout (failed fetch / TypeError) markeren.
    throw markNetworkError(
      new Error(err instanceof Error ? err.message : fallbackMessage),
    );
  }

  if (response.error) {
    let serverError: string | null = null;
    try {
      // FunctionsHttpError biedt context.response (Response object) of context.json()
      const ctx = (response.error as unknown as {
        context?: {
          json?: () => Promise<{ error?: string } | null>;
          response?: Response;
        };
      }).context;
      if (ctx?.json) {
        const parsed = await ctx.json();
        serverError = parsed?.error ?? null;
      } else if (ctx?.response) {
        const txt = await ctx.response.clone().text();
        try {
          const parsed = JSON.parse(txt) as { error?: string };
          serverError = parsed?.error ?? null;
        } catch {
          serverError = txt || null;
        }
      }
    } catch {
      // ignore parse failures, val terug op generieke message
    }
    const error = new Error(serverError || response.error.message || fallbackMessage);
    // Geen JSON-body van de functie zelf => hapering op netwerkniveau.
    if (!serverError && isFetchLevelError(response.error)) markNetworkError(error);
    throw error;
  }

  const data = response.data as (T & { success?: boolean; error?: string }) | null;
  if (data && data.success === false) {
    throw new Error(data.error || fallbackMessage);
  }

  return data as T;
}

/** UX-POLISH-1 — vlag voor netwerk-level fouten (geen nette functie-fout). */
export function markNetworkError(error: Error): Error {
  (error as Error & { isNetworkError?: boolean }).isNetworkError = true;
  return error;
}

export function isNetworkError(error: unknown): boolean {
  return !!(error as { isNetworkError?: boolean } | null)?.isNetworkError;
}

function isFetchLevelError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? '';
  const message = (error as { message?: string } | null)?.message ?? '';
  return (
    name === 'FunctionsFetchError' ||
    name === 'TypeError' ||
    /failed to (send|fetch)/i.test(message) ||
    /networkerror|load failed/i.test(message)
  );
}

/**
 * UX-POLISH-1 — één stille retry na ~1,5s bij een netwerk-level fout.
 * Nette JSON-fouten (400/403/409 met error-body) worden direct doorgegeven.
 */
export async function invokeWithNetworkRetry<T = unknown>(
  fnName: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
  fallbackMessage?: string,
): Promise<T> {
  try {
    return await invokeWithErrorBody<T>(fnName, options, fallbackMessage);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return await invokeWithErrorBody<T>(fnName, options, fallbackMessage);
  }
}