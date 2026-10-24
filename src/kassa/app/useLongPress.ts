// KASSA-0.6 — lang drukken op een knop (producttegel) zonder het gewone tikken te breken.
import { useEffect, useRef } from 'react';

const LONG_PRESS_MS = 550;

/**
 * Lang drukken op een knop zonder het gewone tikken te breken: na een lange druk wordt de
 * volgende klik genegeerd. Rechtsklik / contextmenu (iPad, muis) opent ook.
 */
export function useLongPress(onLong: () => void, enabled: boolean) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  if (!enabled) return { handlers: {}, consumeClick: () => false };
  return {
    handlers: {
      onPointerDown: () => { fired.current = false; clear(); timer.current = window.setTimeout(() => { fired.current = true; onLong(); }, LONG_PRESS_MS); },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clear(); fired.current = true; onLong(); },
    },
    /** True = deze klik hoort bij een lange druk en moet genegeerd worden. */
    consumeClick: () => { const f = fired.current; fired.current = false; return f; },
  };
}
