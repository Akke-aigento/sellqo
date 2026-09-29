import { describe, expect, it } from 'vitest';
import {
  buildNotificationEmail,
  loadMessageEmailInfo,
  messageFragment,
  notificationLocale,
} from '../../supabase/functions/_shared/notificationEmail.ts';

// UNIFIED-MAIL-1 — meldingsmail bij een nieuw klantbericht.

const base = {
  notification: { category: 'messages', title: 'Nieuw contactformulier bericht', message: 'Cissy: "USB"' },
  priority: 'medium',
  tenantName: 'VanXcel',
  fullActionUrl: 'https://sellqo.app/admin/messages?conversation=x',
};

describe('messageFragment', () => {
  it('HTML weg, witruimte samengevoegd, entiteiten leesbaar', () => {
    expect(messageFragment('<p>Hallo&nbsp;Cissy,</p><br>  wat <b>fijn</b>\n\n!')).toBe('Hallo Cissy, wat fijn !');
  });
  it('scripts en stijlen verdwijnen volledig', () => {
    expect(messageFragment('<style>p{}</style>tekst<script>alert(1)</script>')).toBe('tekst');
  });
  it('afgekapt op een woordgrens rond 200 tekens, met …', () => {
    const long = 'woord '.repeat(60);
    const out = messageFragment(long)!;
    expect(out.length).toBeLessThanOrEqual(201);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/wo…$/);
  });
  it('leeg → null', () => {
    expect(messageFragment('<p> </p>')).toBeNull();
    expect(messageFragment(null)).toBeNull();
  });
});

describe('buildNotificationEmail — klantbericht', () => {
  const { html, text } = buildNotificationEmail({
    ...base,
    messageInfo: { senderName: 'Cissy', senderAddress: 'administratie@vanempel.nl', fragment: 'Is dit <b>leverbaar</b>?' },
  });

  it('afzender met naam en adres, fragment ge-escaped', () => {
    expect(html).toContain('<strong>Van:</strong> Cissy &lt;administratie@vanempel.nl&gt;');
    expect(html).toContain('Is dit &lt;b&gt;leverbaar&lt;/b&gt;?');
    expect(html).not.toContain('<b>leverbaar</b>');
  });

  it('"Bericht openen" met de deeplink, en de regel over antwoorden', () => {
    expect(html).toContain('Bericht openen');
    expect(html).not.toContain('Bekijk details');
    expect(html).toContain(base.fullActionUrl);
    expect(html).toContain('Beantwoord dit bericht in SellQo — antwoorden op deze e-mail komen niet bij je klant.');
    expect(text).toContain('Beantwoord dit bericht in SellQo');
  });

  it('in de taal van de winkel', () => {
    const fr = buildNotificationEmail({ ...base, locale: 'fr', messageInfo: { senderName: 'A', senderAddress: null, fragment: 'x' } });
    expect(fr.html).toContain('Ouvrir le message');
    expect(fr.html).toContain('<strong>De:</strong> A');
  });
});

describe('buildNotificationEmail — terugval en andere categorieën', () => {
  it('bericht zonder bron → de vorige mail (Bekijk details, notification.message)', () => {
    const { html } = buildNotificationEmail({ ...base, messageInfo: null });
    expect(html).toContain('Bekijk details');
    expect(html).toContain('Cissy: "USB"');
    expect(html).not.toContain('Beantwoord dit bericht in SellQo');
  });

  it('andere categorie negeert messageInfo', () => {
    const { html } = buildNotificationEmail({
      ...base,
      notification: { category: 'orders', title: 'Nieuwe bestelling', message: '#1042' },
      messageInfo: { senderName: 'X', senderAddress: 'x@y.z', fragment: 'y' },
    });
    expect(html).toContain('Bekijk details');
    expect(html).not.toContain('Bericht openen');
  });
});

describe('notificationLocale', () => {
  it('nl/en/fr/de, al het andere nl (t() zou anders Engels kiezen)', () => {
    expect(notificationLocale('fr')).toBe('fr');
    expect(notificationLocale('de-BE')).toBe('de');
    expect(notificationLocale('uk')).toBe('nl');
    expect(notificationLocale(null)).toBe('nl');
  });
});

describe('loadMessageEmailInfo', () => {
  const client = (rows: Record<string, unknown>) => ({
    from(table: string) {
      const b = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) };
      return b;
    },
  });
  const MSG = '3f2b1c9e-8a7d-4e6f-9b0c-1d2e3f4a5b6c';

  it('contactformulier: naam uit context_data, kaal adres, fragment uit body_text', async () => {
    const info = await loadMessageEmailInfo(client({
      customer_messages: { from_email: 'administratie@vanempel.nl', body_text: 'Graag 10 stuks', body_html: null, context_data: { name: 'Cissy' }, customers: null },
    }), 't1', { message_id: MSG });
    expect(info).toEqual({ senderName: 'Cissy', senderAddress: 'administratie@vanempel.nl', fragment: 'Graag 10 stuks' });
  });

  it('inkomende mail met From-header en klant', async () => {
    const info = await loadMessageEmailInfo(client({
      customer_messages: { from_email: 'C J <cj@x.nl>', body_text: null, body_html: '<p>Hoi</p>', context_data: null, customers: { first_name: 'Cissy', last_name: 'Janssen', email: 'cj@x.nl' } },
    }), 't1', { message_id: MSG });
    expect(info).toEqual({ senderName: 'Cissy Janssen', senderAddress: 'cj@x.nl', fragment: 'Hoi' });
  });

  it('WhatsApp zonder message_id: preview en telefoon uit data', async () => {
    const info = await loadMessageEmailInfo(client({}), 't1', { from_phone: '+32470', message_preview: 'Is de winkel open?' });
    expect(info).toEqual({ senderName: null, senderAddress: '+32470', fragment: 'Is de winkel open?' });
  });

  it('niets bruikbaars → null (de mail valt terug op de oude vorm)', async () => {
    expect(await loadMessageEmailInfo(client({}), 't1', {})).toBeNull();
  });
});
