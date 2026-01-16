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

      if (error) throw error;

      if (data.url) {
        // Redirect to Stripe onboarding
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating Stripe account:', error);
      toast({
        title: 'Fout bij activeren',
        description: 'Kon betalingen niet activeren. Probeer het opnieuw.',
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
