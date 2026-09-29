import { describe, expect, it } from 'vitest';
import { parseFromHeader, resolveSenderName } from '@/lib/senderName';

// MAIL-REPLY-FORMAT-1 — klantnaam → context_data.name → From-naam → e-mailadres.

describe('parseFromHeader', () => {
  it('Naam <adres>, "Naam" <adres>, <adres> en een kaal adres', () => {
    expect(parseFromHeader('Cissy Janssen <cissy@x.nl>')).toEqual({ name: 'Cissy Janssen', address: 'cissy@x.nl' });
    expect(parseFromHeader('"Janssen, Cissy" <cissy@x.nl>')).toEqual({ name: 'Janssen, Cissy', address: 'cissy@x.nl' });
    expect(parseFromHeader('<cissy@x.nl>')).toEqual({ name: null, address: 'cissy@x.nl' });
    expect(parseFromHeader('cissy@x.nl')).toEqual({ name: null, address: 'cissy@x.nl' });
    expect(parseFromHeader(null)).toEqual({ name: null, address: '' });
  });
});

describe('resolveSenderName', () => {
  it('klantnaam wint', () => {
    expect(resolveSenderName({ customerName: 'Van Empel BV', contextName: 'Cissy', from: 'Admin <a@vanempel.nl>' })).toBe('Van Empel BV');
  });

  it('het geval van 29-09: contactformulier zonder klant → naam uit context_data', () => {
    expect(resolveSenderName({ contextName: 'Cissy', from: 'administratie@vanempel.nl' })).toBe('Cissy');
  });

  it('daarna de weergavenaam uit de From-header', () => {
    expect(resolveSenderName({ from: 'Cissy Janssen <cissy@x.nl>' })).toBe('Cissy Janssen');
  });

  it('pas als laatste het adres — kaal, zonder <>', () => {
    expect(resolveSenderName({ from: '<cissy@x.nl>' })).toBe('cissy@x.nl');
    expect(resolveSenderName({ from: 'cissy@x.nl' })).toBe('cissy@x.nl');
  });

  it('een "naam" die gewoon het adres is, telt niet', () => {
    expect(resolveSenderName({ customerName: 'cissy@x.nl', contextName: 'Cissy', from: 'cissy@x.nl' })).toBe('Cissy');
    expect(resolveSenderName({ from: 'CISSY@x.nl <cissy@x.nl>' })).toBe('cissy@x.nl');
  });

  it('lege waarden en een expliciete terugval', () => {
    expect(resolveSenderName({ customerName: '  ', contextName: 42, from: '', fallback: 'klant@x.nl' })).toBe('klant@x.nl');
    expect(resolveSenderName({ customerName: '', from: 'Ander <ander@x.nl>', fallback: 'klant@x.nl' })).toBe('Ander');
  });
});
