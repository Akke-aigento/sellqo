import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  isEditableElement,
  keyboardInsetFromNative,
  keyboardInsetFromViewport,
  resolveKeyboardOpen,
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

const readEditableFocus = (): boolean =>
  typeof document !== 'undefined' && isEditableElement(document.activeElement as HTMLInputElement | null);

const isCoarsePointer = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

/**
 * APP-KEYBOARD-1 — één bron voor de toetsenbordstatus, voor alles wat zweeft.
 *
 * Web/PWA: `visualViewport` krimpt als het toetsenbord opkomt. Native: de
 * WebView krimpt zelf (`resize: 'native'` in capacitor.config.ts), dus daar
 * komt de status van de plugin-events. De plugin wordt dynamisch geïmporteerd,
 * zoals in src/native/pushTaps.ts, zodat hij niet in de webbundel landt.
 *
 * APP-KEYBOARD-2 (29-09) — een tweede, pluginvrij signaal: een tekstveld met
 * focus op een touchtoestel. Met alleen het plugin-event bleef de pil staan
 * zodra dat event niet binnenkwam. Hoe de signalen wegen: resolveKeyboardOpen.
 */
export function useKeyboardInset(): KeyboardState {
  const [base, setBase] = useState<KeyboardState>(() => readViewport());
  const [plugin, setPlugin] = useState({ seen: false, open: false });
  const [editableFocused, setEditableFocused] = useState<boolean>(() => readEditableFocus());
  const [isNative] = useState(() => Capacitor.isNativePlatform());
  const [coarse] = useState(() => isCoarsePointer());

  // Focus: bij focusout even wachten tot de volgende focusin er is, anders
  // knippert de pil tussen twee velden.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setEditableFocused(readEditableFocus()), 0);
    };
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, []);

  useEffect(() => {
    if (!isNative) {
      const vv = window.visualViewport;
      const onChange = () => setBase(readViewport());
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
        // resize: 'native' → de WebView krimpt mee, dus inset 0.
        const show = await Keyboard.addListener('keyboardWillShow', (info) => {
          setPlugin({ seen: true, open: true });
          setBase((prev) => ({
            ...keyboardInsetFromNative(info.keyboardHeight, true),
            viewportHeight: window.visualViewport?.height ?? window.innerHeight ?? prev.viewportHeight,
          }));
        });
        const hide = await Keyboard.addListener('keyboardWillHide', () => {
          setPlugin({ seen: true, open: false });
          setBase(readViewport());
        });
        if (cancelled) {
          void show.remove();
          void hide.remove();
          return;
        }
        handles.push(show, hide);
      } catch (e) {
        // Geen plugin: het focussignaal vangt dit op.
        console.warn('[keyboard] listeners niet geregistreerd', e);
      }
    })();

    // Na het krimpen van de WebView verandert ook de viewporthoogte: bijhouden
    // zodat lijsten hun maximum opnieuw kunnen berekenen.
    const onResize = () =>
      setBase((prev) => ({ ...prev, viewportHeight: window.visualViewport?.height ?? window.innerHeight }));
    window.visualViewport?.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.visualViewport?.removeEventListener('resize', onResize);
      void ready.then(() => handles.forEach((h) => h.remove()));
    };
  }, [isNative]);

  return {
    ...base,
    isOpen: resolveKeyboardOpen({
      isNative,
      pluginSeen: plugin.seen,
      pluginOpen: plugin.open,
      viewportOpen: !isNative && base.isOpen,
      editableFocused,
      isCoarsePointer: coarse,
    }),
  };
}
