import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { generateTrackingUrl, getCarrierById } from '@/lib/carrierPatterns';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';

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
    }: UpdateTrackingInput) => {
      // Generate tracking URL if not provided
      const finalTrackingUrl = trackingUrl || generateTrackingUrl(carrier, trackingNumber) || '';

      if (!currentTenant?.id) throw new Error('Geen tenant context');

      // Status + tracking velden via gevalideerde edge function (RBAC + transitiematrix).
      await invokeWithErrorBody('update-order-fulfillment-status', {
        body: {
          tenant_id: currentTenant.id,
          order_id: orderId,
          new_status: 'shipped',
          tracking_number: trackingNumber,
          tracking_url: finalTrackingUrl,
        },
      }, 'Tracking update mislukt');

      // carrier + fulfillment_status zitten (nog) niet in de whitelist — losse update.
      const { error: extrasError } = await supabase
        .from('orders')
        .update({
          carrier,
          fulfillment_status: 'shipped',
        })
        .eq('id', orderId);
      if (extrasError) throw extrasError;

      // SHIP-MAIL-1: de verzendmail wordt op de server opgebouwd, in de taal van de klant
      // en in de huisstijl van de winkel (send-order-shipped). Eén mail per tracknummer.
      if (notifyCustomer && customerEmail) {
        const carrierName = getCarrierById(carrier)?.name || carrier;
        const { error: messageError } = await supabase.functions.invoke('send-order-shipped', {
          body: {
            order_id: orderId,
            source: 'manual',
            carrier_name: carrierName,
            tracking_number: trackingNumber,
            tracking_url: finalTrackingUrl || null,
          },
        });
        if (messageError) {
          console.error('Failed to send tracking notification:', messageError);
          // Niet gooien: de tracking zelf is wel opgeslagen.
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
