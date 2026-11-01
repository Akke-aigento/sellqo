import { describe, expect, it } from 'vitest';
import { ticketHtml } from './printTicket';
import type { KitchenCard } from './kitchenModel';
import type { TicketLabels } from './printTicket';

const L: TicketLabels = {
  lang: 'nl-BE', service: { pickup: 'AFHALEN', local_delivery: 'LEVERING', eat_in: 'TER PLAATSE' },
  order: 'BESTELLING', asap: 'ZSM', paid: 'BETAALD', toPay: 'TE BETALEN',
  source: (c) => `Webshop ${c.label}`, who: (c) => c.customer || '',
  toPayAmount: (a) => `TE BETALEN ${a}`, footer: (o, p) => `Besteld ${o} · afgedrukt ${p}`,
};

const card: KitchenCard = {
  key: 'o:1', source: 'webshop', orderId: '1', ticketId: null, label: '#1043', table: null, service: 'pickup',
  requestedTime: '2026-10-13T16:15:00Z', createdAt: '2026-10-13T15:50:00Z', customer: 'Jan <b>', phone: '0470', address: null,
  note: 'Zonder ui', items: [{ quantity: 2, name: 'Margherita', detail: 'Groot', addons: ['Ham'], note: 'goed doorbakken', allergens: ['gluten', 'milk'] }], total: 23.5, paid: false,
  status: 'new', statusAt: '2026-10-13T15:50:00Z', notified: false, stationId: null,
};

describe('ticketHtml', () => {
  it('toont soort, tijd, regels, extra\'s, opmerking en te betalen', () => {
    const h = ticketHtml(card, 'Pizzeria Roma', L);
    expect(h).toContain('AFHALEN');
    expect(h).toContain('<b>2x</b> Margherita');
    expect(h).toContain('+ Ham');
    expect(h).toContain('Zonder ui');
    expect(h).toContain('TE BETALEN EUR 23,50');
    expect(h).toContain('size: 80mm');
  });
  it('KEUKEN-VEILIG-1: lijnopmerking en allergenen staan vet op de bon, de algemene opmerking bovenaan', () => {
    const h = ticketHtml(card, 'X', { ...L, noteTitle: 'Opmerking', allergensTitle: 'Allergenen', allergen: (c) => (c === 'milk' ? 'Melk' : 'Gluten') });
    expect(h).toContain('<div class="lnote">&gt;&gt; goed doorbakken</div>');
    expect(h).toContain('Allergenen: Gluten, Melk');
    expect(h.indexOf('Zonder ui')).toBeLessThan(h.indexOf('Margherita'));
    expect(h).toContain('<div class="t">Opmerking</div>');
  });
  it('escapet klantgegevens', () => {
    expect(ticketHtml(card, 'X', L)).toContain('Jan &lt;b&gt;');
  });
  it('zonder gekozen tijd: ZSM; betaald', () => {
    const h = ticketHtml({ ...card, requestedTime: null, paid: true }, 'X', L);
    expect(h).toContain('AFHALEN ZSM');
    expect(h).toContain('BETAALD');
  });
});
