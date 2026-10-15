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

/** SCAN-APP-1 — manifest met het token in de start_url, zodat het beginscherm-icoon
 *  meteen de juiste deur opent. Nodig omdat een beginscherm-app (zeker op iOS) een
 *  eigen, lege opslag krijgt: localStorage en login uit de browser zijn daar weg.
 *  Absolute URL's, want relatieve paden lossen niet op tegen een data:-manifest. */
export function tokenManifest(path: string, name: string, shortName: string, color: string): string {
  const abs = (p: string) => `${window.location.origin}${p}`;
  return 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify({
    id: path.split('/').slice(0, 2).join('/'),
    name, short_name: shortName,
    start_url: abs(path), scope: abs('/'),
    display: 'standalone', orientation: 'portrait',
    background_color: color, theme_color: color,
    icons: [
      { src: abs('/web-app-manifest-192x192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: abs('/web-app-manifest-512x512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: abs('/web-app-manifest-512x512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }));
}

export function useDoorAppShell(scanToken?: string) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prevHref = link?.getAttribute('href') ?? null;
    link?.setAttribute('href', scanToken
      ? tokenManifest(`/scan/${scanToken}`, 'SellQo Deur', 'Deur', '#0b1220')
      : '/scan.webmanifest');
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
  }, [scanToken]);
}

export const DOOR_TOKEN_KEY = 'sellqo.door.token';
