import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import type { Conversation } from './useInbox';

export function useBulkInboxActions(conversations: Conversation[]) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((conversationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(conversations.map((c) => c.id)));
  }, [conversations]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (conversationId: string) => selectedIds.has(conversationId),
    [selectedIds]
  );

  // Get all message IDs for selected conversations
  const getSelectedMessageIds = useCallback(() => {
    const messageIds: string[] = [];
    for (const id of selectedIds) {
      const conversation = conversations.find((c) => c.id === id);
      if (conversation) {
        messageIds.push(...conversation.messages.map((m) => m.id));
      }
    }
    return messageIds;
  }, [selectedIds, conversations]);

  // Bulk archive
  const bulkArchive = useMutation({
    mutationFn: async () => {
      const messageIds = getSelectedMessageIds();
      if (messageIds.length === 0) return;

      const { error } = await supabase
        .from('customer_messages')
        .update({ message_status: 'archived' })
        .in('id', messageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast({
        title: 'Gesprekken gearchiveerd',
        description: `${selectedIds.size} gesprek(ken) verplaatst naar archief.`,
      });
      clearSelection();
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk delete (move to trash)
  const bulkDelete = useMutation({
    mutationFn: async () => {
      const messageIds = getSelectedMessageIds();
      if (messageIds.length === 0) return;

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
        title: 'Gesprekken verwijderd',
        description: `${selectedIds.size} gesprek(ken) verplaatst naar prullenbak.`,
      });
      clearSelection();
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk restore
  const bulkRestore = useMutation({
    mutationFn: async () => {
      const messageIds = getSelectedMessageIds();
      if (messageIds.length === 0) return;

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
        title: 'Gesprekken hersteld',
        description: `${selectedIds.size} gesprek(ken) teruggezet naar inbox.`,
      });
      clearSelection();
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk move to folder
  const bulkMoveToFolder = useMutation({
    mutationFn: async (folderId: string | null) => {
      const messageIds = getSelectedMessageIds();
      if (messageIds.length === 0) return;

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
        title: 'Gesprekken verplaatst',
        description: `${selectedIds.size} gesprek(ken) verplaatst.`,
      });
      clearSelection();
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    bulkArchive: bulkArchive.mutate,
    bulkDelete: bulkDelete.mutate,
    bulkRestore: bulkRestore.mutate,
    bulkMoveToFolder: bulkMoveToFolder.mutate,
    isLoading:
      bulkArchive.isPending ||
      bulkDelete.isPending ||
      bulkRestore.isPending ||
      bulkMoveToFolder.isPending,
  };
}
