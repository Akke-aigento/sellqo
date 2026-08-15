import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export type EventStatus =
  | 'scheduled'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'skipped'
  | 'merged';

export interface EventDetail {
  id: string;
  product_id: string;
  tenant_id: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  timezone: string;
  capacity: number;
  min_attendees: number;
  status: string;
  meeting_point: string | null;
  location_name: string | null;
  merged_into_event_id: string | null;
  early_bird_price: number | null;
  early_bird_deadline: string | null;
  early_bird_quantity: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventDateFormData {
  event_date: string;
  start_time: string;
  end_time?: string | null;
  capacity: number;
  min_attendees?: number;
  status?: EventStatus;
  meeting_point?: string | null;
  location_name?: string | null;
  merged_into_event_id?: string | null;
  early_bird_price?: number | null;
  early_bird_deadline?: string | null;
  early_bird_quantity?: number | null;
}

export function useEventDetails(productId: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['event-details', productId],
    queryFn: async () => {
      if (!productId || !currentTenant) return [];
      const { data, error } = await supabase
        .from('event_details')
        .select('*')
        .eq('product_id', productId)
        .eq('tenant_id', currentTenant.id)
        .order('event_date', { ascending: true });
      if (error) throw error;
      return (data || []) as EventDetail[];
    },
    enabled: !!productId && !!currentTenant,
  });
}

export function useCreateEventDate(productId: string | undefined) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EventDateFormData) => {
      if (!productId || !currentTenant) throw new Error('Geen product of tenant');
      const { data: row, error } = await supabase
        .from('event_details')
        .insert({
          ...data,
          product_id: productId,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-details', productId] });
      toast({ title: 'Datum toegevoegd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Batch-teller van inschrijvingen per event-datum.
 * Leest ticket_instances (tenant-scoped RLS, fase 1) en telt client-side.
 * Tot fase 4 (ticketverkoop) staan alle tellers op 0 — dat is verwacht.
 */
export function useEventSignupCounts(productId: string | undefined, eventIds: string[]) {
  const { currentTenant } = useTenant();
  const ids = [...eventIds].sort();

  return useQuery({
    queryKey: ['event-signup-counts', productId, ids.join(',')],
    queryFn: async () => {
      if (!currentTenant || ids.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from('ticket_instances')
        .select('event_detail_id')
        .eq('tenant_id', currentTenant.id)
        .in('event_detail_id', ids)
        .in('status', ['valid', 'checked_in']);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const key = (row as { event_detail_id: string | null }).event_detail_id;
        if (!key) continue;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    },
    enabled: !!currentTenant && ids.length > 0,
  });
}

export function useUpdateEventDate(productId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventDateFormData> }) => {
      const { data: row, error } = await supabase
        .from('event_details')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-details', productId] });
      toast({ title: 'Datum bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}

export function useBulkCreateEventDates(productId: string | undefined) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: EventDateFormData[]) => {
      if (!productId || !currentTenant) throw new Error('Geen product of tenant');
      if (rows.length === 0) return [];
      const payload = rows.map((r) => ({
        ...r,
        product_id: productId,
        tenant_id: currentTenant.id,
      }));
      const { data, error } = await supabase.from('event_details').insert(payload).select();
      if (error) throw error;
      return data || [];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-details', productId] });
      toast({ title: `${(data as unknown[]).length} datum(s) aangemaakt` });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteEventDate(productId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_details').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-details', productId] });
      toast({ title: 'Datum verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}
