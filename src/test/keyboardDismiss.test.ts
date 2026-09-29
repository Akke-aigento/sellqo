import { describe, expect, it } from 'vitest';
import { isDismissSwipe, isNearBottom, isTap, shouldDismissKeyboardOnTap } from '@/lib/keyboardDismiss';

// APP-KEYBOARD-3 — toetsenbord wegtikken en wegvegen zoals in een chat-app.

const dom = (html: string, selector: string): Element => {
  document.body.innerHTML = html;
  return document.querySelector(selector)!;
};

describe('shouldDismissKeyboardOnTap', () => {
  it('tik op een bericht (gewone tekst) → weg', () => {
    expect(shouldDismissKeyboardOnTap(dom('<div><p class="t">Hallo</p></div>', '.t'))).toBe(true);
  });

  it('tik op Verzenden, een link of een veld → blijft (die tik heeft een eigen doel)', () => {
    expect(shouldDismissKeyboardOnTap(dom('<button><svg class="t"></svg></button>', '.t'))).toBe(false);
    expect(shouldDismissKeyboardOnTap(dom('<a href="/x"><span class="t">x</span></a>', '.t'))).toBe(false);
    expect(shouldDismissKeyboardOnTap(dom('<textarea class="t"></textarea>', '.t'))).toBe(false);
    expect(shouldDismissKeyboardOnTap(dom('<div role="button"><span class="t"></span></div>', '.t'))).toBe(false);
  });

  it('tik in de antwoordbox naast het tekstvak → blijft (data-keep-keyboard)', () => {
    expect(shouldDismissKeyboardOnTap(dom('<div data-keep-keyboard><p class="t">hint</p></div>', '.t'))).toBe(false);
  });

  it('geen doel → niets doen', () => {
    expect(shouldDismissKeyboardOnTap(null)).toBe(false);
  });
});

describe('isTap', () => {
  it('kort en stil → tik', () => expect(isTap({ dx: 3, dy: 4, ms: 120 })).toBe(true));
  it('bewogen → scroll, geen tik', () => expect(isTap({ dx: 0, dy: 30, ms: 120 })).toBe(false));
  it('lang ingedrukt → geen tik (tekst selecteren)', () => expect(isTap({ dx: 0, dy: 0, ms: 800 })).toBe(false));
});

describe('isDismissSwipe', () => {
  it('vinger duidelijk naar beneden → weg', () => expect(isDismissSwipe({ dx: 4, dy: 40 })).toBe(true));
  it('naar boven (nieuwere berichten) → blijft', () => expect(isDismissSwipe({ dx: 0, dy: -40 })).toBe(false));
  it('vooral zijwaarts → blijft', () => expect(isDismissSwipe({ dx: 40, dy: 26 })).toBe(false));
  it('te klein → blijft', () => expect(isDismissSwipe({ dx: 0, dy: 10 })).toBe(false));
});

describe('isNearBottom', () => {
  it('onderaan of binnen 48px → blijft plakken', () => {
    expect(isNearBottom({ scrollTop: 600, clientHeight: 400, scrollHeight: 1000 })).toBe(true);
    expect(isNearBottom({ scrollTop: 560, clientHeight: 400, scrollHeight: 1000 })).toBe(true);
  });
  it('zelf omhoog gescrold → niet terugtrekken', () => {
    expect(isNearBottom({ scrollTop: 200, clientHeight: 400, scrollHeight: 1000 })).toBe(false);
  });
});
