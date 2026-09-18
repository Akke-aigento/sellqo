import { describe, expect, it } from 'vitest';
import { EMAIL_SENDERS, tenantSender } from '../../supabase/functions/_shared/emailSenders.ts';

// MAIL-SENDER-1: platformmail alleen via info@sellqo.app; winkelmail vanaf
// <prefix>@mail.sellqo.app met de klantcontact-e-mail als Reply-To.

describe('Stream A', () => {
  it('verstuurt alles vanaf info@sellqo.app', () => {
    for (const s of Object.values(EMAIL_SENDERS)) {
      expect(s.from).toMatch(/<info@sellqo\.app>$/);
      if (s.replyTo) expect(s.replyTo).toBe('info@sellqo.app');
    }
    expect(EMAIL_SENDERS.billing.from).toBe('SellQo Billing <info@sellqo.app>');
    expect(EMAIL_SENDERS.security.from).toBe('SellQo Security <info@sellqo.app>');
  });
});

describe('tenantSender', () => {
  it('bouwt From en Reply-To voor een winkel met eigen supportadres', () => {
    expect(tenantSender({ name: 'VanXcel', inbound_email_prefix: 'vanxcel', support_email: 'info@vanxcel.com' }))
      .toEqual({ from: 'VanXcel <vanxcel@mail.sellqo.app>', replyTo: 'info@vanxcel.com' });
  });

  it('antwoorden gaan naar de SellQo-inbox zonder supportadres', () => {
    expect(tenantSender({ name: 'Loveke', slug: 'loveke' }).replyTo).toBe('loveke@mail.sellqo.app');
  });

  it('ontdoet de naam van tekens die de header breken', () => {
    expect(tenantSender({ name: 'Bakker "De <Korst>"', slug: 'korst' }).from).toBe('Bakker De Korst <korst@mail.sellqo.app>');
    expect(tenantSender({ name: '   ', slug: 'korst' }).from).toBe('SellQo <korst@mail.sellqo.app>');
  });

  it('valt zonder geldige prefix terug op SellQo <info@sellqo.app>', () => {
    expect(tenantSender({ name: 'Kapot', inbound_email_prefix: 'niet geldig', slug: null }))
      .toEqual({ from: 'SellQo <info@sellqo.app>', replyTo: 'info@sellqo.app' });
  });
});
