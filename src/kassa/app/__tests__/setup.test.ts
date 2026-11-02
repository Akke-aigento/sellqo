// KASSA-ACCOUNT-1 — koppelcode/QR inlezen en tonen (vervangt KASSA-START-1 canCreateTerminal: kassa's maak je
// voortaan in beheer, het toestel kiest geen kassa meer).
import { describe, expect, it } from 'vitest';
import { formatPairCode, isDeviceUser, mmss, pairErrorOf, pairUrl, parsePairInput, secondsLeft } from '../setup';

const TOKEN = 'ab'.repeat(32);

describe('parsePairInput', () => {
  it('zes cijfers, ook met spatie of streepje', () => {
    expect(parsePairInput('482913')).toBe('482913');
    expect(parsePairInput(' 482 913 ')).toBe('482913');
    expect(parsePairInput('482-913')).toBe('482913');
  });
  it('token of de volledige QR-link', () => {
    expect(parsePairInput(TOKEN.toUpperCase())).toBe(TOKEN);
    expect(parsePairInput(`https://sellqo.app/kassa?koppel=${TOKEN}`)).toBe(TOKEN);
    expect(parsePairInput(`https://sellqo.app/kassa?x=1&koppel=${TOKEN}#a`)).toBe(TOKEN);
  });
  it('al de rest = null', () => {
    expect(parsePairInput('')).toBeNull();
    expect(parsePairInput('12345')).toBeNull();
    expect(parsePairInput('1234567')).toBeNull();
    expect(parsePairInput('abcdef')).toBeNull();
    expect(parsePairInput(`https://sellqo.app/kassa?koppel=${TOKEN}0`)).toBeNull();
    expect(parsePairInput(null)).toBeNull();
  });
});

describe('weergave', () => {
  it('code in twee groepen, link, aftelling', () => {
    expect(formatPairCode('482913')).toBe('482 913');
    expect(pairUrl('https://sellqo.app/', TOKEN)).toBe(`https://sellqo.app/kassa?koppel=${TOKEN}`);
    expect(parsePairInput(pairUrl('https://sellqo.app', TOKEN))).toBe(TOKEN);
    const now = Date.parse('2026-11-02T10:00:00Z');
    expect(secondsLeft('2026-11-02T10:10:00Z', now)).toBe(600);
    expect(secondsLeft('2026-11-02T09:59:00Z', now)).toBe(0);
    expect(mmss(600)).toBe('10:00');
    expect(mmss(59)).toBe('0:59');
  });
});

describe('pairErrorOf / isDeviceUser', () => {
  it('antwoord van kassa-device-pair → melding', () => {
    expect(pairErrorOf(null, null)).toBe('offline');
    expect(pairErrorOf(404, { error: 'invalid_code' })).toBe('invalid_code');
    expect(pairErrorOf(400, { error: 'invalid_input' })).toBe('invalid_code');
    expect(pairErrorOf(429, { error: 'rate_limited' })).toBe('rate_limited');
    expect(pairErrorOf(500, { error: 'server' })).toBe('server');
  });
  it('enkel app_metadata.kind = kassa is een toestel', () => {
    expect(isDeviceUser({ app_metadata: { kind: 'kassa' } })).toBe(true);
    expect(isDeviceUser({ app_metadata: { provider: 'email' } })).toBe(false);
    expect(isDeviceUser({ app_metadata: null })).toBe(false);
    expect(isDeviceUser(null)).toBe(false);
  });
});
