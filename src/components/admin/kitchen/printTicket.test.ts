import { describe, expect, it } from 'vitest';
import { ticketHtml } from './printTicket';
import type { KitchenCard } from './kitchenModel';

const card: KitchenCard = {
  key: 'o:1', source: 'webshop', orderId: '1', ticketId: null, label: '#1043', service: 'pickup',
  requestedTime: '2026-10-13T16:15:00Z', createdAt: '2026-10-13T15:50:00Z', customer: 'Jan <b>', phone: '0470', address: null,
  note: 'Zonder ui', items: [{ quantity: 2, name: 'Margherita', detail: 'Groot', addons: ['Ham'] }], total: 23.5, paid: false,
  status: 'new', statusAt: '2026-10-13T15:50:00Z', notified: false,
};

describe('ticketHtml', () => {
  it('toont soort, tijd, regels, extra\'s, opmerking en te betalen', () => {
    const h = ticketHtml(card, 'Pizzeria Roma');
    expect(h).toContain('AFHALEN');
    expect(h).toContain('<b>2x</b> Margherita');
    expect(h).toContain('+ Ham');
    expect(h).toContain('Zonder ui');
    expect(h).toContain('TE BETALEN EUR 23,50');
    expect(h).toContain('size: 80mm');
  });
  it('escapet klantgegevens', () => {
    expect(ticketHtml(card, 'X')).toContain('Jan &lt;b&gt;');
  });
  it('zonder gekozen tijd: ZSM; betaald', () => {
    const h = ticketHtml({ ...card, requestedTime: null, paid: true }, 'X');
    expect(h).toContain('AFHALEN ZSM');
    expect(h).toContain('BETAALD');
  });
});
