import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import { useAuth } from './useAuth';

export interface InboxMessage {
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
  channel: 'email' | 'whatsapp' | 'sms';
  status: string;
  whatsapp_status: string | null;
  read_at: string | null;
  read_by: string | null;
  replied_at: string | null;
  reply_message_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  customers?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    whatsapp_number: string | null;
  } | null;
}

export interface Conversation {
  id: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
  lastMessage: InboxMessage;
  unreadCount: number;
  channel: 'email' | 'whatsapp' | 'mixed';
  messages: InboxMessage[];
}

export interface InboxFilters {
  channel: 'all' | 'email' | 'whatsapp';
  status: 'all' | 'unread' | 'unanswered';
  search: string;
}

export function useInbox() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [filters, setFilters] = useState<InboxFilters>({
    channel: 'all',
    status: 'all',
    search: '',
  });

  const queryKey = ['inbox-messages', currentTenant?.id, filters];

  const { data: messages = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('customer_messages')
        .select(`
          *,
          customers (
            id,
            first_name,
            last_name,
            email,
            phone,
            whatsapp_number
          )
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      // Apply channel filter
      if (filters.channel !== 'all') {
        query = query.eq('channel', filters.channel);
      }

      // Apply status filter
      if (filters.status === 'unread') {
        query = query.eq('direction', 'inbound').is('read_at', null);
      } else if (filters.status === 'unanswered') {
        query = query.eq('direction', 'inbound').is('replied_at', null);
      }

      const { data, error } = await query.limit(200);

      if (error) throw error;
      return data as InboxMessage[];
    },
    enabled: !!currentTenant?.id,
  });

  // Group messages into conversations
  const conversations = useMemo(() => {
    const grouped = new Map<string, InboxMessage[]>();

    for (const msg of messages) {
      // Group by customer_id, or by email/phone if no customer
      const key = msg.customer_id || msg.from_email || msg.to_email || 'unknown';
      const existing = grouped.get(key) || [];
      grouped.set(key, [...existing, msg]);
    }

    const convos: Conversation[] = [];

    for (const [key, msgs] of grouped.entries()) {
      const sortedMsgs = msgs.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMessage = sortedMsgs[0];
      const customer = lastMessage.customers;
      
      // Determine channel type
      const channels = new Set(msgs.map((m) => m.channel));
      let channel: 'email' | 'whatsapp' | 'mixed' = 'email';
      if (channels.size > 1) {
        channel = 'mixed';
      } else if (channels.has('whatsapp')) {
        channel = 'whatsapp';
      }

      const unreadCount = msgs.filter(
        (m) => m.direction === 'inbound' && !m.read_at
      ).length;

      convos.push({
        id: key,
        customer: customer
          ? {
              id: customer.id,
              name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email,
              email: customer.email,
              phone: customer.whatsapp_number || customer.phone || undefined,
            }
          : {
              id: key,
              name: lastMessage.from_email || lastMessage.to_email,
              email: lastMessage.from_email || lastMessage.to_email,
            },
        lastMessage,
        unreadCount,
        channel,
        messages: sortedMsgs,
      });
    }

    // Sort by unread first, then by date
    return convos.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
    });
  }, [messages]);

  // Filter by search
  const filteredConversations = useMemo(() => {
    if (!filters.search) return conversations;
    
    const searchLower = filters.search.toLowerCase();
    return conversations.filter((c) => {
      return (
        c.customer?.name.toLowerCase().includes(searchLower) ||
        c.customer?.email.toLowerCase().includes(searchLower) ||
        c.lastMessage.subject.toLowerCase().includes(searchLower) ||
        c.lastMessage.body_text?.toLowerCase().includes(searchLower)
      );
    });
  }, [conversations, filters.search]);

  const selectedConversation = useMemo(() => {
    return filteredConversations.find((c) => c.id === selectedConversationId) || null;
  }, [filteredConversations, selectedConversationId]);

  const unreadTotal = useMemo(() => {
    return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  }, [conversations]);

  // Mark message as read
  const markAsRead = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('customer_messages')
        .update({
          read_at: new Date().toISOString(),
          read_by: user.id,
        })
        .eq('id', messageId)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
    },
  });

  // Mark entire conversation as read
  const markConversationAsRead = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id || !currentTenant?.id) throw new Error('Not authenticated');

      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) return;

      const unreadIds = conversation.messages
        .filter((m) => m.direction === 'inbound' && !m.read_at)
        .map((m) => m.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('customer_messages')
        .update({
          read_at: new Date().toISOString(),
          read_by: user.id,
        })
        .in('id', unreadIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!currentTenant?.id) return;

    const channel = supabase
      .channel('inbox-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_messages',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
          
          // Show toast for inbound messages
          if ((payload.new as InboxMessage).direction === 'inbound') {
            toast({
              title: 'Nieuw bericht ontvangen',
              description: (payload.new as InboxMessage).subject || 'Je hebt een nieuw klantbericht',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customer_messages',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, queryClient, toast]);

  return {
    conversations: filteredConversations,
    selectedConversation,
    selectedConversationId,
    setSelectedConversationId,
    unreadTotal,
    isLoading,
    error,
    filters,
    setFilters,
    markAsRead: markAsRead.mutate,
    markConversationAsRead: markConversationAsRead.mutate,
  };
}
