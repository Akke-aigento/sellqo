import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

export interface PromptFavorite {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  prompt_type: 'social' | 'email' | 'image';
  prompt_text: string;
  settings: {
    platform?: string;
    tone?: string;
    campaignType?: string;
    language?: string;
    style?: string;
  };
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePromptFavorite {
  name: string;
  prompt_type: 'social' | 'email' | 'image';
  prompt_text: string;
  settings?: PromptFavorite['settings'];
}

export function usePromptFavorites(promptType?: 'social' | 'email' | 'image') {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['prompt-favorites', currentTenant?.id, promptType],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      let query = supabase
        .from('ai_prompt_favorites')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('usage_count', { ascending: false });

      if (promptType) {
        query = query.eq('prompt_type', promptType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PromptFavorite[];
    },
    enabled: !!currentTenant?.id,
  });

  const createFavorite = useMutation({
    mutationFn: async (favorite: CreatePromptFavorite) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('ai_prompt_favorites')
        .insert({
          tenant_id: currentTenant.id,
          user_id: user?.id,
          name: favorite.name,
          prompt_type: favorite.prompt_type,
          prompt_text: favorite.prompt_text,
          settings: favorite.settings || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-favorites'] });
      toast({ title: 'Favoriet opgeslagen!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij opslaan', description: error.message, variant: 'destructive' });
    },
  });

  const updateFavorite = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PromptFavorite> & { id: string }) => {
      const { data, error } = await supabase
        .from('ai_prompt_favorites')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-favorites'] });
    },
  });

  const deleteFavorite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_prompt_favorites')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-favorites'] });
      toast({ title: 'Favoriet verwijderd' });
    },
  });

  const incrementUsage = useMutation({
    mutationFn: async (id: string) => {
      const favorite = favorites.find(f => f.id === id);
      if (!favorite) return;

      await supabase
        .from('ai_prompt_favorites')
        .update({ usage_count: (favorite.usage_count || 0) + 1 })
        .eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-favorites'] });
    },
  });

  return {
    favorites,
    isLoading,
    createFavorite,
    updateFavorite,
    deleteFavorite,
    incrementUsage,
  };
}
