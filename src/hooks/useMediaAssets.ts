import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface MediaAsset {
  id: string;
  tenant_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  title: string | null;
  description: string | null;
  alt_text: string | null;
  tags: string[];
  ai_description: string | null;
  is_ai_generated: boolean;
  source: string;
  usage_count: number;
  last_used_at: string | null;
  folder: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export type MediaAssetInsert = Omit<MediaAsset, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'last_used_at'>;

export function useMediaAssets(folder?: string) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading, error } = useQuery({
    queryKey: ['media-assets', currentTenant?.id, folder],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      let query = supabase
        .from('media_assets')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      
      if (folder && folder !== 'all') {
        if (folder === 'favorites') {
          query = query.eq('is_favorite', true);
        } else {
          query = query.eq('folder', folder);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as MediaAsset[];
    },
    enabled: !!currentTenant?.id,
  });

  const createAsset = useMutation({
    mutationFn: async (asset: Partial<MediaAssetInsert>) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');
      
      const { data, error } = await supabase
        .from('media_assets')
        .insert({
          tenant_id: currentTenant.id,
          file_name: asset.file_name!,
          file_url: asset.file_url!,
          file_type: asset.file_type!,
          file_size: asset.file_size,
          width: asset.width,
          height: asset.height,
          title: asset.title,
          description: asset.description,
          alt_text: asset.alt_text,
          tags: asset.tags || [],
          ai_description: asset.ai_description,
          is_ai_generated: asset.is_ai_generated || false,
          source: asset.source || 'upload',
          folder: asset.folder || 'general',
          is_favorite: asset.is_favorite || false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as MediaAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-assets'] });
      toast.success('Asset toegevoegd');
    },
    onError: (error) => {
      toast.error('Fout bij toevoegen asset: ' + error.message);
    },
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MediaAsset> & { id: string }) => {
      const { data, error } = await supabase
        .from('media_assets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as MediaAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-assets'] });
    },
    onError: (error) => {
      toast.error('Fout bij updaten asset: ' + error.message);
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('media_assets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-assets'] });
      toast.success('Asset verwijderd');
    },
    onError: (error) => {
      toast.error('Fout bij verwijderen: ' + error.message);
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase
        .from('media_assets')
        .update({ is_favorite })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-assets'] });
    },
  });

  const incrementUsage = useMutation({
    mutationFn: async (id: string) => {
      // First get current usage count
      const { data: current } = await supabase
        .from('media_assets')
        .select('usage_count')
        .eq('id', id)
        .single();
      
      const { error } = await supabase
        .from('media_assets')
        .update({ 
          usage_count: (current?.usage_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
  });

  return {
    assets,
    isLoading,
    error,
    createAsset,
    updateAsset,
    deleteAsset,
    toggleFavorite,
    incrementUsage,
  };
}
