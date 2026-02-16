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

      // Start a transaction-like operation:
      // 1. Update order payment status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          payment_status: 'paid',
          status: 'processing', // Also update order status if it was pending
        })
        .eq('id', orderId)
        .eq('payment_status', 'pending'); // Only update if still pending

      if (orderError) {
        throw new Error(`Fout bij bijwerken order: ${orderError.message}`);
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
