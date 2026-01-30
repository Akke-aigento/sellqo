import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export interface InboxFolder {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  icon: string;
  is_system: boolean;
  sort_order: number;
  created_at: string;
}

export function useInboxFolders() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['inbox-folders', currentTenant?.id];

  const { data: folders = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('inbox_folders')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as InboxFolder[];
    },
    enabled: !!currentTenant?.id,
  });

  // Get system folders
  const inboxFolder = folders.find(f => f.name === 'Inbox' && f.is_system);
  const archiveFolder = folders.find(f => f.name === 'Gearchiveerd' && f.is_system);
  const trashFolder = folders.find(f => f.name === 'Prullenbak' && f.is_system);
  const customFolders = folders.filter(f => !f.is_system);

  const createFolder = useMutation({
    mutationFn: async ({ name, color, icon }: { name: string; color?: string; icon?: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const maxSortOrder = Math.max(...folders.map(f => f.sort_order), 2);

      const { data, error } = await supabase
        .from('inbox_folders')
        .insert({
          tenant_id: currentTenant.id,
          name,
          color: color || '#6366f1',
          icon: icon || 'folder',
          is_system: false,
          sort_order: maxSortOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as InboxFolder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Map aangemaakt',
        description: 'De nieuwe map is succesvol aangemaakt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij aanmaken',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateFolder = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; color?: string; icon?: string }) => {
      const folder = folders.find(f => f.id === id);
      if (folder?.is_system) throw new Error('Systeemmappen kunnen niet worden aangepast');

      const { error } = await supabase
        .from('inbox_folders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij bewerken',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      if (folder?.is_system) throw new Error('Systeemmappen kunnen niet worden verwijderd');

      // First, move all messages from this folder back to inbox (clear folder_id)
      await supabase
        .from('customer_messages')
        .update({ folder_id: null })
        .eq('folder_id', folderId);

      const { error } = await supabase
        .from('inbox_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast({
        title: 'Map verwijderd',
        description: 'De map is verwijderd. Berichten zijn teruggeplaatst in de inbox.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    folders,
    inboxFolder,
    archiveFolder,
    trashFolder,
    customFolders,
    isLoading,
    error,
    createFolder,
    updateFolder,
    deleteFolder,
  };
}
