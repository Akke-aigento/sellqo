// Bonnen voor het harnas: twee rondes voor de bar en één voor de keuken. Status wijzigen werkt lokaal.
import { useReducer } from 'react';
import { cardFromTicket, type KitchenStatus, type TicketRow, type KitchenCard } from '@/components/admin/kitchen/kitchenModel';
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
type Item = [number, string] | [number, string, { note?: string; allergens?: string[]; course?: number; waiting?: boolean }];
const row = (id: string, station: string, table: string, items: Item[], status: string, min: number, extra: Partial<TicketRow> = {}): TicketRow => ({
  id, source: 'table', order_id: null, service_type: 'eat_in', requested_time: null, customer_label: table, customer_phone: null, note: null,
  items: items.map(([quantity, name, x]) => ({ quantity, name, ...(x ?? {}) })), total: null, paid: false, status, status_at: ago(min), created_at: ago(min),
  table_label: table, station_id: station, round_id: id, ...extra,
});
// KEUKEN-VEILIG-1: QR-opmerking op elke bon van de ronde (k1 + k3), lijnopmerking, allergenen, te laat (k4), klaar (k5).
const QR = 'QR Lotte · allergie noten, graag zonder';
const tickets: TicketRow[] = [
  row('k1', 's-bar', '4', [[4, 'Pils', { note: QR }], [2, 'Kriek']], 'new', 2, { note: QR }),
  row('k2', 's-bar', 'Ter-2', [[2, 'Aperol spritz', { allergens: ['sulphites'] }]], 'preparing', 12),
  // GANGEN-1: gang 1 nu, croque (gang 2) wacht op vrijgave.
  row('k3', 's-keuken', '4', [[1, 'Bittergarnituur (8 st.)', { allergens: ['gluten', 'milk', 'mustard'], course: 1 }], [2, 'Croque monsieur', { course: 2, waiting: true }]], 'new', 3, { note: QR }),
  row('k4', 's-keuken', 'B2', [[2, 'Croque monsieur', { note: 'één zonder hesp', allergens: ['gluten', 'milk'] }]], 'preparing', 24),
  row('k5', 's-keuken', '4', [[1, 'Kaaskroketten']], 'ready', 1, { check_id: 'c1' }),
];
const listeners: (() => void)[] = [];
export const BOARD_POLL_FAST = 3_000;
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
  return { cards, isLoading: false, error: null, setStatus, busyKeys: new Set<string>(), lastUpdated: Date.now() };
}
