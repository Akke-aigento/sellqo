import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export interface InvoiceDuplicate {
  id: string;
  invoice_id: string;
  tenant_id: string;
  generated_at: string;
  generated_by: string | null;
  reason: string;
  sent_to_email: string | null;
}

export function useInvoiceDuplicates(invoiceId?: string) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['invoice-duplicates', invoiceId],
    queryFn: async () => {
      if (!invoiceId || !tenantId) return [];

      const { data, error } = await supabase
        .from('invoice_duplicates')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('tenant_id', tenantId)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      return data as InvoiceDuplicate[];
    },
    enabled: !!invoiceId && !!tenantId,
  });
}

export function useCreateInvoiceDuplicate() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      reason = 'customer_request',
      sentToEmail,
    }: {
      invoiceId: string;
      reason?: string;
      sentToEmail?: string;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('invoice_duplicates')
        .insert({
          invoice_id: invoiceId,
          tenant_id: currentTenant.id,
          generated_by: user?.id || null,
          reason,
          sent_to_email: sentToEmail || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-duplicates', variables.invoiceId] });
      toast({ title: 'Duplicaat geregistreerd' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}
