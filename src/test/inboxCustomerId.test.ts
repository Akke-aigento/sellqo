import { describe, expect, it } from 'vitest';
import { realCustomerId } from '../../supabase/functions/_shared/customerId';
import { groupConversations, type InboxMessage } from '@/hooks/useInbox';

// INBOX-REPLY-1 — antwoorden op berichten zonder gekoppelde klant.

const UUID = '3f2b1c9e-8a7d-4e6f-9b0c-1d2e3f4a5b6c';

describe('realCustomerId', () => {
  it('echte uuid → mee', () => {
    expect(realCustomerId(UUID)).toBe(UUID);
    expect(realCustomerId(UUID.toUpperCase())).toBe(UUID.toUpperCase());
  });

  it('de gesprekssleutel van 29-09 → null (was de uuid-fout)', () => {
    expect(realCustomerId('administratie@vanempel.nl::dual-port usb wall sockets for campervans')).toBeNull();
  });

  it('leeg, undefined, null of geen string → null', () => {
    expect(realCustomerId(undefined)).toBeNull();
    expect(realCustomerId(null)).toBeNull();
    expect(realCustomerId('')).toBeNull();
    expect(realCustomerId(42)).toBeNull();
    expect(realCustomerId(`${UUID} `)).toBeNull();
  });
});

const msg = (over: Partial<InboxMessage>): InboxMessage => ({
  id: 'm1', tenant_id: 't1', customer_id: null, order_id: null, quote_id: null,
  direction: 'inbound', subject: 'Dual-port USB wall sockets', body_html: '', body_text: null,
  from_email: 'administratie@vanempel.nl', to_email: 'info@vanxcel.com', reply_to_email: 'administratie@vanempel.nl',
  channel: 'web' as InboxMessage['channel'], delivery_status: 'delivered', whatsapp_status: null,
  read_at: null, read_by: null, replied_at: null, reply_message_id: null, sent_at: null,
  created_at: '2026-09-29T09:59:52Z', updated_at: '2026-09-29T09:59:52Z',
  customers: null,
  ...over,
});

describe('groupConversations', () => {
  it('bericht zonder klant → afgeleide klant zonder id; de sleutel blijft het gesprek-id', () => {
    const [convo] = groupConversations([msg({})]);
    expect(convo.customer?.id).toBeNull();
    expect(realCustomerId(convo.customer?.id)).toBeNull();
    expect(convo.customer?.email).toBe('administratie@vanempel.nl');
    expect(convo.id).toBe('administratie@vanempel.nl::dual-port usb wall sockets');
  });

  it('bericht met klant → echte uuid als klant-id', () => {
    const [convo] = groupConversations([msg({
      customer_id: UUID,
      customers: {
        id: UUID, first_name: 'Van', last_name: 'Empel', email: 'administratie@vanempel.nl',
        phone: null, whatsapp_number: null,
      },
    })]);
    expect(convo.customer?.id).toBe(UUID);
    expect(realCustomerId(convo.customer?.id)).toBe(UUID);
  });
});

describe('groupConversations — naam van de afzender (MAIL-REPLY-FORMAT-1)', () => {
  it('contactformulier zonder klant → naam uit context_data, e-mail kaal adres', () => {
    const [convo] = groupConversations([msg({ context_data: { source: 'contact_form', name: 'Cissy' } })]);
    expect(convo.customer?.name).toBe('Cissy');
    expect(convo.customer?.email).toBe('administratie@vanempel.nl');
  });

  it('inkomende mail met From-header → weergavenaam, e-mail zonder <>', () => {
    const [convo] = groupConversations([msg({ from_email: 'Cissy Janssen <cissy@x.nl>', channel: 'email' as InboxMessage['channel'] })]);
    expect(convo.customer?.name).toBe('Cissy Janssen');
    expect(convo.customer?.email).toBe('cissy@x.nl');
  });

  it('alleen een uitgaand bericht → de ontvanger, niet ons eigen adres', () => {
    const [convo] = groupConversations([msg({ direction: 'outbound', from_email: 'info@vanxcel.com', to_email: 'klant@x.nl' })]);
    expect(convo.customer?.email).toBe('klant@x.nl');
  });
});
