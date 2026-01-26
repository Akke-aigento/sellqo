import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { Invoice, InvoiceStatus } from '@/types/invoice';

interface InvoiceFilters {
  status?: InvoiceStatus;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  peppolPending?: boolean;
}

interface InvoiceWithRelations extends Invoice {
  orders?: {
    order_number: string;
    customer_name: string | null;
    marketplace_source: string | null;
  } | null;
  customers?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export function useInvoices(filters?: InvoiceFilters) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading, error, refetch } = useQuery({
    queryKey: ['invoices', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('invoices')
        .select(`
          *,
          orders (
            order_number,
            customer_name,
            marketplace_source
          ),
          customers (
            first_name,
            last_name,
            email
          )
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(`invoice_number.ilike.%${filters.search}%`);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      if (filters?.peppolPending) {
        query = query.eq('peppol_status', 'pending');
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InvoiceWithRelations[];
    },
    enabled: !!currentTenant?.id,
  });

  const resendInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: { invoice_id: invoiceId },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Factuur opnieuw verstuurd');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: Error) => {
      toast.error('Fout bij versturen factuur', { description: error.message });
    },
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: InvoiceStatus }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Factuurstatus bijgewerkt');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: Error) => {
      toast.error('Fout bij bijwerken status', { description: error.message });
    },
  });

  const markPeppolSent = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('invoices')
        .update({
          peppol_status: 'sent',
          peppol_sent_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Peppol status bijgewerkt naar verzonden');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: Error) => {
      toast.error('Fout bij bijwerken Peppol status', { description: error.message });
    },
  });

  return {
    invoices,
    isLoading,
    error,
    refetch,
    resendInvoice,
    updateInvoiceStatus,
    markPeppolSent,
  };
}

export function useInvoice(invoiceId: string | undefined) {
  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          orders (
            order_number,
            customer_name,
            customer_email,
            marketplace_source
          ),
          customers (
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', invoiceId)
        .maybeSingle();

      if (error) throw error;
      return data as InvoiceWithRelations | null;
    },
    enabled: !!invoiceId,
  });

  return { invoice, isLoading, error };
}

export function useOrderInvoice(orderId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['order-invoice', orderId],
    queryFn: async () => {
      if (!orderId) return null;

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (error) throw error;
      return data as Invoice | null;
    },
    enabled: !!orderId,
  });

  const resendInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: { invoice_id: invoiceId },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Factuur opnieuw verstuurd');
      queryClient.invalidateQueries({ queryKey: ['order-invoice', orderId] });
    },
    onError: (error: Error) => {
      toast.error('Fout bij versturen factuur', { description: error.message });
    },
  });

  return { invoice, isLoading, error, resendInvoice };
}
