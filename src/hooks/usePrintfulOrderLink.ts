import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface PrintfulOrderLink {
  id: string;
  tenant_id: string;
  order_id: string;
  printful_order_id: number | null;
  external_id: string;
  status: string;
  last_error: string | null;
  forwarded_at: string | null;
  confirmed_at: string | null;
}

export function usePrintfulOrderLink(tenantId: string | undefined, orderId: string | undefined) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const link = useQuery({
    queryKey: ['printful-order-link', tenantId, orderId],
    enabled: !!tenantId && !!orderId,
    queryFn: async (): Promise<PrintfulOrderLink | null> => {
      const { data, error } = await supabase
        .from('printful_order_links')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('order_id', orderId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PrintfulOrderLink) ?? null;
    },
  });

  const forward = useMutation({
    mutationFn: async (opts?: { confirm?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('forward-printful-order', {
        body: { tenantId, orderId, ...(opts?.confirm ? { confirm: true } : {}) },
      });
      if (error) {
        let serverMsg: string | null = null;
        try {
          const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string } | null> } }).context;
          if (ctx?.json) serverMsg = (await ctx.json())?.error ?? null;
        } catch { /* ignore */ }
        throw new Error(serverMsg || error.message || t('admin.printful.toast.forward_failed'));
      }
      const payload = data as { success?: boolean; error?: string; printful_order_id?: number | null; status?: string };
      if (!payload?.success) throw new Error(payload?.error || t('admin.printful.toast.forward_failed'));
      return payload;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['printful-order-link', tenantId, orderId] });
      toast.success(
        res.status === 'confirmed'
          ? `${t('admin.printful.toast.order_confirmed')}${res.printful_order_id ? ` (#${res.printful_order_id})` : ''}`
          : `${t('admin.printful.toast.order_draft')}${res.printful_order_id ? ` (#${res.printful_order_id})` : ''}`,
      );
    },
    onError: (err: Error) => {
      qc.invalidateQueries({ queryKey: ['printful-order-link', tenantId, orderId] });
      toast.error(err.message);
    },
  });

  return { link: link.data ?? null, isLoading: link.isLoading, forward };
}
