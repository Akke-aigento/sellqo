import { useEffect, type RefObject } from 'react';
import { Capacitor } from '@capacitor/core';
import { isEditableElement } from '@/lib/keyboardInset';
import { isDismissSwipe, isTap, shouldDismissKeyboardOnTap } from '@/lib/keyboardDismiss';

/** Het veld dat nu het toetsenbord openhoudt, of null. */
const focusedEditable = (): HTMLElement | null => {
  const el = document.activeElement as HTMLElement | null;
  return el && isEditableElement(el as HTMLInputElement) ? el : null;
};

const touchKeyboardDevice = () =>
  Capacitor.isNativePlatform() || window.matchMedia?.('(pointer: coarse)').matches === true;

/**
 * APP-KEYBOARD-3 — tik op een lege plek sluit het toetsenbord (zie
 * src/lib/keyboardDismiss.ts). Eén keer, in AdminLayout.
 *
 * Touch-events en geen `click`: iOS stuurt geen click voor een tik op een niet-
 * klikbaar element naar een listener op document. En pas bij het loslaten, niet
 * bij het neerzetten: anders verschuift de layout (toetsenbord zakt) terwijl
 * de vinger nog op een knop staat, en mist de tik zijn doel.
 */
export function useTapToDismissKeyboard(): void {
  useEffect(() => {
    if (!touchKeyboardDevice()) return;
    let start: { x: number; y: number; t: number; target: Element | null } | null = null;

    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      start = e.touches.length === 1 && touch
        ? { x: touch.clientX, y: touch.clientY, t: Date.now(), target: e.target as Element | null }
        : null;
    };
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      const touch = e.changedTouches[0];
      if (!s || !touch) return;
      if (!isTap({ dx: touch.clientX - s.x, dy: touch.clientY - s.y, ms: Date.now() - s.t })) return;
      const field = focusedEditable();
      if (!field || (s.target && field.contains(s.target))) return;
      if (shouldDismissKeyboardOnTap(s.target)) field.blur();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, []);
}

/**
 * APP-KEYBOARD-3 — naar beneden vegen over `ref` sluit het toetsenbord, zoals
 * in iMessage. De lijst scrolt gewoon mee: niets wordt tegengehouden.
 */
export function useSwipeDownToDismissKeyboard(ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !touchKeyboardDevice()) return;
    let start: { x: number; y: number } | null = null;

    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      start = e.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!start || !touch) return;
      if (!isDismissSwipe({ dx: touch.clientX - start.x, dy: touch.clientY - start.y })) return;
      start = null; // één keer per veeg
      focusedEditable()?.blur();
    };
    const onEnd = () => { start = null; };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [ref]);
}
