import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export type ReturnStatus =
  | 'registered' | 'requested' | 'approved' | 'shipped_by_customer'
  | 'in_transit' | 'received' | 'inspecting' | 'awaiting_refund'
  | 'completed' | 'rejected' | 'exchanged' | 'repaired' | 'refunded' | 'cancelled'
  | 'label_sent' | 'shipped' | 'inspected' | 'closed';

export type RefundStatusEnum =
  | 'pending' | 'approved_for_refund' | 'initiated' | 'completed'
  | 'failed' | 'denied' | 'not_applicable';

export type ReturnSource = 'manual' | 'bolcom' | 'amazon';

export interface ReturnItemInput {
  order_item_id?: string;
  product_id?: string;
  variant_id?: string;
  product_name: string;
  variant_title?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  reason_code: string;
  reason_notes?: string;
  condition?: string;
  restock?: boolean;
  restocking_fee?: number;
  refund_amount: number;
}

export interface ReturnItemRecord {
  id: string;
  return_id: string;
  order_item_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  reason_code: string;
  reason_notes: string | null;
  condition: string | null;
  restock: boolean | null;
  restocking_fee: number | null;
  refund_amount: number;
  received_quantity: number | null;
  inspection_notes: string | null;
  inspected_at: string | null;
  inspected_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface StatusHistoryRecord {
  id: string;
  return_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  notes: string | null;
  flow_type: string | null;
  created_at: string | null;
}

export interface ReturnRecord {
  id: string;
  tenant_id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: ReturnStatus;
  source: string | null;
  rma_number: string | null;
  return_reason: string | null;
  return_reason_code: string | null;
  refund_method: string | null;
  refund_status: RefundStatusEnum | null;
  refund_amount: number | null;
  refund_notes: string | null;
  stripe_refund_id: string | null;
  subtotal: number | null;
  restocking_fees_total: number | null;
  shipping_refund: number | null;
  items: any[] | null;
  internal_notes: string | null;
  handling_result: string | null;
  marketplace_return_id: string | null;
  marketplace_order_id: string | null;
  marketplace_connection_id: string | null;
  registration_date: string | null;
  expected_arrival_date: string | null;
  received_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  refund_approved_at: string | null;
  refund_approved_by: string | null;
  refund_initiated_at: string | null;
  refund_initiated_by: string | null;
  refund_completed_at: string | null;
  refund_failed_at: string | null;
  refund_failure_reason: string | null;
  label_url: string | null;
  label_tracking_number: string | null;
  label_carrier: string | null;
  label_sent_at: string | null;
  created_at: string;
  updated_at: string;
  orders?: {
    order_number: string;
    total: number;
    stripe_payment_intent_id?: string;
    marketplace_source?: string;
    shipping_cost?: number;
  } | null;
}

export interface ReturnFilters {
  status?: ReturnStatus;
  refundStatus?: RefundStatusEnum;
  source?: ReturnSource;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ==================== QUERIES ====================

export function useReturns(filters?: ReturnFilters) {
  const { currentTenant } = useTenant();

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['returns', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('returns')
        .select('*, orders!returns_order_id_fkey(order_number, total, stripe_payment_intent_id, marketplace_source, shipping_cost)')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.refundStatus) query = query.eq('refund_status', filters.refundStatus);
      if (filters?.source) query = query.eq('source', filters.source);
      if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('created_at', filters.dateTo);
      if (filters?.search) {
        query = query.or(`customer_name.ilike.%${filters.search}%,marketplace_order_id.ilike.%${filters.search}%,rma_number.ilike.%${filters.search}%`);
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
        .select('*, orders!returns_order_id_fkey(order_number, total, stripe_payment_intent_id, marketplace_source, shipping_cost)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as ReturnRecord;
    },
    enabled: !!id && !!currentTenant?.id,
  });

  return { returnRecord, isLoading, error };
}

export function useReturnItems(returnId: string | undefined) {
  return useQuery({
    queryKey: ['return-items', returnId],
    queryFn: async () => {
      if (!returnId) return [];
      const { data, error } = await supabase
        .from('return_items')
        .select('*')
        .eq('return_id', returnId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as ReturnItemRecord[];
    },
    enabled: !!returnId,
  });
}

export function useReturnStatusHistory(returnId: string | undefined) {
  return useQuery({
    queryKey: ['return-status-history', returnId],
    queryFn: async () => {
      if (!returnId) return [];
      const { data, error } = await supabase
        .from('return_status_history')
        .select('*')
        .eq('return_id', returnId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as StatusHistoryRecord[];
    },
    enabled: !!returnId,
  });
}

// ==================== MUTATIONS ====================

export function useReturnMutations() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['returns'] });
    queryClient.invalidateQueries({ queryKey: ['return'] });
    queryClient.invalidateQueries({ queryKey: ['return-status-history'] });
    queryClient.invalidateQueries({ queryKey: ['return-items'] });
    queryClient.invalidateQueries({ queryKey: ['order-return-tag'] });
    queryClient.invalidateQueries({ queryKey: ['order-returnable'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order'] });
  };

  const createReturn = useMutation({
    mutationFn: async (data: {
      order_id: string;
      customer_id?: string;
      customer_name?: string;
      items: ReturnItemInput[];
      return_reason?: string;
      return_reason_code?: string;
      refund_amount: number;
      refund_method?: string;
      internal_notes?: string;
      subtotal?: number;
      restocking_fees_total?: number;
      shipping_refund?: number;
      expected_arrival_date?: string;
      source?: string;
      marketplace_connection_id?: string;
    }) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data: rmaNumber, error: rmaError } = await supabase
        .rpc('generate_rma_number', { _tenant_id: currentTenant.id });
      if (rmaError) throw rmaError;

      const { data: { user } } = await supabase.auth.getUser();

      const { data: returnRow, error: returnError } = await supabase
        .from('returns')
        .insert({
          tenant_id: currentTenant.id,
          order_id: data.order_id,
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          rma_number: rmaNumber,
          items: data.items as any,
          return_reason: data.return_reason,
          return_reason_code: data.return_reason_code,
          refund_amount: data.refund_amount,
          refund_method: data.refund_method || 'manual',
          refund_status: 'pending',
          internal_notes: data.internal_notes,
          source: data.source || 'manual',
          status: 'approved' as const,
          subtotal: data.subtotal,
          restocking_fees_total: data.restocking_fees_total,
          shipping_refund: data.shipping_refund,
          expected_arrival_date: data.expected_arrival_date,
          marketplace_connection_id: data.marketplace_connection_id,
          registration_date: new Date().toISOString(),
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (returnError) throw returnError;

      if (data.items.length > 0) {
        const itemRows = data.items.map((item) => ({
          return_id: returnRow.id,
          order_item_id: item.order_item_id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product_name,
          variant_title: item.variant_title,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          reason_code: item.reason_code,
          reason_notes: item.reason_notes,
          condition: item.condition,
          restock: item.restock ?? true,
          restocking_fee: item.restocking_fee ?? 0,
          refund_amount: item.refund_amount,
        }));

        const { error: itemsError } = await supabase
          .from('return_items')
          .insert(itemRows);
        if (itemsError) throw itemsError;
      }

      await supabase.from('return_status_history').insert({
        return_id: returnRow.id,
        from_status: null,
        to_status: 'approved',
        changed_by: user?.id,
        notes: 'Retour aangemaakt door admin',
        flow_type: 'logistics',
      });

      return returnRow;
    },
    onSuccess: (data) => {
      invalidateAll();
      if (data?.id) {
        fireReturnEmail(data.id, 'request_received');
        fireAdminReturnNotification(data);
      }
      toast.success('Retour aangemaakt');
    },
    onError: (error) => {
      toast.error('Fout bij aanmaken retour: ' + error.message);
    },
  });

  const updateReturnStatus = useMutation({
    mutationFn: async ({ returnId, status, notes }: { returnId: string; status: ReturnStatus; notes?: string }) => {
      const { data: current, error: fetchError } = await supabase
        .from('returns')
        .select('status')
        .eq('id', returnId)
        .single();
      if (fetchError) throw fetchError;

      const { data: { user } } = await supabase.auth.getUser();

      const updateData: any = { status };
      if (status === 'received') updateData.received_at = new Date().toISOString();
      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
      }
      if (status === 'label_sent') updateData.label_sent_at = new Date().toISOString();

      const { error } = await supabase
        .from('returns')
        .update(updateData)
        .eq('id', returnId);
      if (error) throw error;

      await supabase.from('return_status_history').insert({
        return_id: returnId,
        from_status: current.status,
        to_status: status,
        changed_by: user?.id,
        notes: notes || null,
        flow_type: 'logistics',
      });
    },
    onSuccess: (_, variables) => {
      invalidateAll();
      if (variables.status === 'approved') {
        fireReturnEmail(variables.returnId, 'approved');
      } else if (variables.status === 'received') {
        fireReturnEmail(variables.returnId, 'package_received');
      }
      toast.success('Logistieke status bijgewerkt');
    },
    onError: (error) => {
      toast.error('Fout bij bijwerken status: ' + error.message);
    },
  });

  const updateReturnRefundStatus = useMutation({
    mutationFn: async ({ returnId, refundStatus, notes, reason }: {
      returnId: string;
      refundStatus: RefundStatusEnum;
      notes?: string;
      reason?: string;
    }) => {
      const { data: current, error: fetchError } = await supabase
        .from('returns')
        .select('refund_status')
        .eq('id', returnId)
        .single();
      if (fetchError) throw fetchError;

      const { data: { user } } = await supabase.auth.getUser();

      const updateData: any = { refund_status: refundStatus };
      if (refundStatus === 'approved_for_refund') {
        updateData.refund_approved_at = new Date().toISOString();
        updateData.refund_approved_by = user?.id;
      }
      if (refundStatus === 'initiated') {
        updateData.refund_initiated_at = new Date().toISOString();
        updateData.refund_initiated_by = user?.id;
      }
      if (refundStatus === 'completed') {
        updateData.refund_completed_at = new Date().toISOString();
      }
      if (refundStatus === 'failed') {
        updateData.refund_failed_at = new Date().toISOString();
        updateData.refund_failure_reason = reason || null;
      }

      const { error } = await supabase
        .from('returns')
        .update(updateData)
        .eq('id', returnId);
      if (error) throw error;

      await supabase.from('return_status_history').insert({
        return_id: returnId,
        from_status: current.refund_status || 'pending',
        to_status: refundStatus,
        changed_by: user?.id,
        notes: notes || reason || null,
        flow_type: 'financial',
      });
    },
    onSuccess: (_, variables) => {
      invalidateAll();
      if (variables.refundStatus === 'completed') {
        fireReturnEmail(variables.returnId, 'refund_processed');
      }
      toast.success('Refund status bijgewerkt');
    },
    onError: (error) => {
      toast.error('Fout bij bijwerken refund status: ' + error.message);
    },
  });

  const closeReturn = useMutation({
    mutationFn: async ({ returnId }: { returnId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('returns')
        .update({ status: 'closed' as any })
        .eq('id', returnId);
      if (error) throw error;

      await supabase.from('return_status_history').insert({
        return_id: returnId,
        from_status: 'inspected',
        to_status: 'closed',
        changed_by: user?.id,
        notes: 'Retour gesloten',
        flow_type: 'logistics',
      });
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Retour gesloten');
    },
    onError: (error) => {
      toast.error('Fout bij sluiten retour: ' + error.message);
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

  const inspectReturnItem = useMutation({
    mutationFn: async ({ itemId, receivedQuantity, inspectionNotes }: {
      itemId: string;
      receivedQuantity: number;
      inspectionNotes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('return_items')
        .update({
          received_quantity: receivedQuantity,
          inspection_notes: inspectionNotes || null,
          inspected_at: new Date().toISOString(),
          inspected_by: user?.id,
        })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-items'] });
      toast.success('Item geïnspecteerd');
    },
    onError: (error) => {
      toast.error('Fout bij inspectie: ' + error.message);
    },
  });

  const addStatusNote = useMutation({
    mutationFn: async ({ returnId, notes, flowType = 'system' }: { returnId: string; notes: string; flowType?: string }) => {
      const { data: current } = await supabase
        .from('returns')
        .select('status')
        .eq('id', returnId)
        .single();

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('return_status_history')
        .insert({
          return_id: returnId,
          from_status: current?.status || null,
          to_status: current?.status || 'approved',
          changed_by: user?.id,
          notes,
          flow_type: flowType,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-status-history'] });
      toast.success('Notitie toegevoegd');
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
      invalidateAll();
      toast.success(data?.message || 'Terugbetaling verwerkt');
    },
    onError: (error) => {
      toast.error('Fout bij terugbetaling: ' + error.message);
    },
  });

  const fireReturnEmail = (returnId: string, event: string) => {
    supabase.functions.invoke('send-return-email', {
      body: { return_id: returnId, event },
    }).catch(err => console.warn('[return-email]', event, 'failed:', err));
  };

  const fireAdminReturnNotification = async (newReturn: any) => {
    try {
      const { data: settings } = await supabase
        .from('tenant_return_settings')
        .select('notify_admin_new_request')
        .eq('tenant_id', newReturn.tenant_id)
        .single();

      if (settings && settings.notify_admin_new_request === false) return;

      const { data: order } = await supabase
        .from('orders')
        .select('order_number, customer_name, total, currency')
        .eq('id', newReturn.order_id)
        .single();

      await supabase.functions.invoke('create-notification', {
        body: {
          tenant_id: newReturn.tenant_id,
          category: 'returns',
          type: 'return_new_request',
          title: `Nieuwe retour: ${newReturn.rma_number || 'RMA'}`,
          message: `${order?.customer_name || 'Klant'} heeft een retour aangevraagd voor order ${order?.order_number || ''}`,
          priority: 'medium',
          action_url: `/admin/returns/${newReturn.id}`,
          data: {
            return_id: newReturn.id,
            rma_number: newReturn.rma_number,
            order_id: newReturn.order_id,
            order_number: order?.order_number,
            customer_name: order?.customer_name,
            refund_amount: newReturn.refund_amount,
            currency: order?.currency || 'EUR',
          },
        },
      });
    } catch (err) {
      console.warn('[admin-return-notification] failed:', err);
    }
  };

  const executeRefund = useMutation({
    mutationFn: async ({ returnId, refundMethod }: {
      returnId: string;
      refundMethod: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch tenant's refund preference
      const { data: returnRow } = await supabase
        .from('returns')
        .select('tenant_id')
        .eq('id', returnId)
        .single();

      if (!returnRow) throw new Error('Retour niet gevonden');

      const { data: tenantSettings } = await supabase
        .from('tenant_return_settings')
        .select('default_refund_method')
        .eq('tenant_id', returnRow.tenant_id)
        .single();

      const autoStripeEnabled = tenantSettings?.default_refund_method === 'auto_stripe';

      // Non-Stripe or manual mode: just transition to 'initiated' for manual confirmation
      if (refundMethod !== 'stripe' || !autoStripeEnabled) {
        await supabase.from('returns').update({
          refund_status: 'initiated',
          refund_initiated_at: new Date().toISOString(),
          refund_initiated_by: user?.id,
        }).eq('id', returnId);

        await supabase.from('return_status_history').insert({
          return_id: returnId,
          from_status: 'approved_for_refund',
          to_status: 'initiated',
          changed_by: user?.id,
          notes: `Handmatige refund-stap gestart (${refundMethod || 'manual'})`,
          flow_type: 'financial',
        });

        return { auto: false, method: refundMethod };
      }

      // Stripe: mark initiated, then auto-execute via edge function
      await supabase.from('returns').update({
        refund_status: 'initiated',
        refund_initiated_at: new Date().toISOString(),
        refund_initiated_by: user?.id,
      }).eq('id', returnId);

      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: { return_id: returnId },
      });

      if (error) {
        // Rollback to approved_for_refund so user can retry
        await supabase.from('returns').update({
          refund_status: 'approved_for_refund',
          refund_failure_reason: error.message || 'Onbekende fout bij Stripe call',
        }).eq('id', returnId);
        throw new Error(error.message || 'Refund mislukt');
      }

      // Re-check status — process-refund might have set 'failed' internally
      const { data: updated } = await supabase
        .from('returns')
        .select('refund_status, refund_failure_reason, stripe_refund_id')
        .eq('id', returnId)
        .single();

      if (updated?.refund_status === 'failed') {
        throw new Error(updated.refund_failure_reason || 'Stripe refund mislukt');
      }

      await supabase.from('return_status_history').insert({
        return_id: returnId,
        from_status: 'initiated',
        to_status: 'completed',
        changed_by: user?.id,
        notes: `Stripe refund ${updated?.stripe_refund_id || ''} automatisch uitgevoerd`,
        flow_type: 'financial',
      });

      return { auto: true, method: 'stripe', stripeRefundId: updated?.stripe_refund_id };
    },
    onSuccess: (result, variables) => {
      invalidateAll();
      if (result.auto) {
        fireReturnEmail(variables.returnId, 'refund_processed');
        toast.success(`✓ Stripe refund uitgevoerd (${result.stripeRefundId || 'success'})`);
      } else {
        toast.success(`Refund stap geopend voor ${result.method} — bevestig na uitvoering`);
      }
    },
    onError: (error) => {
      invalidateAll();
      toast.error(`❌ Refund mislukt: ${error.message} — Probeer opnieuw of check Stripe dashboard`);
    },
  });

  return {
    createReturn,
    updateReturnStatus,
    updateReturnRefundStatus,
    closeReturn,
    updateReturnNotes,
    inspectReturnItem,
    addStatusNote,
    processRefund,
    executeRefund,
  };
}
