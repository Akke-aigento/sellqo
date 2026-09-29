import { describe, expect, it } from 'vitest';
import {
  buildCustomerMessageEmail,
  customerMessageLayout,
} from '../../supabase/functions/_shared/customerMessageEmail.ts';
import type { TenantBrand } from '../../supabase/functions/_shared/tenantEmail.ts';

// MAIL-REPLY-FORMAT-1 — antwoord uit de inbox zonder automatische aanhef, groet en kop.

const brand: TenantBrand = {
  tenantId: 't1', tenantName: 'VanXcel', logoUrl: 'https://example.com/logo.png',
  primaryColor: '#111111', accentColor: '#ff7733', textColor: '#1a2332', mutedColor: '#6b7280',
  backgroundColor: '#f4f6f9', cardColor: '#ffffff', borderColor: '#e4e8ee', brandColor: '#111111',
  themeMode: 'light', headingFont: 'Inter', bodyFont: 'Inter', supportEmail: 'info@vanxcel.com',
  senderSource: {} as TenantBrand['senderSource'], address: 'Straat 1', city: 'Gent', country: 'BE',
  defaultLocale: 'nl',
};

const input = {
  brand,
  subject: 'Re: Dual-port USB wall sockets',
  bodyHtml: 'Goedemiddag Cissy,<br>Deze zijn uitverkocht.<br><br>Groet, Akke',
  customerName: 'administratie@vanempel.nl',
  contextType: 'general',
  contextData: {},
  replyToEmail: 'info@vanxcel.com',
};

describe('buildCustomerMessageEmail — inbox', () => {
  const { html } = buildCustomerMessageEmail({ ...input, layout: 'inbox' });

  it('geen kop, geen automatische aanhef, geen tweede groet', () => {
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('Beste ');
    expect(html).not.toContain('Met vriendelijke groet');
  });

  it('de tekst van de gebruiker staat er onveranderd in', () => {
    expect(html).toContain(input.bodyHtml);
  });

  it('huisstijl blijft: logo-chip, footer, "direct antwoorden", preheader = onderwerp', () => {
    expect(html).toContain('sq-logo');
    expect(html).toContain('sq-footer');
    expect(html).toContain('<strong>VanXcel</strong>');
    expect(html).toContain('Je kunt direct antwoorden op deze email. Je antwoord gaat naar info@vanxcel.com.');
    expect(html).toContain(input.subject); // preheader
  });
});

describe('buildCustomerMessageEmail — standaard (verzendmeldingen, bestelling/offerte)', () => {
  const { html } = buildCustomerMessageEmail({ ...input, customerName: 'Cissy', layout: 'standard' });

  it('houdt kop, aanhef en afsluiting', () => {
    expect(html).toContain('<h1');
    expect(html).toContain('Beste Cissy,');
    expect(html).toContain('Met vriendelijke groet,<br/><strong>VanXcel</strong>');
  });

  it('contextblok bij een bestelling', () => {
    const order = buildCustomerMessageEmail({
      ...input, layout: 'standard', contextType: 'order', contextData: { order_number: '#1042' },
    });
    expect(order.html).toContain('Betreft bestelling: <strong style="color:#111827;">#1042</strong>');
  });
});

describe('customerMessageLayout', () => {
  it('alleen exact "inbox" kiest de nieuwe vorm', () => {
    expect(customerMessageLayout('inbox')).toBe('inbox');
    expect(customerMessageLayout(undefined)).toBe('standard');
    expect(customerMessageLayout('INBOX')).toBe('standard');
    expect(customerMessageLayout('plain')).toBe('standard');
  });
});
