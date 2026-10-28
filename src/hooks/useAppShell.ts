// MELDING-1 — maakt van een scherm een eigen beginscherm-app (kassa, keukenscherm): wisselt het
// manifest en zet de iOS-tags. Op iPad/iPhone kan web push enkel vanuit zo'n beginscherm-app.
// Bij het verlaten van het scherm komt alles terug zoals het was (zelfde aanpak als de deur- en
// barscanner, useDoorAppShell).
import { useEffect } from 'react';

export function useAppShell(manifestHref: string, title: string, color: string) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prevHref = link?.getAttribute('href') ?? null;
    link?.setAttribute('href', manifestHref);
    const metas: [string, string][] = [
      ['apple-mobile-web-app-capable', 'yes'], ['mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-title', title], ['theme-color', color],
    ];
    const restores = metas.map(([name, content]) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const created = !el;
      const before = el?.getAttribute('content') ?? null;
      if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
      el.setAttribute('content', content);
      return () => { if (created) el?.remove(); else if (before !== null) el?.setAttribute('content', before); };
    });
    return () => {
      if (link && prevHref) link.setAttribute('href', prevHref);
      restores.forEach((r) => r());
    };
  }, [manifestHref, title, color]);
}
