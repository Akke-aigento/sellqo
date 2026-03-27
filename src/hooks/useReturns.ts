import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface ReturnRecord {
  id: string;
  tenant_id: string;
  order_id: string | null;
  customer_id: string | null;
  marketplace_connection_id: string | null;
  marketplace_return_id: string | null;
  status: string;
  return_reason: string | null;
  customer_name: string | null;
  items: any;
  source: string | null;
  refund_amount: number | null;
  refund_status: string | null;
  refund_method: string | null;
  stripe_refund_id: string | null;
  registration_date: string | null;
  created_at: string;
  updated_at: string;
  internal_notes: string | null;
  refund_notes: string | null;
  // Joined
  order?: {
    order_number: string;
    total: number;
    customer_email: string;
    customer_id: string | null;
  } | null;
  customer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export function useReturns() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['returns', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          order:orders (order_number, total, customer_email)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as unknown as ReturnRecord[];
    },
    enabled: !!currentTenant?.id,
  });

  return { returns, isLoading };
}

export function useOrderReturns(orderId: string | undefined) {
  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['order-returns', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('returns')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as ReturnRecord[];
    },
    enabled: !!orderId,
  });

  return { returns, isLoading };
}

export function useUpdateReturnStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      returnId: string;
      status?: string;
      internal_notes?: string;
      refund_status?: string;
    }) => {
      const { returnId, ...updates } = params;
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.internal_notes !== undefined) updatePayload.internal_notes = updates.internal_notes;
      if (updates.refund_status !== undefined) updatePayload.refund_status = updates.refund_status;

      const { data, error } = await supabase
        .from('returns')
        .update(updatePayload)
        .eq('id', returnId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['order-returns'] });
      toast.success('Retour bijgewerkt');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Fout bij bijwerken retour');
    },
  });
}

export function useProcessRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      orderId: string;
      items: Array<{ product_id: string | null; product_name: string; quantity: number; unit_price: number }>;
      reason: string;
      refundAmount: number;
      restockItems: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('process-order-refund', {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['order-returns'] });

      if (data.refund_method === 'stripe') {
        toast.success(`Terugbetaling van €${data.amount_refunded.toFixed(2)} verwerkt via Stripe`);
      } else if (data.refund_status === 'failed') {
        toast.warning('Stripe terugbetaling mislukt — handmatige actie vereist');
      } else {
        toast.success('Retour geregistreerd — handmatige terugbetaling vereist');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Fout bij verwerken retour');
    },
  });
}
