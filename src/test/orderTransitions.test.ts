import { describe, expect, it } from 'vitest';
import {
  ALL_ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  getAllowedTransitions,
  getValidNextStatuses,
  isEmailOnlyOrder,
} from '@/lib/orderTransitions';
import { emailOnlyAllows } from '../../supabase/functions/_shared/emailOnlyOrder';

// EVENT-ORDER-1 — een ticketbestelling staat na de ticketmail op delivered en
// moet nog annuleerbaar zijn. Fysieke bestellingen blijven exact zoals voorheen.

const TICKET = { id: 'p-ticket', product_type: 'ticket', token_amount: null };
const COMBI = { id: 'p-combi', product_type: 'ticket', token_amount: null }; // combiticket = ticket + ticket_bundle_items
const TOKENS = { id: 'p-tokens', product_type: 'digital', token_amount: 20 };
const SHIRT = { id: 'p-shirt', product_type: 'physical', token_amount: null };
const EBOOK = { id: 'p-ebook', product_type: 'digital', token_amount: null };

describe('isEmailOnlyOrder', () => {
  it('alleen tickets (event_detail_id) → ja', () => {
    expect(isEmailOnlyOrder([{ product_id: 'p-ticket', event_detail_id: 'e1' }], [TICKET])).toBe(true);
  });

  it('ticketregel zonder product meer (product verwijderd) maar met event → ja', () => {
    expect(isEmailOnlyOrder([{ product_id: null, event_detail_id: 'e1' }], [])).toBe(true);
  });

  it('combiticket (product_type ticket, geen event_detail_id op de regel) → ja', () => {
    expect(isEmailOnlyOrder([{ product_id: 'p-combi', event_detail_id: null }], [COMBI])).toBe(true);
  });

  it('muntenpakket (token_amount gezet) → ja', () => {
    expect(isEmailOnlyOrder([{ product_id: 'p-tokens' }], [TOKENS])).toBe(true);
  });

  it('ticket + munten + combi samen → ja', () => {
    expect(isEmailOnlyOrder(
      [
        { product_id: 'p-ticket', event_detail_id: 'e1' },
        { product_id: 'p-tokens' },
        { product_id: 'p-combi' },
      ],
      [TICKET, TOKENS, COMBI],
    )).toBe(true);
  });

  it('ticket + fysiek product → nee', () => {
    expect(isEmailOnlyOrder(
      [{ product_id: 'p-ticket', event_detail_id: 'e1' }, { product_id: 'p-shirt' }],
      [TICKET, SHIRT],
    )).toBe(false);
  });

  it('digitaal product zonder munten → nee', () => {
    expect(isEmailOnlyOrder([{ product_id: 'p-ebook' }], [EBOOK])).toBe(false);
  });

  it('onbekend product (niet gevonden) → nee', () => {
    expect(isEmailOnlyOrder([{ product_id: 'p-weg' }], [])).toBe(false);
  });

  it('regel zonder product en zonder event → nee', () => {
    expect(isEmailOnlyOrder([{ product_id: null, event_detail_id: null }], [])).toBe(false);
  });

  it('lege order → nee', () => {
    expect(isEmailOnlyOrder([], [TICKET])).toBe(false);
  });
});

describe('getAllowedTransitions / getValidNextStatuses', () => {
  it('zonder emailOnly: identiek aan de matrix, voor elke status', () => {
    for (const s of ALL_ORDER_STATUSES) {
      expect(getAllowedTransitions(s)).toEqual(ORDER_STATUS_TRANSITIONS[s]);
      expect(getAllowedTransitions(s, { emailOnly: false })).toEqual(ORDER_STATUS_TRANSITIONS[s]);
      expect(getValidNextStatuses(s)).toEqual([s, ...ORDER_STATUS_TRANSITIONS[s]]);
    }
  });

  it('fysieke order op delivered: geen annuleren', () => {
    expect(getValidNextStatuses('delivered')).toEqual(['delivered']);
  });

  it('e-mail-order op delivered: annuleren mag', () => {
    expect(getValidNextStatuses('delivered', { emailOnly: true })).toEqual(['delivered', 'cancelled']);
  });

  it('emailOnly verandert niets aan de andere statussen', () => {
    for (const s of ALL_ORDER_STATUSES.filter((x) => x !== 'delivered')) {
      expect(getAllowedTransitions(s, { emailOnly: true })).toEqual(ORDER_STATUS_TRANSITIONS[s]);
    }
  });

  it('geen dubbels als de basis de overgang al kent', () => {
    expect(getAllowedTransitions('pending', { emailOnly: true })).toEqual(['processing', 'cancelled']);
  });
});

describe('emailOnlyAllows (de server-kant)', () => {
  it('enkel delivered → cancelled', () => {
    expect(emailOnlyAllows('delivered', 'cancelled')).toBe(true);
    expect(emailOnlyAllows('delivered', 'processing')).toBe(false);
    expect(emailOnlyAllows('shipped', 'cancelled')).toBe(false);
    expect(emailOnlyAllows('cancelled', 'delivered')).toBe(false);
    expect(emailOnlyAllows('returned', 'cancelled')).toBe(false);
  });
});
