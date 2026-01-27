import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'billing' | 'technical' | 'feature' | 'bug' | 'other';
export type SenderType = 'merchant' | 'support' | 'system' | 'ai';

export interface SupportTicket {
  id: string;
  tenant_id: string | null;
  requester_email: string;
  requester_name: string | null;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  assigned_to: string | null;
  tags: string[];
  metadata: Record<string, any>;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  tenant?: { name: string; slug: string } | null;
  message_count?: number;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  sender_email: string | null;
  message: string;
  is_internal_note: boolean;
  attachments: any[];
  created_at: string;
}

export function useSupportTickets() {
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          tenant:tenants(name, slug)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get message counts
      const ticketIds = (data || []).map(t => t.id);
      if (ticketIds.length > 0) {
        const { data: messages } = await supabase
          .from('support_messages')
          .select('ticket_id')
          .in('ticket_id', ticketIds);
        
        const countMap = (messages || []).reduce((acc, m) => {
          acc[m.ticket_id] = (acc[m.ticket_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return (data || []).map(t => ({
          ...t,
          message_count: countMap[t.id] || 0
        })) as SupportTicket[];
      }
      
      return (data || []) as SupportTicket[];
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: Partial<SupportTicket>) => {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert(ticketData as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Ticket aangemaakt');
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportTicket> & { id: string }) => {
      const { data, error } = await supabase
        .from('support_tickets')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Ticket bijgewerkt');
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  const getTicketStats = () => {
    const open = tickets.filter(t => t.status === 'open').length;
    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const waiting = tickets.filter(t => t.status === 'waiting').length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const urgent = tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length;
    
    return { open, inProgress, waiting, resolved, urgent, total: tickets.length };
  };

  return {
    tickets,
    isLoading,
    createTicket: createTicketMutation.mutateAsync,
    updateTicket: updateTicketMutation.mutateAsync,
    getTicketStats,
    isCreating: createTicketMutation.isPending,
    isUpdating: updateTicketMutation.isPending,
  };
}

export function useSupportMessages(ticketId: string | null) {
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['support-messages', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as SupportMessage[];
    },
    enabled: !!ticketId,
  });

  const addMessageMutation = useMutation({
    mutationFn: async (messageData: Partial<SupportMessage>) => {
      const { data, error } = await supabase
        .from('support_messages')
        .insert(messageData as any)
        .select()
        .single();
      if (error) throw error;
      
      // Update first_response_at if this is the first support response
      if (messageData.sender_type === 'support' && ticketId) {
        await supabase
          .from('support_tickets')
          .update({ first_response_at: new Date().toISOString() })
          .eq('id', ticketId)
          .is('first_response_at', null);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  return {
    messages,
    isLoading,
    addMessage: addMessageMutation.mutateAsync,
    isAdding: addMessageMutation.isPending,
  };
}
