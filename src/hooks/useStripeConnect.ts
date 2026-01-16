import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ConnectStatus {
  configured: boolean;
  account_id?: string;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
  };
}

export function useStripeConnect(tenantId: string | undefined) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const { toast } = useToast();

  const checkStatus = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-connect-status', {
        body: { tenant_id: tenantId },
      });

      if (error) throw error;
      setStatus(data);
    } catch (error) {
      console.error('Error checking Stripe status:', error);
      toast({
        title: 'Fout bij ophalen status',
        description: 'Kon de betalingsstatus niet ophalen.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, toast]);

  const createConnectAccount = useCallback(async () => {
    if (!tenantId) return;
    
    setIsCreatingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        body: { tenant_id: tenantId },
      });

      if (error) {
        // Try to extract the actual error message from the response
        let errorMessage = 'Kon betalingen niet activeren. Probeer het opnieuw.';
        try {
          // FunctionsHttpError has context with the response body
          if (error.context?.body) {
            const body = typeof error.context.body === 'string' 
              ? JSON.parse(error.context.body) 
              : error.context.body;
            if (body?.error) {
              errorMessage = body.error;
            }
          } else if (error.message) {
            // Try to parse error message if it's JSON
            try {
              const parsed = JSON.parse(error.message);
              if (parsed?.error) {
                errorMessage = parsed.error;
              }
            } catch {
              // If not JSON, use the message directly if it's meaningful
              if (error.message && !error.message.includes('FunctionsHttpError')) {
                errorMessage = error.message;
              }
            }
          }
        } catch {
          // Keep default error message
        }
        
        toast({
          title: 'Fout bij activeren',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      if (data.url) {
        // Open Stripe onboarding in new tab
        window.open(data.url, '_blank');
        toast({
          title: 'Stripe onboarding geopend',
          description: 'Rond de onboarding af in het nieuwe tabblad en klik daarna op "Status vernieuwen".',
        });
      }
    } catch (error: any) {
      console.error('Error creating Stripe account:', error);
      toast({
        title: 'Fout bij activeren',
        description: error?.message || 'Kon betalingen niet activeren. Probeer het opnieuw.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingAccount(false);
    }
  }, [tenantId, toast]);

  const getStatusText = useCallback(() => {
    if (!status) return 'Laden...';
    if (!status.configured) return 'Niet geconfigureerd';
    if (!status.onboarding_complete) return 'Onboarding niet afgerond';
    if (!status.charges_enabled) return 'Betalingen niet actief';
    if (!status.payouts_enabled) return 'Uitbetalingen niet actief';
    return 'Actief';
  }, [status]);

  const getStatusColor = useCallback(() => {
    if (!status) return 'bg-muted';
    if (!status.configured) return 'bg-muted';
    if (!status.onboarding_complete) return 'bg-yellow-500';
    if (!status.charges_enabled) return 'bg-yellow-500';
    if (status.charges_enabled && status.payouts_enabled) return 'bg-green-500';
    return 'bg-yellow-500';
  }, [status]);

  return {
    status,
    isLoading,
    isCreatingAccount,
    checkStatus,
    createConnectAccount,
    getStatusText,
    getStatusColor,
  };
}
