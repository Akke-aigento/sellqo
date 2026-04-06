import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    mutationFn: async (segment: Omit<CustomerSegment, 'id' | 'created_at' | 'updated_at' | 'member_count'>) => {
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
      toast({ title: 'Segment aangemaakt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij aanmaken', description: error.message, variant: 'destructive' });
    },
  });

  const updateSegment = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<CustomerSegment, 'id' | 'created_at' | 'updated_at' | 'member_count'>> & { id: string }) => {
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
      toast({ title: 'Segment bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij bijwerken', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Segment verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
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

// Calculate segment member count based on filter rules
export function useSegmentMemberCount(filterRules: SegmentFilterRules) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['segment-member-count', currentTenant?.id, filterRules],
    queryFn: async () => {
      if (!currentTenant?.id) return 0;
      
      let query = supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id);

      // Apply filter rules
      if (filterRules.customer_type && filterRules.customer_type !== 'all') {
        query = query.eq('customer_type', filterRules.customer_type);
      }

      if (filterRules.countries && filterRules.countries.length > 0) {
        query = query.in('billing_country', filterRules.countries);
      }

      if (filterRules.min_orders !== undefined) {
        query = query.gte('total_orders', filterRules.min_orders);
      }

      if (filterRules.max_orders !== undefined) {
        query = query.lte('total_orders', filterRules.max_orders);
      }

      if (filterRules.min_total_spent !== undefined) {
        query = query.gte('total_spent', filterRules.min_total_spent);
      }

      if (filterRules.max_total_spent !== undefined) {
        query = query.lte('total_spent', filterRules.max_total_spent);
      }

      if (filterRules.email_subscribed !== undefined) {
        query = query.eq('email_subscribed', filterRules.email_subscribed);
      }

      if (filterRules.tags && filterRules.tags.length > 0) {
        if (filterRules.tags_match === 'all') {
          query = query.contains('tags', filterRules.tags);
        } else {
          query = query.overlaps('tags', filterRules.tags);
        }
      }

      if (filterRules.created_after) {
        query = query.gte('created_at', filterRules.created_after);
      }

      if (filterRules.created_before) {
        query = query.lte('created_at', filterRules.created_before);
      }

      const { count, error } = await query;

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentTenant?.id,
  });
}
