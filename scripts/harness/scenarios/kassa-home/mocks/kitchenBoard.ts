// Bonnen voor het harnas: twee rondes voor de bar en één voor de keuken. Status wijzigen werkt lokaal.
import { useReducer } from 'react';
import { cardFromTicket, type KitchenStatus, type TicketRow, type KitchenCard } from '@/components/admin/kitchen/kitchenModel';
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const row = (id: string, station: string, table: string, items: [number, string][], status: string, min: number): TicketRow => ({
  id, source: 'table', order_id: null, service_type: 'eat_in', requested_time: null, customer_label: table, customer_phone: null, note: null,
  items: items.map(([quantity, name]) => ({ quantity, name })), total: null, paid: false, status, status_at: ago(min), created_at: ago(min),
  table_label: table, station_id: station, round_id: id,
});
const tickets: TicketRow[] = [
  row('k1', 's-bar', '4', [[4, 'Pils'], [2, 'Kriek']], 'new', 2),
  row('k2', 's-bar', 'Ter-2', [[2, 'Aperol spritz']], 'preparing', 6),
  row('k3', 's-keuken', '4', [[1, 'Bittergarnituur (8 st.)']], 'new', 3),
  row('k4', 's-keuken', 'B2', [[2, 'Croque monsieur']], 'preparing', 9),
];
const listeners: (() => void)[] = [];
export function useKitchenBoard() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  if (!listeners.includes(force)) listeners.push(force);
  const cards: KitchenCard[] = tickets.map(cardFromTicket);
  const setStatus = {
    isPending: false,
    mutate: ({ card, status }: { card: KitchenCard; status: KitchenStatus }) => {
      const t = tickets.find((x) => x.id === card.ticketId);
      if (t) { t.status = status; t.status_at = new Date().toISOString(); }
      listeners.forEach((f) => f());
    },
  };
  return { cards, isLoading: false, error: null, setStatus, lastUpdated: Date.now() };
}
