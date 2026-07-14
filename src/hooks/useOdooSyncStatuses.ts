import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type OdooSyncRow = {
  invoice_id: string | null;
  credit_note_id: string | null;
  document_type: 'invoice' | 'credit_note';
  sync_status: 'pending' | 'synced' | 'failed' | string;
  odoo_move_id: string | null;
  error_message: string | null;
  peppol_status: string | null;
  peppol_note: string | null;
  synced_at: string | null;
};

export function useOdooSyncStatuses(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['odoo_sync_statuses', tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ invoices: Map<string, OdooSyncRow>; creditNotes: Map<string, OdooSyncRow> }> => {
      const { data, error } = await supabase
        .from('odoo_invoice_sync_log')
        .select('invoice_id, credit_note_id, document_type, sync_status, odoo_move_id, error_message, peppol_status, peppol_note, synced_at')
        .eq('tenant_id', tenantId!)
        .order('synced_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const invoices = new Map<string, OdooSyncRow>();
      const creditNotes = new Map<string, OdooSyncRow>();
      for (const row of (data || []) as OdooSyncRow[]) {
        if (row.document_type === 'invoice' && row.invoice_id && !invoices.has(row.invoice_id)) {
          invoices.set(row.invoice_id, row);
        }
        if (row.document_type === 'credit_note' && row.credit_note_id && !creditNotes.has(row.credit_note_id)) {
          creditNotes.set(row.credit_note_id, row);
        }
      }
      return { invoices, creditNotes };
    },
  });
}