import { describe, expect, it } from 'vitest';
import {
  availableListHeight, keyboardInsetFromNative, keyboardInsetFromViewport, shouldAutoFocusSearch,
} from '@/lib/keyboardInset';

// APP-KEYBOARD-1: het toetsenbord dekte de winkelkiezer af en de zwevende
// onderbalk zweefde erboven. Eén bron voor "staat het toetsenbord open".

describe('keyboardInsetFromViewport (web: toetsenbord ligt over de pagina)', () => {
  it('krimp boven de drempel → open, met de afgedekte hoogte', () => {
    expect(keyboardInsetFromViewport({ innerHeight: 812, viewportHeight: 476 })).toEqual({ isOpen: true, inset: 336 });
  });
  it('terug naar volle hoogte → dicht', () => {
    expect(keyboardInsetFromViewport({ innerHeight: 812, viewportHeight: 812 })).toEqual({ isOpen: false, inset: 0 });
  });
  it('kleine krimp (adresbalk) telt niet als toetsenbord', () => {
    expect(keyboardInsetFromViewport({ innerHeight: 812, viewportHeight: 742 })).toEqual({ isOpen: false, inset: 0 });
  });
  it('offsetTop telt mee: de pagina is omhooggeschoven', () => {
    expect(keyboardInsetFromViewport({ innerHeight: 812, viewportHeight: 476, offsetTop: 100 })).toEqual({ isOpen: true, inset: 236 });
  });
});

describe('keyboardInsetFromNative (app: WebView krimpt zelf)', () => {
  it('krimpende WebView → open, niets te ontwijken', () => {
    expect(keyboardInsetFromNative(336, true)).toEqual({ isOpen: true, inset: 0 });
  });
  it('zonder krimp → open mét inset', () => {
    expect(keyboardInsetFromNative(336, false)).toEqual({ isOpen: true, inset: 336 });
  });
  it('hoogte 0 → dicht', () => {
    expect(keyboardInsetFromNative(0, true)).toEqual({ isOpen: false, inset: 0 });
  });
});

describe('shouldAutoFocusSearch', () => {
  it.each([
    [{ isCoarsePointer: false, isNative: false }, true],
    [{ isCoarsePointer: true, isNative: false }, false],
    [{ isCoarsePointer: false, isNative: true }, false],
    [{ isCoarsePointer: true, isNative: true }, false],
  ])('%j → %s', (env, expected) => expect(shouldAutoFocusSearch(env)).toBe(expected));
});

describe('availableListHeight', () => {
  it('past de lijst in wat er over is als het toetsenbord open staat', () => {
    expect(availableListHeight({ viewportHeight: 476, top: 200, max: 360 })).toBe(260);
  });
  it('nooit hoger dan het maximum', () => {
    expect(availableListHeight({ viewportHeight: 812, top: 200, max: 360 })).toBe(360);
  });
  it('nooit lager dan het minimum: liever scrollen dan een onzichtbare lijst', () => {
    expect(availableListHeight({ viewportHeight: 300, top: 260, max: 360 })).toBe(120);
  });
});
