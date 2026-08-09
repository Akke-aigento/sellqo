import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PrintfulConnectionStatus {
  configured: boolean;
  store_id: string | null;
  connected_store_name: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
}

// Mirrors useOdooConnection's invoke(): supabase.functions.invoke hides the
// readable server message on non-2xx, so we unwrap it ourselves.
async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let serverMsg: string | null = null;
    try {
      const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string } | null>; response?: Response } }).context;
      if (ctx?.json) {
        serverMsg = (await ctx.json())?.error ?? null;
      } else if (ctx?.response) {
        const txt = await ctx.response.clone().text();
        try { serverMsg = (JSON.parse(txt) as { error?: string })?.error ?? null; }
        catch { serverMsg = txt || null; }
      }
    } catch { /* fall back on error.message */ }
    throw new Error(serverMsg || error.message || 'Aanroep mislukt');
  }
  const payload = data as ({ success?: boolean; error?: string } & T) | null;
  if (!payload || payload.success === false) throw new Error(payload?.error || 'Onbekende fout');
  return payload as T;
}

export function usePrintfulConnection(tenantId: string | undefined) {
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ['printful-connection-status', tenantId],
    enabled: !!tenantId,
    queryFn: () => invoke<PrintfulConnectionStatus>('test-printful-connection', { action: 'status', tenantId }),
  });

  // Pre-save test: the token is sent once and never stored client-side.
  const test = useMutation({
    mutationFn: (payload: { token?: string; storeId?: string }) =>
      invoke<{ ok: boolean; error?: string | null; store_name?: string | null }>('test-printful-connection', {
        tenantId,
        ...(payload.token ? { token: payload.token } : {}),
        ...(payload.storeId ? { storeId: payload.storeId } : {}),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['printful-connection-status', tenantId] });
      if (res.ok) toast.success(`Verbinding OK${res.store_name ? ` · ${res.store_name}` : ''}`);
      else toast.error(res.error || 'Verbinding mislukt');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const save = useMutation({
    mutationFn: (payload: { token: string; storeId?: string }) =>
      invoke<{ ok: boolean; store_name?: string | null }>('save-printful-credentials', { tenantId, ...payload }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['printful-connection-status', tenantId] });
      qc.invalidateQueries({ queryKey: ['tenant_printful_settings', tenantId] });
      toast.success(`Printful verbonden${res.store_name ? ` · ${res.store_name}` : ''}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnect = useMutation({
    mutationFn: () => invoke<{ ok: boolean }>('disconnect-printful', { tenantId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printful-connection-status', tenantId] });
      qc.invalidateQueries({ queryKey: ['tenant_printful_settings', tenantId] });
      toast.success('Printful-verbinding verbroken');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { status, test, save, disconnect };
}