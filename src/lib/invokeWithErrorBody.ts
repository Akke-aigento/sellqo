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
  const response = await supabase.functions.invoke(fnName, options as never);

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
    throw new Error(serverError || response.error.message || fallbackMessage);
  }

  const data = response.data as (T & { success?: boolean; error?: string }) | null;
  if (data && data.success === false) {
    throw new Error(data.error || fallbackMessage);
  }

  return data as T;
}