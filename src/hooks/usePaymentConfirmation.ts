import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PaymentMethodType } from '@/components/admin/MarkAsPaidButton';

interface ConfirmPaymentParams {
  orderId: string;
  tenantId: string;
  paymentMethod: PaymentMethodType;
  reference?: string;
  notes?: string;
}

export function usePaymentConfirmation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const confirmPayment = useMutation({
    mutationFn: async ({ orderId, tenantId, paymentMethod, reference, notes }: ConfirmPaymentParams) => {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Niet ingelogd');
      }

      // 1a. Payment status direct bijwerken (alleen indien nog pending).
      const { data: paidRows, error: orderError } = await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderId)
        .eq('payment_status', 'pending')
        .select('id, status');

      if (orderError) {
        throw new Error(`Fout bij bijwerken order: ${orderError.message}`);
      }

      // 1b. Indien betaling effectief gemarkeerd én order nog pending: status →
      //     processing via gevalideerde edge function (RBAC + transitiematrix).
      const justPaid = paidRows && paidRows.length > 0 && paidRows[0].status === 'pending';
      if (justPaid) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          'update-order-fulfillment-status',
          {
            body: {
              tenant_id: tenantId,
              order_id: orderId,
              new_status: 'processing',
            },
          },
        );
        if (fnError) {
          throw new Error(`Fout bij statusovergang: ${fnError.message}`);
        }
        if (fnData && (fnData as { success?: boolean }).success === false) {
          throw new Error(
            `Fout bij statusovergang: ${(fnData as { error?: string }).error || 'onbekend'}`,
          );
        }
      }

      // 2. Create payment confirmation audit record
      const { error: confirmError } = await supabase
        .from('payment_confirmations')
        .insert({
          order_id: orderId,
          tenant_id: tenantId,
          confirmed_by: user.id,
          payment_method: paymentMethod,
          reference: reference || null,
          notes: notes || null,
        });

      if (confirmError) {
        throw new Error(`Fout bij opslaan bevestiging: ${confirmError.message}`);
      }

      // 3. Record transaction for usage tracking
      try {
        await supabase.rpc('record_transaction', {
          p_tenant_id: tenantId,
          p_transaction_type: paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'pos_card',
          p_order_id: orderId,
        });
      } catch (txError) {
        // Non-blocking - just log
        console.warn('Failed to record transaction:', txError);
      }

      // 4. Auto-generate invoice if tenant setting is enabled
      try {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('auto_generate_invoice, auto_send_invoice_email')
          .eq('id', tenantId)
          .single();

        if (tenant?.auto_generate_invoice) {
          console.log('Auto-generating invoice for order:', orderId);
          await supabase.functions.invoke('generate-invoice', {
            body: { 
              order_id: orderId,
              auto_send_email: tenant.auto_send_invoice_email ?? false
            }
          });
        }
      } catch (invoiceError) {
        console.warn('Auto-invoice generation failed (non-blocking):', invoiceError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      toast({
        title: 'Betaling bevestigd',
        description: 'De order is gemarkeerd als betaald.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bevestigen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return { confirmPayment };
}
