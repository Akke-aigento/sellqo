// FOOD-2 — data voor het keukenscherm. Polling in plaats van realtime: één lichte query per
// tablet, geen WAL-listeners (zie de kostenlessen over realtime).
// KEUKEN-VEILIG-1: het keuken-/barscherm peilt elke 3 s (zoals de rekeningen), het dashboard blijft
// op 10 s. Enkel zolang het scherm zichtbaar is (geen poll in de achtergrond), en afgewerkte
// tafel-/kassabonnen ouder dan 12 uur komen niet meer mee (die toont het bord toch niet).
import { useMemo } from 'react';
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
// KASSA-MOBIEL-1: de client van de omgeving (kassa-client in de kassa, anders beheer).
import { useSupabaseClient } from '@/lib/supabaseScope';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { addonOptionIds, buildBoard, notifiesCustomer, type KitchenCard, type KitchenStatus, type OrderRow, type TicketRow } from './kitchenModel';

const WINDOW_MS = 3 * 24 * 3600_000;
const DONE_KEEP_MS = 12 * 3600_000;
/** Keuken- en barscherm (kassa en /admin/keuken). */
export const BOARD_POLL_FAST = 3_000;
const BOARD_POLL_DEFAULT = 10_000;

/** KASSA-ACCOUNT-1: `kassaDevice` = het keukenbord op SellQo Kassa. Een kassatoestel heeft geen leesrecht op
 *  `orders` (klantgegevens); het krijgt de webshop-/QR-bestellingen via de smalle RPC kassa_kitchen_orders
 *  (zelfde vorm, zelfde venster). Beheer (/admin/keuken, dashboard) blijft ongewijzigd op REST. */
export function useKitchenBoard(nowMs: number, enabled = true, intervalMs = BOARD_POLL_DEFAULT, opts: { kassaDevice?: boolean } = {}) {
  const { t } = useTranslation();
  const supabase = useSupabaseClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const key = ['kitchen-board', tenantId, opts.kassaDevice ? 'kassa' : 'admin'];
  const mutationKey = ['kitchen-board-status', tenantId];

  const query = useQuery({
    queryKey: key,
    enabled: enabled && !!tenantId,
    refetchInterval: intervalMs,
    // Verborgen tabblad of scherm uit: niet peilen (DB-kost). Bij terugkomen haalt react-query meteen op.
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const doneSince = new Date(Date.now() - DONE_KEEP_MS).toISOString();
      const ordersQuery = opts.kassaDevice
        ? supabase.rpc('kassa_kitchen_orders' as never, { p_tenant_id: tenantId! } as never)
        : supabase.from('orders')
          .select('id, order_number, created_at, service_type, requested_time, customer_name, customer_phone, notes, total, payment_status, payment_method, status, shipping_address, table_label, order_items(product_name, variant_title, quantity, addons, products(allergens))')
          .eq('tenant_id', tenantId!).not('service_type', 'is', null).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(300);
      const [o, t] = await Promise.all([
        ordersQuery,
        // Webshopbonnen altijd (ze bepalen de status van hun order), andere bonnen enkel open of recent.
        supabase.from('kitchen_tickets').select('*').eq('tenant_id', tenantId!).gte('created_at', since)
          .or(`order_id.not.is.null,status.in.(new,preparing,ready),status_at.gte.${doneSince}`)
          .order('created_at', { ascending: false }).limit(500),
      ]);
      if (o.error) throw o.error;
      if (t.error) throw t.error;
      const orders = (o.data || []) as unknown as OrderRow[];
      // KEUKEN-VEILIG-1b: allergenen van gekozen extra's (webshop). Enkel een vraag als er extra's zijn.
      const optionIds = [...new Set(orders.flatMap((x) => (x.order_items || []).flatMap((i) => addonOptionIds(i.addons))))].slice(0, 300);
      let addonAllergens: [string, string[]][] = [];
      if (optionIds.length) {
        const a = await supabase.from('product_addon_options').select('id, allergens').eq('tenant_id', tenantId!).in('id', optionIds);
        if (!a.error) addonAllergens = ((a.data || []) as { id: string; allergens: string[] | null }[]).map((x) => [x.id, x.allergens ?? []]);
      }
      return { orders, tickets: (t.data || []) as unknown as TicketRow[], addonAllergens };
    },
  });

  const cards = useMemo(() => (query.data ? buildBoard(query.data.orders, query.data.tickets, nowMs, undefined, new Map(query.data.addonAllergens)) : []), [query.data, nowMs]);

  const setStatus = useMutation({
    mutationKey,
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
    // KEUKEN-VEILIG-1: meerdere bonnen tegelijk mogelijk; bij een fout niet de hele lijst terugzetten
    // (dat zou ook de klik op een andere bon ongedaan maken), wel melden. onSettled haalt de echte stand op.
    onError: () => { toast.error(t('admin.kitchen.status_failed')); },
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

  // KEUKEN-VEILIG-1: "bezig" per bon, niet voor het hele bord (een tik op één bon blokkeerde alle knoppen).
  const pendingKeys = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: (m) => (m.state.variables as { card?: KitchenCard } | undefined)?.card?.key ?? '',
  });
  const busyKeys = useMemo(() => new Set(pendingKeys.filter(Boolean)), [pendingKeys]);

  return { cards, isLoading: query.isLoading, error: query.error, setStatus, busyKeys, lastUpdated: query.dataUpdatedAt };
}
