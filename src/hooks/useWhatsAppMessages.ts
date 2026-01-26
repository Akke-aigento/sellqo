import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

interface SendWhatsAppMessageInput {
  customer_id?: string;
  to_phone: string;
  template_type: string;
  template_name?: string;
  template_variables?: Record<string, string>;
  order_id?: string;
  quote_id?: string;
}

export function useWhatsAppMessages() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendMessage = useMutation({
    mutationFn: async (input: SendWhatsAppMessageInput) => {
      if (!currentTenant?.id) {
        throw new Error('No tenant selected');
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          tenant_id: currentTenant.id,
          ...input,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-messages'] });
      toast({
        title: 'WhatsApp verzonden',
        description: 'Het bericht is succesvol verzonden.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Verzenden mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const sendOrderConfirmation = async (orderId: string, customerPhone: string, variables: Record<string, string>) => {
    return sendMessage.mutateAsync({
      order_id: orderId,
      to_phone: customerPhone,
      template_type: 'order_confirmation',
      template_variables: variables,
    });
  };

  const sendShippingUpdate = async (orderId: string, customerPhone: string, variables: Record<string, string>) => {
    return sendMessage.mutateAsync({
      order_id: orderId,
      to_phone: customerPhone,
      template_type: 'shipping_update',
      template_variables: variables,
    });
  };

  const sendDeliveryConfirmation = async (orderId: string, customerPhone: string, variables: Record<string, string>) => {
    return sendMessage.mutateAsync({
      order_id: orderId,
      to_phone: customerPhone,
      template_type: 'delivery_confirmation',
      template_variables: variables,
    });
  };

  const sendAbandonedCartReminder = async (customerId: string, customerPhone: string, variables: Record<string, string>) => {
    return sendMessage.mutateAsync({
      customer_id: customerId,
      to_phone: customerPhone,
      template_type: 'abandoned_cart',
      template_variables: variables,
    });
  };

  return {
    sendMessage,
    sendOrderConfirmation,
    sendShippingUpdate,
    sendDeliveryConfirmation,
    sendAbandonedCartReminder,
    isSending: sendMessage.isPending,
  };
}
