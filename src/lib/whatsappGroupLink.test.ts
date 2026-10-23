import { describe, expect, it } from 'vitest';
import { normalizeWhatsappGroupLink } from './whatsappGroupLink';

describe('normalizeWhatsappGroupLink', () => {
  it('leeg is geen link', () => {
    expect(normalizeWhatsappGroupLink('')).toEqual({ ok: true, value: null });
    expect(normalizeWhatsappGroupLink('   ')).toEqual({ ok: true, value: null });
    expect(normalizeWhatsappGroupLink(null)).toEqual({ ok: true, value: null });
  });

  it('haalt trackingparameters weg', () => {
    expect(normalizeWhatsappGroupLink('https://chat.whatsapp.com/LjfBGnuJEWuKJQEfBlhaxp?s=sh&p=i&mlu=4&ilr=4&iam=0'))
      .toEqual({ ok: true, value: 'https://chat.whatsapp.com/LjfBGnuJEWuKJQEfBlhaxp' });
  });

  it('pakt de link uit de deeltekst van WhatsApp', () => {
    expect(normalizeWhatsappGroupLink('‎Open this link to join my WhatsApp Group: https://chat.whatsapp.com/LjfBGnuJEWuKJQEfBlhaxp?s=sh'))
      .toEqual({ ok: true, value: 'https://chat.whatsapp.com/LjfBGnuJEWuKJQEfBlhaxp' });
  });

  it('aanvaardt een link zonder https', () => {
    expect(normalizeWhatsappGroupLink('chat.whatsapp.com/LjfBGnuJEWuKJQEfBlhaxp'))
      .toEqual({ ok: true, value: 'https://chat.whatsapp.com/LjfBGnuJEWuKJQEfBlhaxp' });
  });

  it('weigert andere links', () => {
    expect(normalizeWhatsappGroupLink('https://wa.me/32470000000').ok).toBe(false);
    expect(normalizeWhatsappGroupLink('https://evil.com/chat.whatsapp.com/abc').ok).toBe(false);
    expect(normalizeWhatsappGroupLink('https://chat.whatsapp.com.evil.com/LjfBGnuJEWuKJQEfBlhaxp').ok).toBe(false);
    expect(normalizeWhatsappGroupLink('javascript:alert(1)').ok).toBe(false);
  });
});
