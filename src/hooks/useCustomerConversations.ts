import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CustomerConversation {
  id: string;
  subject: string | null;
  last_message_at: string;
  message_count: number;
  channel: string;
}

export function useCustomerConversations(customerId: string | undefined) {
  const { data: conversations, isLoading, error } = useQuery({
    queryKey: ['customer-conversations', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      // Get all messages for this customer, grouped by conversation thread
      const { data: messages, error } = await supabase
        .from('customer_messages')
        .select('id, subject, created_at, channel, context_data')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages into conversations by subject (simplified threading)
      const conversationMap = new Map<string, CustomerConversation>();
      
      for (const msg of messages || []) {
        // Use subject as conversation key (normalized)
        const normalizedSubject = (msg.subject || '(Geen onderwerp)')
          .replace(/^(Re:|Fw:|Fwd:)\s*/gi, '')
          .trim();
        
        const key = normalizedSubject.toLowerCase();
        
        if (!conversationMap.has(key)) {
          conversationMap.set(key, {
            id: msg.id,
            subject: normalizedSubject,
            last_message_at: msg.created_at,
            message_count: 1,
            channel: msg.channel,
          });
        } else {
          const existing = conversationMap.get(key)!;
          existing.message_count += 1;
          // Keep the most recent message date
          if (new Date(msg.created_at) > new Date(existing.last_message_at)) {
            existing.last_message_at = msg.created_at;
          }
        }
      }

      return Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    },
    enabled: !!customerId,
  });

  return { conversations: conversations ?? [], isLoading, error };
}
