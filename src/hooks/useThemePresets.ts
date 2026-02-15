import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface ThemePresetSettings {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  heading_font: string;
  body_font: string;
  header_style: string;
  product_card_style: string;
  products_per_row: number;
  show_breadcrumbs: boolean;
  show_wishlist: boolean;
  theme_id?: string | null;
}

export interface ThemePreset {
  id: string;
  tenant_id: string;
  name: string;
  settings: Json;
  created_at: string;
}

export function useThemePresets() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const queryKey = ['theme-presets', currentTenant?.id];

  const { data: presets = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await (supabase as any)
        .from('tenant_theme_presets')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ThemePreset[];
    },
    enabled: !!currentTenant?.id,
  });

  const createPreset = useMutation({
    mutationFn: async ({ name, settings }: { name: string; settings: ThemePresetSettings }) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      const { error } = await (supabase as any)
        .from('tenant_theme_presets')
        .insert({ tenant_id: currentTenant.id, name, settings: settings as unknown as Json });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Preset opgeslagen');
    },
    onError: () => toast.error('Fout bij opslaan preset'),
  });

  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('tenant_theme_presets')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Preset verwijderd');
    },
    onError: () => toast.error('Fout bij verwijderen preset'),
  });

  return { presets, isLoading, createPreset, deletePreset };
}
