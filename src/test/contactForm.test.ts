import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALIAS_SUBJECT,
  isContactFormAlias,
  normalizeContactAlias,
  submitContactForm,
} from '../../supabase/functions/_shared/contactForm.ts';

// UNIFIED-MAIL-1 — drie contactformulieren leverden nooit af (verkeerde actienaam).
// Fixtures: de exacte payloads uit de frontend-code (gelezen 29-09).

type Row = Record<string, unknown>;

/** Nep-Supabase: genoeg voor submitContactForm, legt elke insert vast. */
function fakeSupabase() {
  const inserts: Array<{ table: string; row: Row }> = [];
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data: table === 'tenants' ? { notification_email: null, owner_email: 'info@shop.be', name: 'Shop' } : null,
          error: null,
        }),
        insert(row: Row) {
          inserts.push({ table, row });
          const done = { data: { id: 'msg-1' }, error: null };
          return {
            select: () => ({ single: async () => done }),
            then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }),
          };
        },
      };
      return builder;
    },
  };
  return { client, inserts };
}

/** Wat de router doet voor een alias. */
async function viaAlias(params: Row) {
  const { client, inserts } = fakeSupabase();
  const alias = normalizeContactAlias(params);
  const result = await submitContactForm(client, 't1', alias.params, { extraContext: alias.extraContext });
  return { result, inserts };
}

const message = (inserts: Array<{ table: string; row: Row }>) => inserts.find((i) => i.table === 'customer_messages')?.row;
const notification = (inserts: Array<{ table: string; row: Row }>) => inserts.find((i) => i.table === 'notifications')?.row;

describe('aliassen', () => {
  it('submit_contact en contact zijn aliassen; submit_contact_form niet', () => {
    expect(isContactFormAlias('submit_contact')).toBe(true);
    expect(isContactFormAlias('contact')).toBe(true);
    expect(isContactFormAlias('submit_contact_form')).toBe(false);
    expect(isContactFormAlias('get_config')).toBe(false);
  });
});

describe.each([
  // Loveke — src/pages/Contact.tsx → proxy-default `contact`
  ['Loveke (contact)', { name: 'An', email: 'an@x.be', subject: 'Maat', message: 'Heb je dit in M?' }, 'Maat'],
  // Mancini Milano — src/integrations/sellqo/api.ts → `submit_contact`
  ['Mancini Milano (submit_contact)', { name: 'Luca', email: 'luca@x.it', subject: 'Order', message: 'Where is it?' }, 'Order'],
  // Benny Rich — src/routes/contact.tsx → `submit_contact`, zonder subject
  ['Benny Rich (submit_contact)', { name: 'Sam', email: 'sam@x.com', message: 'Hi there' }, DEFAULT_ALIAS_SUBJECT],
])('%s', (_label, payload, expectedSubject) => {
  it('bericht opgeslagen, melding aangemaakt, respons zoals submit_contact_form', async () => {
    const { result, inserts } = await viaAlias(payload);
    expect(result).toEqual({ success: true, message_id: 'msg-1' });
    const msg = message(inserts)!;
    expect(msg).toMatchObject({
      tenant_id: 't1', direction: 'inbound', channel: 'web', context_type: 'contact_form',
      from_email: payload.email, reply_to_email: payload.email, subject: expectedSubject,
      body_text: payload.message,
    });
    expect(msg.context_data).toEqual({ source: 'contact_form', name: payload.name, order_number: null });
    expect(notification(inserts)).toMatchObject({ category: 'messages', type: 'contact_form_inbound' });
  });
});

describe('onbekende velden', () => {
  it('gaan niet verloren maar staan in context_data.extra_fields; transportvelden niet', async () => {
    const { inserts } = await viaAlias({ name: 'An', email: 'an@x.be', message: 'Hoi', phone: '+32 470', locale: 'nl', tenant_id: 'x' });
    expect(message(inserts)!.context_data).toEqual({
      source: 'contact_form', name: 'An', order_number: null, extra_fields: { phone: '+32 470' },
    });
  });
});

describe('submit_contact_form zelf (VanXcel) blijft gelijk', () => {
  it('zonder extra context: exact de vorige context_data', async () => {
    const { client, inserts } = fakeSupabase();
    const result = await submitContactForm(client, 't1', {
      name: 'Cissy', email: 'administratie@vanempel.nl', subject: 'USB', message: 'Leverbaar?', orderNumber: '#9',
    });
    expect(result).toEqual({ success: true, message_id: 'msg-1' });
    expect(message(inserts)!.context_data).toEqual({ source: 'contact_form', name: 'Cissy', order_number: '#9' });
    expect(message(inserts)!.subject).toBe('USB');
  });

  it('zonder onderwerp faalt hij nog steeds (geen standaardonderwerp buiten de aliassen)', async () => {
    const { client } = fakeSupabase();
    const result = await submitContactForm(client, 't1', { name: 'A', email: 'a@b.be', message: 'x' });
    expect(result).toEqual({ success: false, error: 'Subject is required (max 300 chars)' });
  });

  it('validatiefouten zijn dezelfde via een alias', async () => {
    const { result } = await viaAlias({ name: 'A', email: 'geen-adres', message: 'x' });
    expect(result).toEqual({ success: false, error: 'Valid email is required' });
  });
});

