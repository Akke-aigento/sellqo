import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

interface StripeReader {
  id: string;
  object: string;
  device_type: string;
  label: string;
  location: string | null;
  serial_number: string;
  status: string;
}

interface StripeLocation {
  id: string;
  display_name: string;
  address: {
    city: string;
    country: string;
    line1: string;
    line2: string | null;
    postal_code: string;
    state: string | null;
  };
}

export function useStripeTerminal() {
  const { currentTenant } = useTenant();
  const [isProcessing, setIsProcessing] = useState(false);
  const [readers, setReaders] = useState<StripeReader[]>([]);
  const [locations, setLocations] = useState<StripeLocation[]>([]);

  const createPaymentIntent = useCallback(async (
    amount: number,
    terminalId: string,
    metadata?: Record<string, string>
  ) => {
    if (!currentTenant?.id) {
      throw new Error('Geen tenant gevonden');
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-create-payment-intent', {
        body: {
          amount,
          currency: 'eur',
          terminal_id: terminalId,
          tenant_id: currentTenant.id,
          metadata,
        },
      });

      if (error) throw error;
      return data;
    } finally {
      setIsProcessing(false);
    }
  }, [currentTenant?.id]);

  const processPayment = useCallback(async (
    paymentIntentId: string,
    readerId?: string
  ) => {
    if (!currentTenant?.id) {
      throw new Error('Geen tenant gevonden');
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-process-payment', {
        body: {
          payment_intent_id: paymentIntentId,
          reader_id: readerId,
          tenant_id: currentTenant.id,
        },
      });

      if (error) throw error;
      return data;
    } finally {
      setIsProcessing(false);
    }
  }, [currentTenant?.id]);

  const listReaders = useCallback(async () => {
    if (!currentTenant?.id) return [];

    try {
      const { data, error } = await supabase.functions.invoke('pos-manage-reader', {
        body: {
          action: 'list_readers',
          tenant_id: currentTenant.id,
        },
      });

      if (error) throw error;
      setReaders(data.readers || []);
      return data.readers || [];
    } catch (error: unknown) {
      console.error('Error listing readers:', error);
      toast.error('Kon readers niet ophalen');
      return [];
    }
  }, [currentTenant?.id]);

  const registerReader = useCallback(async (
    registrationCode: string,
    label: string,
    locationId?: string
  ) => {
    if (!currentTenant?.id) {
      throw new Error('Geen tenant gevonden');
    }

    try {
      const { data, error } = await supabase.functions.invoke('pos-manage-reader', {
        body: {
          action: 'register_reader',
          tenant_id: currentTenant.id,
          registration_code: registrationCode,
          label,
          location_id: locationId,
        },
      });

      if (error) throw error;
      toast.success('Reader succesvol geregistreerd');
      await listReaders();
      return data.reader;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kon reader niet registreren';
      toast.error(message);
      throw error;
    }
  }, [currentTenant?.id, listReaders]);

  const deleteReader = useCallback(async (readerId: string) => {
    if (!currentTenant?.id) {
      throw new Error('Geen tenant gevonden');
    }

    try {
      const { data, error } = await supabase.functions.invoke('pos-manage-reader', {
        body: {
          action: 'delete_reader',
          tenant_id: currentTenant.id,
          reader_id: readerId,
        },
      });

      if (error) throw error;
      toast.success('Reader verwijderd');
      await listReaders();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kon reader niet verwijderen';
      toast.error(message);
      throw error;
    }
  }, [currentTenant?.id, listReaders]);

  const cancelReaderAction = useCallback(async (readerId: string) => {
    if (!currentTenant?.id) {
      throw new Error('Geen tenant gevonden');
    }

    try {
      const { data, error } = await supabase.functions.invoke('pos-manage-reader', {
        body: {
          action: 'cancel_action',
          tenant_id: currentTenant.id,
          reader_id: readerId,
        },
      });

      if (error) throw error;
      return data.reader;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Kon actie niet annuleren';
      toast.error(message);
      throw error;
    }
  }, [currentTenant?.id]);

  const listLocations = useCallback(async () => {
    if (!currentTenant?.id) return [];

    try {
      const { data, error } = await supabase.functions.invoke('pos-manage-reader', {
        body: {
          action: 'list_locations',
          tenant_id: currentTenant.id,
        },
      });

      if (error) throw error;
      setLocations(data.locations || []);
      return data.locations || [];
    } catch (error: unknown) {
      console.error('Error listing locations:', error);
      return [];
    }
  }, [currentTenant?.id]);

  return {
    isProcessing,
    readers,
    locations,
    createPaymentIntent,
    processPayment,
    listReaders,
    registerReader,
    deleteReader,
    cancelReaderAction,
    listLocations,
  };
}
