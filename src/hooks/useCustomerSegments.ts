import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { CustomerSegment, SegmentFilterRules } from '@/types/marketing';
import type { Json } from '@/integrations/supabase/types';

export function useCustomerSegments() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: segments = [], isLoading, error } = useQuery({
    queryKey: ['customer-segments', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('customer_segments')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CustomerSegment[];
    },
    enabled: !!currentTenant?.id,
  });

  const createSegment = useMutation({
    mutationFn: async (segment: Omit<CustomerSegment, 'id' | 'created_at' | 'updated_at' | 'member_count'> & { member_count?: number }) => {
      const { data, error } = await supabase
        .from('customer_segments')
        .insert({
          ...segment,
          filter_rules: segment.filter_rules as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
      toast({ title: i18n.t('admin.marketing.toast.segment_aangemaakt') });
    },
    onError: (error: Error) => {
      toast({ title: i18n.t('admin.marketing.toast.fout_bij_aanmaken'), description: error.message, variant: 'destructive' });
    },
  });

  const updateSegment = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<CustomerSegment, 'id' | 'created_at' | 'updated_at' | 'member_count'>> & { id: string; member_count?: number }) => {
      const { data, error } = await supabase
        .from('customer_segments')
        .update({
          ...updates,
          filter_rules: updates.filter_rules as unknown as Json,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
      toast({ title: i18n.t('admin.marketing.toast.segment_bijgewerkt') });
    },
    onError: (error: Error) => {
      toast({ title: i18n.t('admin.marketing.toast.fout_bij_bijwerken'), description: error.message, variant: 'destructive' });
    },
  });

  const deleteSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customer_segments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
      toast({ title: i18n.t('admin.marketing.toast.segment_verwijderd') });
    },
    onError: (error: Error) => {
      toast({ title: i18n.t('admin.marketing.toast.fout_bij_verwijderen'), description: error.message, variant: 'destructive' });
    },
  });

  return {
    segments,
    isLoading,
    error,
    createSegment,
    updateSegment,
    deleteSegment,
  };
}

/**
 * MAIL-1a: aantal ontvangers voor een set filterregels, berekend door de server
 * (send-campaign-batch, mode 'segment_count'). Zelfde doelgroeplogica als het echte
 * verzenden: alleen ingeschreven klanten, zonder uitschrijvingen en bounces.
 */
export async function fetchSegmentCount(params: {
  tenantId: string;
  filterRules: SegmentFilterRules;
  presetKey?: string | null;
  language?: string | null;
}): Promise<number> {
  const data = await invokeWithErrorBody<{ recipients: number }>(
    'send-campaign-batch',
    {
      body: {
        mode: 'segment_count',
        tenant_id: params.tenantId,
        filter_rules: params.filterRules,
        preset_key: params.presetKey ?? null,
        language: params.language ?? null,
      },
    },
    i18n.t('admin.marketing.toast.telling_mislukt'),
  );
  return data?.recipients ?? 0;
}

/** Wacht tot de gebruiker even stopt met typen, zodat niet elke toets een serveraanroep wordt. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// Segment member count, server-side (zie fetchSegmentCount).
export function useSegmentMemberCount(
  filterRules: SegmentFilterRules,
  options: { presetKey?: string | null; language?: string | null; enabled?: boolean } = {},
) {
  const { currentTenant } = useTenant();
  const debouncedRules = useDebounced(filterRules, 400);
  const { presetKey = null, language = null, enabled = true } = options;

  return useQuery({
    queryKey: ['segment-member-count', currentTenant?.id, debouncedRules, presetKey, language],
    queryFn: async () => {
      if (!currentTenant?.id) return 0;
      return fetchSegmentCount({
        tenantId: currentTenant.id,
        filterRules: debouncedRules,
        presetKey,
        language,
      });
    },
    enabled: !!currentTenant?.id && enabled,
    staleTime: 30_000,
  });
}
