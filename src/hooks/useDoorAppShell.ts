// EVENT-SCAN-1 — maakt van de scanpagina een eigen beginscherm-app ("SellQo Deur").
// Wisselt het manifest naar /scan.webmanifest (start_url /scan, eigen id), zet de
// iOS-tags voor een schermvullende web-app en een donkere statusbalk. Bij het verlaten
// van de pagina komt alles terug zoals het was.
import { useEffect } from 'react';

function setMeta(name: string, content: string): () => void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  const created = !el;
  const prev = el?.getAttribute('content') ?? null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return () => {
    if (created) el?.remove();
    else if (prev !== null) el?.setAttribute('content', prev);
  };
}

export function useDoorAppShell() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prevHref = link?.getAttribute('href') ?? null;
    link?.setAttribute('href', '/scan.webmanifest');
    const restores = [
      setMeta('apple-mobile-web-app-capable', 'yes'),
      setMeta('mobile-web-app-capable', 'yes'),
      setMeta('apple-mobile-web-app-title', 'Deur'),
      setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent'),
      setMeta('theme-color', '#0b1220'),
    ];
    return () => {
      if (link && prevHref) link.setAttribute('href', prevHref);
      restores.forEach((r) => r());
    };
  }, []);
}

export const DOOR_TOKEN_KEY = 'sellqo.door.token';
