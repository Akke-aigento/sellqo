// FOOD-2 — data voor het keukenscherm. Polling (10 s) in plaats van realtime: één lichte
// query per tablet, geen WAL-listeners (zie de kostenlessen over realtime).
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { buildBoard, notifiesCustomer, type KitchenCard, type KitchenStatus, type OrderRow, type TicketRow } from './kitchenModel';

const WINDOW_MS = 3 * 24 * 3600_000;

export function useKitchenBoard(nowMs: number) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const key = ['kitchen-board', tenantId];

  const query = useQuery({
    queryKey: key,
    enabled: !!tenantId,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const [o, t] = await Promise.all([
        supabase.from('orders')
          .select('id, order_number, created_at, service_type, requested_time, customer_name, customer_phone, notes, total, payment_status, payment_method, status, shipping_address, table_label, order_items(product_name, variant_title, quantity, addons)')
          .eq('tenant_id', tenantId!).not('service_type', 'is', null).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(300),
        supabase.from('kitchen_tickets').select('*').eq('tenant_id', tenantId!).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(500),
      ]);
      if (o.error) throw o.error;
      if (t.error) throw t.error;
      return { orders: (o.data || []) as unknown as OrderRow[], tickets: (t.data || []) as unknown as TicketRow[] };
    },
  });

  const cards = useMemo(() => (query.data ? buildBoard(query.data.orders, query.data.tickets, nowMs) : []), [query.data, nowMs]);

  const setStatus = useMutation({
    mutationFn: async ({ card, status }: { card: KitchenCard; status: KitchenStatus }) => {
      const now = new Date().toISOString();
      if (card.ticketId && !card.ticketId.startsWith('tmp-')) {
        const { error } = await supabase.from('kitchen_tickets').update({ status, status_at: now, updated_at: now }).eq('id', card.ticketId);
        if (error) throw error;
        return;
      }
      // Webshoporder: de keukenbon ontstaat bij de eerste klik.
      const { error } = await supabase.from('kitchen_tickets').insert({
        tenant_id: tenantId!, source: 'webshop', order_id: card.orderId, service_type: card.service, requested_time: card.requestedTime,
        customer_label: card.customer, customer_phone: card.phone, status, status_at: now,
      });
      if (error?.code === '23505') {
        const { error: e2 } = await supabase.from('kitchen_tickets').update({ status, status_at: now, updated_at: now }).eq('order_id', card.orderId!);
        if (e2) throw e2;
      } else if (error) throw error;
    },
    // Meteen tonen; bij een fout haalt de volgende refetch de echte stand op.
    onMutate: async ({ card, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<{ orders: OrderRow[]; tickets: TicketRow[] }>(key);
      if (prev) {
        const now = new Date().toISOString();
        const tickets = card.ticketId
          ? prev.tickets.map((t) => (t.id === card.ticketId ? { ...t, status, status_at: now } : t))
          : [...prev.tickets, {
            id: `tmp-${card.orderId}`, source: 'webshop', order_id: card.orderId, service_type: card.service, requested_time: card.requestedTime,
            customer_label: card.customer, customer_phone: card.phone, note: null, items: null, total: null, paid: card.paid,
            status, status_at: now, created_at: now,
          }];
        qc.setQueryData(key, { ...prev, tickets });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    // FOOD-3 — klant mailen bij "Klaar" (afhalen) of "Meegegeven" (levering). Best-effort:
    // de functie doet het maar één keer en respecteert de winkelinstelling.
    onSuccess: async (_d, { card, status }) => {
      if (!notifiesCustomer(card, status)) return;
      const { data, error } = await supabase.functions.invoke('send-order-ready', { body: { order_id: card.orderId } });
      if (error) toast.error(t('admin.kitchen.notify_failed'));
      else if ((data as { success?: boolean } | null)?.success) toast.success(status === 'ready' ? t('admin.kitchen.notified_ready') : t('admin.kitchen.notified_on_the_way'));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { cards, isLoading: query.isLoading, error: query.error, setStatus, lastUpdated: query.dataUpdatedAt };
}
