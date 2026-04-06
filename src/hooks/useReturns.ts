import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export type ReturnStatus = 'registered' | 'in_transit' | 'received' | 'approved' | 'rejected' | 'exchanged' | 'repaired' | 'refunded';
export type RefundStatus = 'pending' | 'completed' | 'failed' | 'not_applicable';
export type ReturnSource = 'manual' | 'bolcom' | 'amazon';

export interface ReturnItem {
  product_id: string;
  product_name?: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  price?: number;
}

export interface ReturnRecord {
  id: string;
  tenant_id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: ReturnStatus;
  source: string | null;
  return_reason: string | null;
  return_reason_code: string | null;
  refund_method: string | null;
  refund_status: string | null;
  refund_amount: number | null;
  refund_notes: string | null;
  stripe_refund_id: string | null;
  items: ReturnItem[] | null;
  internal_notes: string | null;
  handling_result: string | null;
  marketplace_return_id: string | null;
  marketplace_order_id: string | null;
  marketplace_connection_id: string | null;
  registration_date: string | null;
  created_at: string;
  updated_at: string;
  orders?: {
    order_number: string;
    total_amount: number;
    stripe_payment_intent_id?: string;
    marketplace_source?: string;
  } | null;
}

export interface ReturnFilters {
  status?: ReturnStatus;
  source?: ReturnSource;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useReturns(filters?: ReturnFilters) {
  const { currentTenant } = useTenant();

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['returns', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('returns')
        .select('*, orders!returns_order_id_fkey(order_number, total_amount, stripe_payment_intent_id, marketplace_source)')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.source) {
        query = query.eq('source', filters.source);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      if (filters?.search) {
        query = query.or(`customer_name.ilike.%${filters.search}%,marketplace_order_id.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ReturnRecord[];
    },
    enabled: !!currentTenant?.id,
  });

  return { returns, isLoading };
}

export function useReturn(id: string | undefined) {
  const { currentTenant } = useTenant();

  const { data: returnRecord, isLoading, error } = useQuery({
    queryKey: ['return', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('returns')
        .select('*, orders!returns_order_id_fkey(order_number, total_amount, stripe_payment_intent_id, marketplace_source)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as ReturnRecord;
    },
    enabled: !!id && !!currentTenant?.id,
  });

  return { returnRecord, isLoading, error };
}

export function useReturnMutations() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  const createReturn = useMutation({
    mutationFn: async (data: {
      order_id: string;
      customer_id?: string;
      customer_name?: string;
      items: ReturnItem[];
      return_reason?: string;
      return_reason_code?: string;
      refund_amount?: number;
      refund_method?: string;
      internal_notes?: string;
    }) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data: result, error } = await supabase
        .from('returns')
        .insert({
          tenant_id: currentTenant.id,
          order_id: data.order_id,
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          items: data.items as any,
          return_reason: data.return_reason,
          return_reason_code: data.return_reason_code,
          refund_amount: data.refund_amount,
          refund_method: data.refund_method || 'manual',
          refund_status: 'pending',
          internal_notes: data.internal_notes,
          source: 'manual',
          status: 'registered',
          registration_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success('Retour aangemaakt');
    },
    onError: (error) => {
      toast.error('Fout bij aanmaken retour: ' + error.message);
    },
  });

  const updateReturnStatus = useMutation({
    mutationFn: async ({ returnId, status }: { returnId: string; status: ReturnStatus }) => {
      const { error } = await supabase
        .from('returns')
        .update({ status })
        .eq('id', returnId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['return'] });
      toast.success('Retourstatus bijgewerkt');
    },
    onError: (error) => {
      toast.error('Fout bij bijwerken status: ' + error.message);
    },
  });

  const updateReturnNotes = useMutation({
    mutationFn: async ({ returnId, notes }: { returnId: string; notes: string }) => {
      const { error } = await supabase
        .from('returns')
        .update({ internal_notes: notes })
        .eq('id', returnId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return'] });
      toast.success('Notities opgeslagen');
    },
  });

  const processRefund = useMutation({
    mutationFn: async ({ returnId }: { returnId: string }) => {
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: { return_id: returnId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['return'] });
      toast.success(data?.message || 'Terugbetaling verwerkt');
    },
    onError: (error) => {
      toast.error('Fout bij terugbetaling: ' + error.message);
    },
  });

  return { createReturn, updateReturnStatus, updateReturnNotes, processRefund };
}
