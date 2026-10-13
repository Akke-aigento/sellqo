import { describe, expect, it } from 'vitest';
import { buildBoard, cardFromOrder, notifiesCustomer, orderBelongsInKitchen, type OrderRow, type TicketRow } from './kitchenModel';

const NOW = Date.parse('2026-10-13T16:00:00Z');
const order = (over: Partial<OrderRow> = {}): OrderRow => ({
  id: 'o1', order_number: '#1001', created_at: '2026-10-13T15:30:00Z', service_type: 'pickup', requested_time: '2026-10-13T16:15:00Z',
  customer_name: 'Jan', customer_phone: '0470', notes: null, total: 23.5, payment_status: 'paid', payment_method: 'bancontact', status: 'processing',
  shipping_address: null,
  order_items: [{ product_name: 'Margherita', variant_title: 'Groot · Extra kaas, Ham', quantity: 2, addons: [{ name: 'Extra kaas' }, { name: 'Ham' }] }],
  ...over,
});
const ticket = (over: Partial<TicketRow> = {}): TicketRow => ({
  id: 't1', source: 'pos', order_id: null, service_type: 'eat_in', requested_time: null, customer_label: 'Tafel 4', customer_phone: null, note: null,
  items: [{ name: 'Durum', quantity: 1, addons: [{ name: 'Looksaus' }] }], total: 9, paid: true, status: 'new', status_at: '2026-10-13T15:55:00Z',
  created_at: '2026-10-13T15:55:00Z', ...over,
});

describe('kitchenModel', () => {
  it('neemt alleen betaalde of "betalen bij afhalen" webshoporders met service_type', () => {
    expect(orderBelongsInKitchen(order())).toBe(true);
    expect(orderBelongsInKitchen(order({ payment_status: 'pending', payment_method: 'bank_transfer' }))).toBe(false);
    expect(orderBelongsInKitchen(order({ payment_status: 'pending', payment_method: 'pay_on_pickup' }))).toBe(true);
    expect(orderBelongsInKitchen(order({ service_type: null }))).toBe(false);
    expect(orderBelongsInKitchen(order({ status: 'cancelled' }))).toBe(false);
  });

  it('haalt de extra\'s uit de varianttitel', () => {
    const c = cardFromOrder(order(), undefined);
    expect(c.items[0]).toEqual({ quantity: 2, name: 'Margherita', detail: 'Groot', addons: ['Extra kaas', 'Ham'] });
    expect(c.status).toBe('new');
  });

  it('voegt samen, volgt de keukenbon en sorteert op tijd', () => {
    const board = buildBoard(
      [order(), order({ id: 'o2', requested_time: '2026-10-13T17:00:00Z' })],
      [ticket(), { ...ticket({ id: 't2', order_id: 'o2', source: 'webshop', status: 'preparing' }) }],
      NOW,
    );
    expect(board.map((c) => c.key)).toEqual(['t:t1', 'o:o1', 'o:o2']);
    expect(board.find((c) => c.key === 'o:o2')?.status).toBe('preparing');
  });

  it('verbergt oude afgeronde bonnen en verre vooruitbestellingen', () => {
    const board = buildBoard(
      [order({ requested_time: '2026-10-15T16:00:00Z' })],
      [ticket({ status: 'done', status_at: '2026-10-12T20:00:00Z' }), ticket({ id: 't3', status: 'done', status_at: '2026-10-13T15:59:00Z' })],
      NOW,
    );
    expect(board.map((c) => c.key)).toEqual(['t:t3']);
  });

  it('mailt de klant alleen bij klaar (afhalen) of meegegeven (levering), één keer', () => {
    const pickup = cardFromOrder(order(), undefined);
    expect(notifiesCustomer(pickup, 'ready')).toBe(true);
    expect(notifiesCustomer(pickup, 'preparing')).toBe(false);
    const delivery = cardFromOrder(order({ service_type: 'local_delivery' }), undefined);
    expect(notifiesCustomer(delivery, 'ready')).toBe(false);
    expect(notifiesCustomer(delivery, 'done')).toBe(true);
    expect(notifiesCustomer({ ...pickup, notified: true }, 'ready')).toBe(false);
    expect(notifiesCustomer(cardFromTicketLike(), 'ready')).toBe(false);
  });
});

function cardFromTicketLike() {
  return { ...cardFromOrder(order(), undefined), orderId: null };
}

describe('bestellen aan tafel (HORECA-1)', () => {
  it('zet het tafelnummer voorop en neemt "betalen aan de toog" mee', () => {
    const o = order({ service_type: 'eat_in', table_label: '4', customer_name: 'Tafel 4', payment_status: 'pending', payment_method: 'pay_on_pickup', requested_time: null });
    expect(orderBelongsInKitchen(o)).toBe(true);
    const c = cardFromOrder(o, undefined);
    expect(c.customer).toBe('Tafel 4');
    expect(c.service).toBe('eat_in');
    expect(cardFromOrder({ ...o, customer_name: 'Sofie' }, undefined).customer).toBe('Tafel 4 · Sofie');
  });
});
