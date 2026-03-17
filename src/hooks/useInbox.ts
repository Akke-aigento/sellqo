import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import { useAuth } from './useAuth';
import { useNotificationSound } from './useNotificationSound';
import { useInboxFolders } from './useInboxFolders';

export type MessageChannel = 'email' | 'whatsapp' | 'sms' | 'facebook' | 'instagram';
export type ConversationChannel = MessageChannel | 'mixed' | 'social';
export type FilterChannel = 'all' | 'email' | 'whatsapp' | 'facebook' | 'instagram' | 'social';
export type MessageStatus = 'active' | 'archived' | 'deleted';

export interface InboxMessage {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_id: string | null;
  quote_id: string | null;
  direction: 'outbound' | 'inbound' | 'internal';
  subject: string;
  body_html: string;
  body_text: string | null;
  from_email: string;
  to_email: string;
  reply_to_email: string | null;
  channel: MessageChannel;
  delivery_status: string;
  message_status?: MessageStatus;
  folder_id?: string | null;
  deleted_at?: string | null;
  is_pinned?: boolean;
  snoozed_until?: string | null;
  whatsapp_status: string | null;
  read_at: string | null;
  read_by: string | null;
  replied_at: string | null;
  reply_message_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  // Meta messaging fields
  meta_sender_id?: string | null;
  meta_page_id?: string | null;
  meta_message_id?: string | null;
  customers?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    whatsapp_number: string | null;
    facebook_psid?: string | null;
    instagram_id?: string | null;
  } | null;
}

export interface Conversation {
  id: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    facebook_psid?: string;
    instagram_id?: string;
  } | null;
  lastMessage: InboxMessage;
  unreadCount: number;
  channel: ConversationChannel;
  messages: InboxMessage[];
  replyToEmail?: string;
  messageStatus: MessageStatus;
  folderId: string | null;
  isPinned: boolean;
  snoozedUntil: string | null;
}

export interface SearchOptions {
  scope: 'current' | 'all' | 'everywhere';
  channels: FilterChannel[];
  searchIn: {
    subject: boolean;
    content: boolean;
    sender: boolean;
  };
  period: 'week' | 'month' | '3months' | 'all';
}

export const getDefaultSearchOptions = (hasActiveFolder: boolean): SearchOptions => ({
  scope: hasActiveFolder ? 'current' : 'all',
  channels: ['email', 'whatsapp', 'facebook', 'instagram'],
  searchIn: { subject: true, content: true, sender: true },
  period: 'all',
});

export interface InboxFilters {
  channel: FilterChannel;
  status: 'all' | 'unread' | 'unanswered';
  search: string;
  folderId: string | null; // null = inbox, 'archived' = archive folder, 'deleted' = trash
  searchOptions: SearchOptions;
}

// Helper to check if channel is a social channel
export const isSocialChannel = (channel: MessageChannel): boolean => {
  return channel === 'whatsapp' || channel === 'facebook' || channel === 'instagram';
};

export function useInbox() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { playSound } = useNotificationSound();
  const { archiveFolder, trashFolder } = useInboxFolders();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [filters, setFilters] = useState<InboxFilters>({
    channel: 'all',
    status: 'all',
    search: '',
    folderId: null, // null = inbox (active messages without folder)
    searchOptions: getDefaultSearchOptions(false),
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

      // When searching, apply search-specific filters
      if (filters.search) {
        const { scope, channels, searchIn, period } = filters.searchOptions;

        // Apply scope filter
        if (scope === 'current') {
          // Current folder only
          if (filters.folderId === null) {
            query = query.eq('message_status', 'active').is('folder_id', null);
          } else if (filters.folderId === 'archived' || filters.folderId === archiveFolder?.id) {
            query = query.eq('message_status', 'archived');
          } else if (filters.folderId === 'deleted' || filters.folderId === trashFolder?.id) {
            query = query.eq('message_status', 'deleted');
          } else {
            query = query.eq('folder_id', filters.folderId).eq('message_status', 'active');
          }
        } else if (scope === 'all') {
          // All folders except trash
          query = query.neq('message_status', 'deleted');
        }
        // 'everywhere' = no message_status filter (includes deleted)

        // Apply channel filter for search
        if (channels.length < 4) {
          query = query.in('channel', channels);
        }

        // Apply period filter
        if (period !== 'all') {
          const periods = { week: 7, month: 30, '3months': 90 };
          const days = periods[period];
          const since = new Date();
          since.setDate(since.getDate() - days);
          query = query.gte('created_at', since.toISOString());
        }

        // Apply text search with OR conditions
        const orConditions: string[] = [];
        if (searchIn.subject) orConditions.push(`subject.ilike.%${filters.search}%`);
        if (searchIn.content) {
          orConditions.push(`body_text.ilike.%${filters.search}%`);
        }
        if (searchIn.sender) {
          orConditions.push(`from_email.ilike.%${filters.search}%`);
        }
        if (orConditions.length > 0) {
          query = query.or(orConditions.join(','));
        }
      } else {
        // Normal folder/status filter (no search)
        if (filters.folderId === null) {
          query = query.eq('message_status', 'active').is('folder_id', null);
        } else if (filters.folderId === 'archived' || filters.folderId === archiveFolder?.id) {
          query = query.eq('message_status', 'archived');
        } else if (filters.folderId === 'deleted' || filters.folderId === trashFolder?.id) {
          query = query.eq('message_status', 'deleted');
        } else {
          query = query.eq('folder_id', filters.folderId).eq('message_status', 'active');
        }

        // Apply channel filter (when not searching)
        if (filters.channel === 'social') {
          query = query.in('channel', ['whatsapp', 'facebook', 'instagram']);
        } else if (filters.channel !== 'all') {
          query = query.eq('channel', filters.channel);
        }
      }

      // Apply status filter (both search and non-search)
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
      // Normaliseer subject voor threading
      const normalizedSubject = (msg.subject || '')
        .replace(/^(Re:|Fw:|Fwd:)\s*/gi, '')
        .trim()
        .toLowerCase();
      
      // Groepeer op contact + onderwerp
      const contactKey = msg.customer_id 
        || (msg.direction === 'outbound' ? msg.to_email : msg.from_email) 
        || 'unknown';
      const key = `${contactKey}::${normalizedSubject || 'no-subject'}`;
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
      let channel: ConversationChannel = 'email';
      if (channels.size > 1) {
        // Check if all are social channels
        const allSocial = [...channels].every(c => isSocialChannel(c as MessageChannel));
        channel = allSocial ? 'social' : 'mixed';
      } else if (channels.has('whatsapp')) {
        channel = 'whatsapp';
      } else if (channels.has('facebook')) {
        channel = 'facebook';
      } else if (channels.has('instagram')) {
        channel = 'instagram';
      }

      const unreadCount = msgs.filter(
        (m) => m.direction === 'inbound' && !m.read_at
      ).length;

      // Find the most recent inbound message to get the reply_to_email
      const lastInboundMessage = sortedMsgs.find(m => m.direction === 'inbound');
      const replyToEmail = lastInboundMessage?.reply_to_email || customer?.email;

      // Determine conversation status from last message
      const messageStatus = (lastMessage.message_status as MessageStatus) || 'active';
      const folderId = lastMessage.folder_id || null;
      const isPinned = msgs.some(m => m.is_pinned);
      const snoozedUntil = lastMessage.snoozed_until || null;

      convos.push({
        id: key,
        customer: customer
          ? {
              id: customer.id,
              name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email,
              email: customer.email,
              phone: customer.whatsapp_number || customer.phone || undefined,
              facebook_psid: customer.facebook_psid || undefined,
              instagram_id: customer.instagram_id || undefined,
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
        replyToEmail,
        messageStatus,
        folderId,
        isPinned,
        snoozedUntil,
      });
    }

    // Sort by unread first, then by date
    return convos.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
    });
  }, [messages]);

  // Client-side filtering is no longer needed for search (moved to database query)
  // Keep for additional client-side filtering like customer name matching
  const filteredConversations = useMemo(() => {
    if (!filters.search) return conversations;
    
    // Additional client-side filter for customer name (not in DB)
    const searchLower = filters.search.toLowerCase();
    return conversations.filter((c) => {
      // Already filtered by DB, but add customer name matching
      if (c.customer?.name.toLowerCase().includes(searchLower)) return true;
      // The rest is already matched by the database query
      return true;
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

  // Mark conversation as unread (clear read_at on last inbound message)
  const markConversationAsUnread = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!currentTenant?.id) throw new Error('Not authenticated');

      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) return;

      // Find the last inbound message that was read
      const lastReadInbound = conversation.messages.find(
        (m) => m.direction === 'inbound' && m.read_at
      );
      if (!lastReadInbound) return;

      const { error } = await supabase
        .from('customer_messages')
        .update({ read_at: null, read_by: null })
        .eq('id', lastReadInbound.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
    },
  });

  // Archive conversation
  const archiveConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) throw new Error('Conversation not found');

      const messageIds = conversation.messages.map((m) => m.id);

      const { error } = await supabase
        .from('customer_messages')
        .update({ message_status: 'archived' })
        .in('id', messageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast({
        title: 'Gesprek gearchiveerd',
        description: 'Het gesprek is verplaatst naar het archief.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete (move to trash) conversation
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) throw new Error('Conversation not found');

      const messageIds = conversation.messages.map((m) => m.id);

      const { error } = await supabase
        .from('customer_messages')
        .update({ 
          message_status: 'deleted',
          deleted_at: new Date().toISOString(),
        })
        .in('id', messageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast({
        title: 'Gesprek verwijderd',
        description: 'Het gesprek is verplaatst naar de prullenbak.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Restore conversation (from archive or trash)
  const restoreConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) throw new Error('Conversation not found');

      const messageIds = conversation.messages.map((m) => m.id);

      const { error } = await supabase
        .from('customer_messages')
        .update({ 
          message_status: 'active',
          deleted_at: null,
          folder_id: null,
        })
        .in('id', messageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast({
        title: 'Gesprek hersteld',
        description: 'Het gesprek is teruggezet naar de inbox.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Move conversation to folder
  const moveToFolder = useMutation({
    mutationFn: async ({ conversationId, folderId }: { conversationId: string; folderId: string | null }) => {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) throw new Error('Conversation not found');

      const messageIds = conversation.messages.map((m) => m.id);

      const { error } = await supabase
        .from('customer_messages')
        .update({ 
          folder_id: folderId,
          message_status: 'active',
          deleted_at: null,
        })
        .in('id', messageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast({
        title: 'Gesprek verplaatst',
        description: 'Het gesprek is verplaatst naar de geselecteerde map.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
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
          
          // Play sound for inbound messages (toast is handled by global listener)
          if ((payload.new as InboxMessage).direction === 'inbound') {
            playSound();
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
  }, [currentTenant?.id, queryClient, playSound]);

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
    markConversationAsUnread: markConversationAsUnread.mutate,
    archiveConversation: archiveConversation.mutate,
    deleteConversation: deleteConversation.mutate,
    restoreConversation: restoreConversation.mutate,
    moveToFolder: moveToFolder.mutate,
  };
}
