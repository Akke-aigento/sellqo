import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OdooConnectionStatus {
  configured: boolean;
  odoo_url: string | null;
  odoo_db: string | null;
  odoo_login: string | null;
  has_key: boolean;
  connected_version: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
}

export interface OdooJournal {
  id: number;
  name: string;
  code: string;
  claimed_by_other_tenant: boolean;
}

// Shared response handler: on non-2xx, supabase.functions.invoke returns a
// FunctionsHttpError whose readable body we must extract ourselves — otherwise
// the UI shows a generic "non-2xx status code" toast and swallows the Dutch
// server message. We also honour the success:false envelope on 2xx bodies.
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-odoo-connection', { body });
  if (error) {
    let serverMsg: string | null = null;
    try {
      const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string } | null>; response?: Response } }).context;
      if (ctx?.json) {
        const parsed = await ctx.json();
        serverMsg = parsed?.error ?? null;
      } else if (ctx?.response) {
        const txt = await ctx.response.clone().text();
        try { serverMsg = (JSON.parse(txt) as { error?: string })?.error ?? null; }
        catch { serverMsg = txt || null; }
      }
    } catch { /* ignore parse issues, val terug op error.message */ }
    throw new Error(serverMsg || error.message || 'Aanroep mislukt');
  }
  const payload = data as ({ success?: boolean; error?: string } & T) | null;
  if (!payload || payload.success === false) throw new Error(payload?.error || 'Onbekende fout');
  return payload as T;
}

export function useOdooConnection(tenantId: string | undefined) {
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ['odoo-connection-status', tenantId],
    enabled: !!tenantId,
    queryFn: () => invoke<OdooConnectionStatus>({ action: 'status', tenantId }),
  });

  const save = useMutation({
    mutationFn: (payload: { odoo_url: string; odoo_db: string; odoo_login: string; odoo_api_key?: string }) =>
      invoke<{ ok: boolean; version?: string }>({ action: 'save', tenantId, ...payload }),
    onSuccess: (res) => {
      // Only celebrate on an explicit ok:true from the backend.
      if (!res?.ok) {
        toast.error('Onbekende fout bij opslaan.');
        return;
      }
      qc.invalidateQueries({ queryKey: ['odoo-connection-status', tenantId] });
      qc.invalidateQueries({ queryKey: ['odoo-journals', tenantId] });
      toast.success(`Verbinding opgeslagen (Odoo ${res.version ?? ''})`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const test = useMutation({
    mutationFn: () => invoke<{ ok: boolean; version?: string; error?: string }>({ action: 'test', tenantId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['odoo-connection-status', tenantId] });
      if (res?.ok) toast.success(`Verbinding OK (Odoo ${res.version ?? ''})`);
      else toast.error(res?.error || 'Verbinding mislukt');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const journals = useQuery({
    queryKey: ['odoo-journals', tenantId],
    enabled: !!tenantId && !!status.data?.configured,
    queryFn: () => invoke<{ journals: OdooJournal[] }>({ action: 'journals', tenantId }).then(r => r.journals),
  });

  return { status, save, test, journals };
}