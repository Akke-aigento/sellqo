import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  keyboardInsetFromNative,
  keyboardInsetFromViewport,
  type KeyboardInset,
} from '@/lib/keyboardInset';

export interface KeyboardState extends KeyboardInset {
  /** Hoogte van het zichtbare deel: `visualViewport.height`, of `innerHeight`. */
  viewportHeight: number;
}

const readViewport = (): KeyboardState => {
  if (typeof window === 'undefined') return { isOpen: false, inset: 0, viewportHeight: 0 };
  const vv = window.visualViewport;
  const viewportHeight = vv?.height ?? window.innerHeight;
  return {
    ...keyboardInsetFromViewport({
      innerHeight: window.innerHeight,
      viewportHeight,
      offsetTop: vv?.offsetTop ?? 0,
    }),
    viewportHeight,
  };
};

/**
 * APP-KEYBOARD-1 — één bron voor de toetsenbordstatus, voor alles wat zweeft.
 *
 * Web/PWA: `visualViewport` krimpt als het toetsenbord opkomt. Native: de
 * WebView krimpt zelf (`resize: 'native'` in capacitor.config.ts), dus daar
 * komt de status van de plugin-events — anders zou de app denken dat er niets
 * gebeurt. De plugin wordt dynamisch geïmporteerd, zoals in src/native/pushTaps.ts,
 * zodat hij niet in de webbundel landt.
 */
export function useKeyboardInset(): KeyboardState {
  const [state, setState] = useState<KeyboardState>(() => readViewport());

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      const vv = window.visualViewport;
      const onChange = () => setState(readViewport());
      onChange();
      vv?.addEventListener('resize', onChange);
      vv?.addEventListener('scroll', onChange);
      window.addEventListener('orientationchange', onChange);
      return () => {
        vv?.removeEventListener('resize', onChange);
        vv?.removeEventListener('scroll', onChange);
        window.removeEventListener('orientationchange', onChange);
      };
    }

    let cancelled = false;
    const handles: Array<{ remove: () => void }> = [];
    const ready = (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        // resize: 'native' → de WebView krimpt mee, dus inset 0 en alleen isOpen.
        const show = await Keyboard.addListener('keyboardWillShow', (info) => {
          setState((prev) => ({
            ...keyboardInsetFromNative(info.keyboardHeight, true),
            viewportHeight: window.visualViewport?.height ?? window.innerHeight ?? prev.viewportHeight,
          }));
        });
        const hide = await Keyboard.addListener('keyboardWillHide', () => setState(readViewport()));
        if (cancelled) {
          void show.remove();
          void hide.remove();
          return;
        }
        handles.push(show, hide);
      } catch (e) {
        console.warn('[keyboard] listeners niet geregistreerd', e);
      }
    })();

    // Na het krimpen van de WebView verandert ook de viewporthoogte: bijhouden
    // zodat lijsten hun maximum opnieuw kunnen berekenen.
    const onResize = () =>
      setState((prev) => ({ ...prev, viewportHeight: window.visualViewport?.height ?? window.innerHeight }));
    window.visualViewport?.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.visualViewport?.removeEventListener('resize', onResize);
      void ready.then(() => handles.forEach((h) => h.remove()));
    };
  }, []);

  return state;
}
