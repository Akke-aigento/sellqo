import { describe, expect, it } from 'vitest';
import { buildContactFormForward } from '../../supabase/functions/_shared/contactFormForward.ts';

// MAIL-SENDER-1: het doorgestuurde contactformulier komt van het SellQo-adres van
// de winkel, maar "antwoorden" gaat naar de bezoeker — nooit naar het supportadres.
const base = {
  tenant: { name: 'VanXcel', inbound_email_prefix: 'vanxcel', support_email: 'info@vanxcel.com' },
  forwardAddress: 'eigenaar@vanxcel.com',
  senderName: 'Jan Klant',
  senderEmail: 'jan@klant.be',
  subject: 'Vraag over maat',
  message: 'Is deze in maat L te krijgen?',
};

describe('buildContactFormForward', () => {
  it('From = winkeladres op mail.sellqo.app, Reply-To = de bezoeker', () => {
    const p = buildContactFormForward(base);
    expect(p.from).toBe('VanXcel <vanxcel@mail.sellqo.app>');
    expect(p.reply_to).toBe('jan@klant.be');
    expect(p.reply_to).not.toBe(base.tenant.support_email);
    expect(p.to).toEqual(['eigenaar@vanxcel.com']);
    expect(p.subject).toBe('[Contact] Vraag over maat');
  });

  it('escapet de invoer van de bezoeker', () => {
    const p = buildContactFormForward({ ...base, senderName: '<script>x</script>', message: '<img src=x onerror=alert(1)>' });
    expect(p.html).not.toContain('<script>');
    expect(p.html).not.toContain('<img');
    expect(p.html).toContain('&lt;script&gt;');
  });
});
