// EVENT-SYSTEEM FASE 4b — data-laag voor tickettype-beheer (event_ticket_types).
//
// Belangrijk: event_ticket_types kent een XOR-check (event_ticket_types_scope_xor_check)
// over event_detail_id | event_group_id | valid_from. Bij insert zetten we daarom
// UITSLUITEND event_detail_id — nooit valid_from of event_group_id.
//
// Elke write doet .select() na de mutatie (persistence-verificatie: vangt stille
// RLS-weigeringen die anders als "succes" ogen).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export type ReentryPolicy = 'none' | 'unlimited' | 'once_per_day' | 'once_per_event';

export const REENTRY_POLICIES: ReentryPolicy[] = [
  'none',
  'unlimited',
  'once_per_day',
  'once_per_event',
];

export interface TicketTypeFormData {
  product_id: string;
  sub_capacity: number | null;
  sales_start: string | null;
  sales_end: string | null;
  sort_order: number;
  is_active: boolean;
  reentry_policy: ReentryPolicy;
}

export interface TicketProductOption {
  id: string;
  name: string;
  price: number | null;
}

/** Unique-violation op ux_event_ticket_types_event_product. */
export const isDuplicateProductError = (error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code;
  return code === '23505';
};

/** Selecteerbare ticket-producten van de tenant (naam + prijs = één bron van waarheid). */
export function useTicketProducts() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['ticket-products', currentTenant?.id],
    queryFn: async (): Promise<TicketProductOption[]> => {
      if (!currentTenant) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('tenant_id', currentTenant.id)
        .eq('product_type', 'ticket')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id as string,
        name: (p.name as string) ?? '—',
        price: (p.price as number | null) ?? null,
      }));
    },
    enabled: !!currentTenant,
  });
}

function useInvalidate(eventId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  return () => {
    queryClient.invalidateQueries({
      queryKey: ['event-detail-ticket-types', currentTenant?.id, eventId],
    });
    queryClient.invalidateQueries({
      queryKey: ['event-detail-attendees', currentTenant?.id, eventId],
    });
  };
}

export function useCreateTicketType(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidate(eventId);

  return useMutation({
    mutationFn: async (form: TicketTypeFormData) => {
      if (!eventId || !currentTenant) throw new Error('Geen event of tenant');
      const { data, error } = await supabase
        .from('event_ticket_types')
        .insert({
          tenant_id: currentTenant.id,
          // XOR-scope: alleen event_detail_id.
          event_detail_id: eventId,
          product_id: form.product_id,
          sub_capacity: form.sub_capacity,
          sales_start: form.sales_start,
          sales_end: form.sales_end,
          sort_order: form.sort_order,
          is_active: form.is_active,
          reentry_policy: form.reentry_policy,
        })
        .select('id, product_id, sub_capacity, is_active, sort_order')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTicketType(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidate(eventId);

  return useMutation({
    mutationFn: async ({ id, form }: { id: string; form: Partial<TicketTypeFormData> }) => {
      if (!currentTenant) throw new Error('Geen tenant');
      const { data, error } = await supabase
        .from('event_ticket_types')
        .update(form)
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .select('id, product_id, sub_capacity, is_active, sort_order')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useToggleTicketTypeActive(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidate(eventId);

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!currentTenant) throw new Error('Geen tenant');
      const { data, error } = await supabase
        .from('event_ticket_types')
        .update({ is_active })
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .select('id, is_active')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTicketType(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidate(eventId);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant) throw new Error('Geen tenant');
      const { data, error } = await supabase
        .from('event_ticket_types')
        .delete()
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Verwijderen niet toegestaan');
      return id;
    },
    onSuccess: () => invalidate(),
  });
}
