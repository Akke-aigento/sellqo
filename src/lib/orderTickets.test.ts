import { describe, expect, it } from 'vitest';
import { maskTicketCode, sortOrderTickets, ticketStatusKey, type OrderTicketRow } from './orderTickets';

const row = (id: string, date: string, time: string | null, seq: number): OrderTicketRow => ({
  id, status: 'valid', seq, attendee_name: null, seat_label: null, qr_token: 'x', checked_in_at: null,
  product_id: null, products: null,
  event_details: { event_date: date, start_time: time, product_id: null, products: null },
});

describe('orderTickets', () => {
  it('maskeert de code tot de laatste 6 tekens', () => {
    expect(maskTicketCode('a1b2c3d4e5f6a7b8c9d0')).toBe('••••B8C9D0');
    expect(maskTicketCode('abc')).toBe('•••');
    expect(maskTicketCode(null)).toBe('');
  });

  it('kent een i18n-sleutel per status, met terugval', () => {
    expect(ticketStatusKey('checked_in')).toBe('status_checked_in');
    expect(ticketStatusKey('refunded')).toBe('status_refunded');
    expect(ticketStatusKey('raar')).toBe('status_unknown');
  });

  it('sorteert op datum, tijd en volgnummer', () => {
    const out = sortOrderTickets([
      row('c', '2026-10-25', '20:00:00', 1),
      row('b', '2026-10-24', '21:00:00', 2),
      row('a', '2026-10-24', '21:00:00', 1),
    ]);
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});
