import { useEffect, type RefObject } from 'react';
import { isNearBottom } from '@/lib/keyboardDismiss';

/**
 * APP-KEYBOARD-3 — een gesprek opent onderaan en blijft daar, ook als het
 * venster krimpt (toetsenbord op) of groeit (toetsenbord weg), en als er een
 * bericht bijkomt. Wie zelf omhoog gescrold heeft om iets terug te lezen,
 * wordt niet teruggetrokken.
 *
 * `rootRef` is de Radix ScrollArea-root. Die scrolt zelf niet (overflow-hidden):
 * de Viewport erbinnen doet dat. De oude code zette scrollTop op de root, en
 * deed daardoor nooit iets.
 */
export function useStickToBottom(rootRef: RefObject<HTMLElement>, resetKey: unknown): void {
  useEffect(() => {
    const viewport = rootRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    let stick = true;
    const toBottom = () => { viewport.scrollTop = viewport.scrollHeight; };
    toBottom();

    const onScroll = () => { stick = isNearBottom(viewport); };
    viewport.addEventListener('scroll', onScroll, { passive: true });

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => { if (stick) toBottom(); });
    observer?.observe(viewport);
    if (viewport.firstElementChild) observer?.observe(viewport.firstElementChild);

    return () => {
      viewport.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [rootRef, resetKey]);
}
