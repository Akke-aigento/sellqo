import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { generateTrackingUrl, getCarrierById } from '@/lib/carrierPatterns';

export interface UpdateTrackingInput {
  orderId: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  notifyCustomer?: boolean;
  customerEmail?: string;
  customerName?: string;
  orderNumber?: string;
}

export interface ShippingNotificationInput {
  orderId: string;
  customerEmail: string;
  customerName?: string;
  orderNumber: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
}

export function useOrderShipping() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateTracking = useMutation({
    mutationFn: async ({
      orderId,
      carrier,
      trackingNumber,
      trackingUrl,
      notifyCustomer,
      customerEmail,
      customerName,
      orderNumber,
    }: UpdateTrackingInput) => {
      // Generate tracking URL if not provided
      const finalTrackingUrl = trackingUrl || generateTrackingUrl(carrier, trackingNumber) || '';

      // Update the order with tracking info
      const { error } = await supabase
        .from('orders')
        .update({
          carrier,
          tracking_number: trackingNumber,
          tracking_url: finalTrackingUrl,
          shipped_at: new Date().toISOString(),
          status: 'shipped',
          fulfillment_status: 'shipped',
        })
        .eq('id', orderId);

      if (error) throw error;

      // Send notification if requested
      if (notifyCustomer && customerEmail && currentTenant?.id) {
        const carrierInfo = getCarrierById(carrier);
        const carrierName = carrierInfo?.name || carrier;

        const bodyHtml = `
          <p>Goed nieuws! Je bestelling <strong>${orderNumber}</strong> is verzonden.</p>
          
          <table style="margin: 24px 0; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #6b7280;">Carrier:</td>
              <td style="padding: 8px 0; font-weight: 500;">${carrierName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #6b7280;">Tracknummer:</td>
              <td style="padding: 8px 0; font-weight: 500;">${trackingNumber}</td>
            </tr>
          </table>
          
          ${finalTrackingUrl ? `
            <p>
              <a href="${finalTrackingUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                📦 Volg je pakket
              </a>
            </p>
          ` : ''}
          
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            Je ontvangt automatisch updates over de status van je zending.
          </p>
        `;

        const { error: messageError } = await supabase.functions.invoke('send-customer-message', {
          body: {
            tenant_id: currentTenant.id,
            customer_email: customerEmail,
            customer_name: customerName,
            subject: `Je bestelling ${orderNumber} is onderweg! 📦`,
            body_html: bodyHtml,
            body_text: `Goed nieuws! Je bestelling ${orderNumber} is verzonden via ${carrierName}. Tracknummer: ${trackingNumber}. Volg je pakket: ${finalTrackingUrl}`,
            context_type: 'order',
            order_id: orderId,
            context_data: {
              order_number: orderNumber,
              carrier: carrierName,
              tracking_number: trackingNumber,
              tracking_url: finalTrackingUrl,
            },
          },
        });

        if (messageError) {
          console.error('Failed to send tracking notification:', messageError);
          // Don't throw - tracking was still updated
        }
      }

      return { orderId, carrier, trackingNumber, trackingUrl: finalTrackingUrl };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      toast({
        title: 'Tracking opgeslagen',
        description: variables.notifyCustomer 
          ? 'De klant is per email geïnformeerd.'
          : 'Tracking informatie is bijgewerkt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij opslaan',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const clearTracking = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({
          carrier: null,
          tracking_number: null,
          tracking_url: null,
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      toast({
        title: 'Tracking verwijderd',
        description: 'De tracking informatie is verwijderd.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    updateTracking,
    clearTracking,
    generateTrackingUrl,
    isUpdating: updateTracking.isPending,
    isClearing: clearTracking.isPending,
  };
}
