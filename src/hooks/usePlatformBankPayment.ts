import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateBankPaymentParams {
  tenantId: string;
  paymentType: 'ai_credits' | 'addon';
  amount: number;
  // For AI credits
  creditsAmount?: number;
  packageId?: string;
  // For add-ons
  addonType?: string;
}

interface BankPaymentResult {
  ogmReference: string;
  paymentId: string;
}

export function usePlatformBankPayment() {
  const [isLoading, setIsLoading] = useState(false);

  const createBankPayment = async (params: CreateBankPaymentParams): Promise<BankPaymentResult | null> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-platform-bank-payment', {
        body: params,
      });

      if (error) throw error;

      if (data?.ogmReference && data?.paymentId) {
        return {
          ogmReference: data.ogmReference,
          paymentId: data.paymentId,
        };
      }

      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Bank payment creation error:', error);
      toast.error('Kon betaling niet aanmaken', {
        description: error instanceof Error ? error.message : 'Probeer het opnieuw',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createBankPayment,
    isLoading,
  };
}
