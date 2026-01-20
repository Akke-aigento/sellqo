import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

export interface AIGeneratedImage {
  id: string;
  tenant_id: string;
  prompt: string;
  image_url: string;
  storage_path: string | null;
  width: number | null;
  height: number | null;
  style: string | null;
  credits_used: number;
  content_id: string | null;
  created_at: string;
}

export function useAIImages() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['ai-images', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('ai_generated_images')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AIGeneratedImage[];
    },
    enabled: !!currentTenant?.id,
  });

  const generateImage = useMutation({
    mutationFn: async (params: { 
      prompt: string; 
      style?: string; 
      width?: number; 
      height?: number;
      sourceImageUrl?: string;
      sourceProductId?: string;
      settingPreset?: string;
      marketingText?: string;
      platformPreset?: string;
      enhancementType?: 'generate' | 'enhance' | 'background_remove' | 'overlay';
    }) => {
      const response = await supabase.functions.invoke('ai-generate-image', {
        body: {
          tenantId: currentTenant?.id,
          ...params,
        },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-images'] });
      toast({ title: 'Afbeelding gegenereerd!' });
    },
    onError: (error: Error) => {
      if (error.message.includes('402')) {
        toast({ title: 'Onvoldoende AI credits', variant: 'destructive' });
      } else if (error.message.includes('429')) {
        toast({ title: 'Te veel verzoeken', description: 'Probeer het over een minuut opnieuw.', variant: 'destructive' });
      } else {
        toast({ title: 'Fout bij genereren', description: error.message, variant: 'destructive' });
      }
    },
  });

  const deleteImage = useMutation({
    mutationFn: async (id: string) => {
      const image = images.find(i => i.id === id);
      
      // Delete from storage if exists
      if (image?.storage_path) {
        await supabase.storage.from('ai-images').remove([image.storage_path]);
      }

      const { error } = await supabase
        .from('ai_generated_images')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-images'] });
      toast({ title: 'Afbeelding verwijderd' });
    },
  });

  return {
    images,
    isLoading,
    generateImage,
    deleteImage,
  };
}
