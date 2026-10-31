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

export class PrintfulActionError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'PrintfulActionError';
  }
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

  // PRINTFUL-AUTO-2: één aanroeper voor doorsturen en annuleren. De fout draagt de
  // servercode mee (bv. 'mixed_order'), zodat de kaart de juiste vervolgstap kan tonen.
  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('forward-printful-order', {
      body: { tenantId, orderId, ...body },
    });
    if (error) {
      let server: { error?: string; code?: string } | null = null;
      try {
        const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string; code?: string } | null> } }).context;
        if (ctx?.json) server = await ctx.json();
      } catch { /* ignore */ }
      throw new PrintfulActionError(server?.error || error.message || t('admin.printful.toast.forward_failed'), server?.code);
    }
    const payload = data as { success?: boolean; error?: string; code?: string; printful_order_id?: number | null; status?: string };
    if (!payload?.success) throw new PrintfulActionError(payload?.error || t('admin.printful.toast.forward_failed'), payload?.code);
    return payload;
  };

  const forward = useMutation({
    mutationFn: async (opts?: { confirm?: boolean; partial?: boolean }) =>
      call({ ...(opts?.confirm ? { confirm: true } : {}), ...(opts?.partial ? { partial: true } : {}) }),
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
      // Een gemengde bestelling krijgt een eigen vervolgstap op de kaart, geen losse toast.
      if (err instanceof PrintfulActionError && err.code === 'mixed_order') return;
      toast.error(err.message);
    },
  });

  const cancel = useMutation({
    mutationFn: async () => call({ action: 'cancel' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printful-order-link', tenantId, orderId] });
      toast.success(t('admin.printful.toast.order_canceled'));
    },
    onError: (err: Error) => {
      qc.invalidateQueries({ queryKey: ['printful-order-link', tenantId, orderId] });
      toast.error(err.message);
    },
  });

  return { link: link.data ?? null, isLoading: link.isLoading, forward, cancel };
}
