// EVENT-WORKSPACE-1 — alles van een event beheren vanaf de eventpagina, zonder Producten.
// Onder de motorkap blijft een event een ticketproduct en is elk tickettype een (verborgen)
// ticketproduct gekoppeld via event_ticket_types. Zo blijven storefront-api, checkout,
// ticketuitgifte en custom frontends ongewijzigd:
//  - het hoofdproduct is het event (naam, foto, beschrijving, zichtbaarheid, standaardprijs);
//  - extra types (VIP, Weekend, Camping…) zijn ticketproducten met hide_from_storefront,
//    zodat een frontend die get_products leest ze niet als apart event toont.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { slugBase, uniqueSlug } from '@/lib/eventSeries';
import type { ReentryPolicy } from '@/hooks/useEventTicketTypes';

export interface EventProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  images: string[];
  featured_image: string | null;
  is_active: boolean;
  hide_from_storefront: boolean;
}

export function useEventProduct(productId: string | null | undefined) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['event-product', currentTenant?.id, productId],
    queryFn: async (): Promise<EventProduct | null> => {
      if (!currentTenant || !productId) return null;
      const { data, error } = await supabase.from('products')
        .select('id, name, slug, description, price, images, featured_image, is_active, hide_from_storefront')
        .eq('tenant_id', currentTenant.id).eq('id', productId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id as string,
        name: (data.name as string) ?? '',
        slug: (data.slug as string) ?? '',
        description: (data.description as string | null) ?? null,
        price: Number(data.price ?? 0),
        images: (data.images as string[] | null) ?? [],
        featured_image: (data.featured_image as string | null) ?? null,
        is_active: Boolean(data.is_active),
        hide_from_storefront: Boolean(data.hide_from_storefront),
      };
    },
    enabled: !!currentTenant && !!productId,
  });
}

function useInvalidateEvent(eventId: string | undefined) {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return () => {
    void qc.invalidateQueries({ queryKey: ['event-product', currentTenant?.id] });
    void qc.invalidateQueries({ queryKey: ['event-detail', currentTenant?.id, eventId] });
    void qc.invalidateQueries({ queryKey: ['event-detail-ticket-types', currentTenant?.id, eventId] });
    void qc.invalidateQueries({ queryKey: ['event-dashboard-events'] });
    void qc.invalidateQueries({ queryKey: ['event-readiness-ticket-types'] });
  };
}

export function useUpdateEventProduct(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidateEvent(eventId);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<EventProduct, 'name' | 'description' | 'images' | 'featured_image' | 'hide_from_storefront' | 'price'>> }) => {
      if (!currentTenant) throw new Error('no_tenant');
      const { error } = await supabase.from('products').update(patch as never).eq('id', id).eq('tenant_id', currentTenant.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export interface TicketTypeInput {
  /** Bestaande rij (event_ticket_types.id + product_id), of null voor een nieuw type. */
  existing: { id: string; product_id: string } | null;
  name: string;
  price: number;
  sub_capacity: number | null;
  sales_start: string | null;
  sales_end: string | null;
  reentry_policy: ReentryPolicy;
  is_active: boolean;
  /** EB-TYPES-1: eigen early-bird-prijs (alleen extra types; het standaardtype volgt de datum). */
  early_bird_price: number | null;
  /** Nieuw type: ook toevoegen aan de andere komende datums van dit event. */
  apply_to_other_dates: boolean;
}

export function useSaveTicketType(eventId: string | undefined, mainProductId: string | null | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidateEvent(eventId);
  return useMutation({
    mutationFn: async (input: TicketTypeInput) => {
      if (!currentTenant || !eventId || !mainProductId) throw new Error('no_event');
      const tenantId = currentTenant.id;
      const typeFields = {
        sub_capacity: input.sub_capacity,
        sales_start: input.sales_start,
        sales_end: input.sales_end,
        reentry_policy: input.reentry_policy,
        is_active: input.is_active,
        ...(input.existing?.product_id === mainProductId ? {} : { early_bird_price: input.early_bird_price }),
      };

      if (input.existing) {
        // Het standaardtype is het event zelf: de naam blijft die van het event.
        const productPatch: Record<string, unknown> = { price: input.price };
        if (input.existing.product_id !== mainProductId) productPatch.name = input.name.trim();
        const { error: pErr } = await supabase.from('products').update(productPatch as never)
          .eq('id', input.existing.product_id).eq('tenant_id', tenantId);
        if (pErr) throw pErr;
        const { error } = await supabase.from('event_ticket_types').update(typeFields as never)
          .eq('id', input.existing.id).eq('tenant_id', tenantId);
        if (error) throw error;
        return input.existing.product_id;
      }

      // Nieuw type = nieuw, verborgen ticketproduct.
      const { data: main } = await supabase.from('products').select('slug').eq('id', mainProductId).eq('tenant_id', tenantId).maybeSingle();
      const base = `${(main as { slug?: string } | null)?.slug ?? 'event'}-${slugBase(input.name)}`;
      const { data: taken } = await supabase.from('products').select('slug').eq('tenant_id', tenantId).like('slug', `${base}%`);
      const { data: product, error: pErr } = await supabase.from('products').insert({
        tenant_id: tenantId,
        name: input.name.trim(),
        slug: uniqueSlug(base, (taken ?? []).map((r) => r.slug as string)),
        price: input.price,
        product_type: 'ticket',
        requires_shipping: false,
        track_inventory: false,
        stock: 0,
        is_active: true,
        hide_from_storefront: true,
        short_description: '',
      } as never).select('id').single();
      if (pErr || !product) throw pErr ?? new Error('product_failed');
      const productId = (product as { id: string }).id;

      let eventIds = [eventId];
      if (input.apply_to_other_dates) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: others } = await supabase.from('event_details').select('id')
          .eq('tenant_id', tenantId).eq('product_id', mainProductId)
          .gte('event_date', today).in('status', ['scheduled', 'confirmed']);
        eventIds = [...new Set([eventId, ...((others ?? []).map((r) => r.id as string))])];
      }
      const { count } = await supabase.from('event_ticket_types').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('event_detail_id', eventId);
      const rows = eventIds.map((id) => ({
        tenant_id: tenantId, event_detail_id: id, product_id: productId, sort_order: (count ?? 0), ...typeFields,
      }));
      const { error } = await supabase.from('event_ticket_types').insert(rows as never);
      if (error) {
        await supabase.from('products').delete().eq('id', productId).eq('tenant_id', tenantId);
        throw error;
      }
      return productId;
    },
    onSuccess: invalidate,
  });
}
