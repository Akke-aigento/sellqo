// EVENT-WIZARD-1 — één event aanmaken in één keer: ticketproduct + datum(s) + (optioneel)
// een scanlink voor de deur. De trigger op event_details maakt per datum het tickettype en
// de ingang (EVENT-FLOW-1); daarna passen we het tickettype aan met het verkoopvenster.
// Onder de motorkap blijft een event een ticketproduct, dus de storefront-api en custom
// frontends (zoals Fonske) zien niets nieuws.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { slugBase, uniqueSlug } from '@/lib/eventSeries';

export interface NewEventInput {
  name: string;
  description: string;
  image: string | null;
  /** Nog niet tonen in de webshop (en dus ook niet op custom frontends die get_products lezen). */
  hidden: boolean;
  dates: string[];
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  meeting_point: string | null;
  price: number;
  capacity: number | null;
  min_attendees: number;
  early_bird_price: number | null;
  early_bird_quantity: number | null;
  /** ISO-tijdstip; leeg = verkoop loopt tot het event. */
  sales_end: string | null;
  scanner_name: string | null;
}

export interface NewEventResult {
  product_id: string;
  event_ids: string[];
  scanner_token: string | null;
}

export function useCreateEvent() {
  const { currentTenant } = useTenant();
  const { enforceLimit } = useUsageLimits();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewEventInput): Promise<NewEventResult> => {
      if (!currentTenant) throw new Error('no_tenant');
      if (input.dates.length === 0) throw new Error('no_dates');
      const limit = await enforceLimit('products');
      if (!limit.allowed) throw new Error('limit');
      const tenantId = currentTenant.id;

      // 1. Ticketproduct met een unieke slug.
      const base = slugBase(input.name);
      const { data: existing } = await supabase.from('products').select('slug')
        .eq('tenant_id', tenantId).like('slug', `${base}%`);
      const slug = uniqueSlug(base, (existing ?? []).map((r) => r.slug as string));
      const { data: product, error: pErr } = await supabase.from('products').insert({
        tenant_id: tenantId,
        name: input.name.trim(),
        slug,
        description: input.description.trim() || null,
        short_description: '',
        price: input.price,
        product_type: 'ticket',
        requires_shipping: false,
        track_inventory: false,
        stock: 0,
        is_active: true,
        hide_from_storefront: input.hidden,
        images: input.image ? [input.image] : [],
        featured_image: input.image,
      } as never).select('id').single();
      if (pErr || !product) throw pErr ?? new Error('product_failed');
      const productId = (product as { id: string }).id;

      try {
        // 2. Datums. De trigger maakt per datum tickettype + ingang.
        const rows = input.dates.map((d) => ({
          tenant_id: tenantId,
          product_id: productId,
          event_date: d,
          start_time: input.start_time,
          end_time: input.end_time,
          location_name: input.location_name,
          meeting_point: input.meeting_point,
          capacity: input.capacity,
          min_attendees: input.min_attendees,
          status: 'scheduled',
          early_bird_price: input.early_bird_price,
          early_bird_quantity: input.early_bird_price != null ? input.early_bird_quantity : null,
        }));
        const { data: events, error: eErr } = await supabase.from('event_details').insert(rows).select('id, event_date');
        if (eErr || !events) throw eErr ?? new Error('dates_failed');
        const eventIds = (events as { id: string; event_date: string }[])
          .sort((a, b) => a.event_date.localeCompare(b.event_date)).map((e) => e.id);

        // 3. Verkoopvenster op het tickettype dat de trigger aanmaakte.
        if (input.sales_end) {
          const { error: tErr } = await supabase.from('event_ticket_types')
            .update({ sales_end: input.sales_end })
            .eq('tenant_id', tenantId).eq('product_id', productId).in('event_detail_id', eventIds);
          if (tErr) throw tErr;
        }

        // 4. Scanlink voor de eerste datum (de rest maak je op de eventpagina).
        let scannerToken: string | null = null;
        if (input.scanner_name) {
          const { data: zone } = await supabase.from('event_zones').select('id')
            .eq('tenant_id', tenantId).eq('event_detail_id', eventIds[0]).eq('is_default', true).maybeSingle();
          if (zone) {
            const { data: access } = await supabase.from('event_scanner_access').insert({
              tenant_id: tenantId,
              event_detail_id: eventIds[0],
              zone_id: (zone as { id: string }).id,
              name: input.scanner_name,
            } as never).select('access_token').single();
            scannerToken = (access as { access_token?: string } | null)?.access_token ?? null;
          }
        }
        return { product_id: productId, event_ids: eventIds, scanner_token: scannerToken };
      } catch (e) {
        // Geen half event achterlaten: datums (met hun tickettypes en zones) en product weg.
        const { data: evs } = await supabase.from('event_details').select('id').eq('product_id', productId).eq('tenant_id', tenantId);
        const ids = (evs ?? []).map((r) => r.id as string);
        if (ids.length > 0) {
          await supabase.from('event_ticket_types').delete().in('event_detail_id', ids).eq('tenant_id', tenantId);
          await supabase.from('event_zones').delete().in('event_detail_id', ids).eq('tenant_id', tenantId);
          await supabase.from('event_details').delete().in('id', ids).eq('tenant_id', tenantId);
        }
        await supabase.from('products').delete().eq('id', productId).eq('tenant_id', tenantId);
        throw e;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event-dashboard-events'] });
      void queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
    },
  });
}
