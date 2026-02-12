import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChannelFieldMapping } from '@/types/specifications';

export function useChannelFieldMappings(channelType?: string) {
  const queryClient = useQueryClient();

  // Fetch field mappings
  const mappingsQuery = useQuery({
    queryKey: ['channel-field-mappings', channelType],
    queryFn: async () => {
      let query = supabase.from('channel_field_mappings').select('*').eq('is_active', true);

      if (channelType) {
        query = query.eq('channel_type', channelType);
      }

      const { data, error } = await query.order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Create mapping (platform admin only)
  const createMappingMutation = useMutation({
    mutationFn: async (mapping: Omit<ChannelFieldMapping, 'id' | 'created_at' | 'updated_at'>) => {
      const mappingData: any = { ...mapping };
      if (mappingData.transform_rule) {
        mappingData.transform_rule = mappingData.transform_rule as any;
      }

      const { data, error } = await supabase
        .from('channel_field_mappings')
        .insert([mappingData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-field-mappings'] });
    },
  });

  // Update mapping (platform admin only)
  const updateMappingMutation = useMutation({
    mutationFn: async (mapping: Partial<ChannelFieldMapping> & { id: string }) => {
      const { id, ...updates } = mapping;
      const updateData: any = { ...updates };
      if (updateData.transform_rule) {
        updateData.transform_rule = updateData.transform_rule as any;
      }

      const { data, error } = await supabase
        .from('channel_field_mappings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-field-mappings'] });
    },
  });

  // Delete mapping (platform admin only)
  const deleteMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from('channel_field_mappings')
        .update({ is_active: false })
        .eq('id', mappingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-field-mappings'] });
    },
  });

  return {
    mappings: mappingsQuery.data || [],
    isLoading: mappingsQuery.isLoading,
    error: mappingsQuery.error,
    createMapping: createMappingMutation.mutate,
    updateMapping: updateMappingMutation.mutate,
    deleteMapping: deleteMappingMutation.mutate,
  };
}
