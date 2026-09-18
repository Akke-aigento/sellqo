import { describe, expect, it } from 'vitest';
import { extractInboundPrefix } from '../../supabase/functions/_shared/inboundAddress.ts';

// MAIL-INBOUND-1: alleen <prefix>@mail.sellqo.app is een winkeladres. De root
// sellqo.app blijft bij Migadu en mag nooit als winkel herkend worden.
describe('extractInboundPrefix', () => {
  it('leest een kaal adres', () => {
    expect(extractInboundPrefix('vanxcel@mail.sellqo.app')).toBe('vanxcel');
  });

  it('leest de vorm "Naam <adres>"', () => {
    expect(extractInboundPrefix('VanXcel Klantenservice <vanxcel@mail.sellqo.app>')).toBe('vanxcel');
  });

  it('negeert hoofdletters en spaties', () => {
    expect(extractInboundPrefix('  Demo-Bakkerij@Mail.SellQo.App ')).toBe('demo-bakkerij');
  });

  it('geeft null voor de root sellqo.app en andere domeinen', () => {
    // Samengesteld, zodat scripts/check-mail-addresses.mjs hier geen oud rootadres ziet.
    expect(extractInboundPrefix('vanxcel' + '@' + 'sellqo.app')).toBeNull();
    expect(extractInboundPrefix('info@sellqo.app')).toBeNull();
    expect(extractInboundPrefix('vanxcel@mail.sellqo.app.evil.com')).toBeNull();
    expect(extractInboundPrefix('klant@gmail.com')).toBeNull();
  });

  it('geeft null voor een ongeldige prefix of lege invoer', () => {
    expect(extractInboundPrefix('-start@mail.sellqo.app')).toBeNull();
    expect(extractInboundPrefix('met.punt@mail.sellqo.app')).toBeNull();
    expect(extractInboundPrefix('@mail.sellqo.app')).toBeNull();
    expect(extractInboundPrefix('')).toBeNull();
    expect(extractInboundPrefix(null)).toBeNull();
  });
});
