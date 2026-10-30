import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { keyOutUrl, pickKeyColorForUrl, type KeyColor } from '@/lib/chromaKey';

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
      // BG-REMOVE-1: bij "achtergrond verwijderen" eerst een sleutelkleur kiezen die niet in de
      // foto voorkomt; de edge function laat het model die als effen achtergrond zetten.
      const wantsAlpha = params.enhancementType === 'background_remove' && !!params.sourceImageUrl;
      const keyColor: KeyColor | undefined = wantsAlpha ? await pickKeyColorForUrl(params.sourceImageUrl!) : undefined;

      const response = await supabase.functions.invoke('ai-generate-image', {
        body: {
          tenantId: currentTenant?.id,
          ...params,
          ...(keyColor ? { keyColor } : {}),
        },
      });

      if (response.error) throw new Error(response.error.message);
      const data = response.data;
      if (!data?.keyColor || !data?.imageUrl || !currentTenant?.id) return data;

      // Sleutelkleur wegknippen → PNG met echte transparantie, als nieuw bestand (de oude URL
      // kan al in de CDN-cache zitten). Lukt het niet, dan blijft de effen achtergrond staan:
      // nooit een half weggeknipte foto teruggeven.
      try {
        const blob = await keyOutUrl(data.imageUrl, data.keyColor as KeyColor);
        if (!blob) return data;
        const path = `${currentTenant.id}/${Date.now()}-transparent.png`;
        const up = await supabase.storage.from('ai-images').upload(path, blob, { contentType: 'image/png', upsert: false });
        if (up.error) return data;
        const url = supabase.storage.from('ai-images').getPublicUrl(path).data.publicUrl;
        // Galerij bijwerken: nieuwe rij met de transparante versie, de tussenversie weg.
        if (data.savedId) {
          const { data: old } = await supabase.from('ai_generated_images').select('*').eq('id', data.savedId).maybeSingle();
          if (old) {
            const { id: _id, created_at: _c, ...rest } = old as Record<string, unknown>;
            const ins = await supabase.from('ai_generated_images').insert({ ...rest, image_url: url, storage_path: path } as never);
            if (!ins.error) {
              await supabase.from('ai_generated_images').delete().eq('id', data.savedId);
              if (data.storagePath) await supabase.storage.from('ai-images').remove([data.storagePath]);
            }
          }
        }
        return { ...data, imageUrl: url, storagePath: path, transparent: true };
      } catch {
        return data;
      }
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
