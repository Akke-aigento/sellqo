import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export interface CustomerMessage {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_id: string | null;
  quote_id: string | null;
  direction: 'outbound' | 'inbound';
  subject: string;
  body_html: string;
  body_text: string | null;
  from_email: string;
  to_email: string;
  reply_to_email: string | null;
  resend_id: string | null;
  delivery_status: 'draft' | 'sending' | 'sent' | 'delivered' | 'opened' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  context_type: 'order' | 'quote' | 'general' | null;
  context_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Health score relevant fields
  read_at: string | null;
  replied_at: string | null;
  message_status: 'active' | 'archived' | 'deleted' | null;
  folder_id: string | null;
}

interface SendMessageInput {
  customer_email: string;
  customer_name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  context_type: 'order' | 'quote' | 'general';
  order_id?: string;
  quote_id?: string;
  customer_id?: string;
  context_data?: Record<string, unknown>;
}

export function useCustomerMessages(filters?: {
  order_id?: string;
  quote_id?: string;
  customer_id?: string;
}) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['customer-messages', currentTenant?.id, filters];

  const { data: messages = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('customer_messages')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (filters?.order_id) {
        query = query.eq('order_id', filters.order_id);
      }
      if (filters?.quote_id) {
        query = query.eq('quote_id', filters.quote_id);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CustomerMessage[];
    },
    enabled: !!currentTenant?.id,
  });

  const sendMessage = useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!currentTenant?.id) {
        throw new Error('No tenant selected');
      }

      const { data, error } = await supabase.functions.invoke('send-customer-message', {
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
        title: 'Bericht verzonden',
        description: 'Je bericht is succesvol verzonden naar de klant.',
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

  return {
    messages,
    isLoading,
    error,
    refetch,
    sendMessage,
  };
}

export function useMessageHistory(entityType: 'order' | 'quote' | 'customer', entityId: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['message-history', entityType, entityId, currentTenant?.id],
    queryFn: async (): Promise<CustomerMessage[]> => {
      if (!currentTenant?.id || !entityId) return [];

      let query = supabase
        .from('customer_messages')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      // Apply filter based on entity type
      if (entityType === 'order') {
        query = query.eq('order_id', entityId);
      } else if (entityType === 'quote') {
        query = query.eq('quote_id', entityId);
      } else {
        query = query.eq('customer_id', entityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as CustomerMessage[];
    },
    enabled: !!currentTenant?.id && !!entityId,
  });
}
