// Akke Insights — cookieloze bezoekers- en doelmeting voor de publieke SellQo-site.
// Geen cookies, geen IP of user-agent bewaard (zie insights.studioakke.com), dus geen
// toestemming nodig. Alleen op sellqo.app in de browser: nooit in de native app (Capacitor)
// en nooit in het adminpaneel, de webshops of betaalpagina's (data-exclude).
import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    akke?: (name: string, props?: Record<string, string | number>) => void;
  }
}

const SITE_KEY = 'xh7aj47tq0rk';
const EXCLUDE = [
  '/admin*',
  '/shop/*',
  '/pay/*',
  '/betalen/*',
  '/betaling/*',
  '/actie/*',
  '/invite/*',
  '/app/*',
  '/reset-password',
  '/no-access',
].join(',');

export function loadAkkeInsights() {
  try {
    if (Capacitor.isNativePlatform()) return;
    if (!/(^|\.)sellqo\.app$/i.test(window.location.hostname)) return;
    const s = document.createElement('script');
    s.defer = true;
    s.src = 'https://insights.studioakke.com/t.js';
    s.dataset.site = SITE_KEY;
    s.dataset.exclude = EXCLUDE;
    document.head.appendChild(s);
  } catch {
    // Meten mag de site nooit breken.
  }
}

/** Doel melden aan Akke Insights; doet niets als de tracker niet geladen is. */
export function trackGoal(name: string, props?: Record<string, string | number>) {
  try {
    window.akke?.(name, props);
  } catch {
    /* nooit de flow breken */
  }
}
