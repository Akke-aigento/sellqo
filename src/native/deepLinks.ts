import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type { NavigateFunction } from 'react-router-dom';

/**
 * Deep links komen alleen binnen onder dit pad. Dezelfde prefix staat in
 * public/.well-known/apple-app-site-association en assetlinks.json; wijzig je
 * hem hier, wijzig hem daar mee — anders claimt het OS paden die de app niet
 * afhandelt, of andersom.
 */
const DEEP_LINK_PREFIX = '/app';

/**
 * Vertaalt een inkomende deep-link-URL naar een intern React Router-pad.
 *
 * Geeft `null` terug als de URL onparsebaar is of buiten `/app` valt; de
 * aanroeper hoort daar niets mee te doen. Bewust `new URL()` en geen
 * string-manipulatie: Capacitor's eigen voorbeeld doet `url.split('.app').pop()`,
 * wat stukloopt zodra een pad of querystring toevallig ".app" bevat.
 *
 * De host wordt niet gecontroleerd. Dat hoeft niet: de padguard bindt het
 * resultaat al aan onze eigen /app-routes, dus een gemanipuleerde link kan
 * hooguit onze eigen landingspagina tonen — niet naar buiten navigeren.
 */
export function deepLinkPath(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const { pathname, search, hash } = parsed;
  const isDeepLink =
    pathname === DEEP_LINK_PREFIX || pathname.startsWith(`${DEEP_LINK_PREFIX}/`);

  if (!isDeepLink) return null;

  return `${pathname}${search}${hash}`;
}

/**
 * Of de start-URL van deze app-sessie al is afgehandeld.
 *
 * Bewust module-scope en niet component-state: `App.getLaunchUrl()` blijft de
 * URL waarmee de app is gestart teruggeven zolang de app draait. Zonder deze
 * vlag zou elke remount van DeepLinkListener de gebruiker terugkatapulteren naar
 * de deep link, ook als hij intussen ergens anders is. De start-URL is een
 * eigenschap van de app-start, niet van het component.
 */
let launchUrlHandled = false;

/**
 * Registreert de native deep-link-listener en stuurt binnenkomende links naar
 * de bijbehorende interne route.
 *
 * Op web een no-op: daar handelt de browser de URL zelf af en bestaat er geen
 * appUrlOpen-event. De guard maakt dit dus nadrukkelijk nul gedragswijziging
 * voor webbezoekers.
 *
 * Het plugin wordt dynamisch geïmporteerd, net als @capacitor-firebase/messaging
 * in pushRegistration.ts: zo landt het niet in de web-bundel, en degradeert een
 * laadfout tot "deep links werken niet" in plaats van een dode app.
 *
 * Geeft een cleanup terug voor unmount. De `cancelled`-vlag vangt de unmount af
 * die vóór de async registratie valt — zonder dat blijft er een weeslistener
 * achter die op een verdwenen navigate() blijft schieten.
 */
export function initDeepLinks(navigate: NavigateFunction): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let cancelled = false;
  let handle: PluginListenerHandle | null = null;

  const ready = (async () => {
    try {
      const { App } = await import('@capacitor/app');

      const registered = await App.addListener('appUrlOpen', (event) => {
        const target = deepLinkPath(event.url);

        if (!target) {
          console.info('[deeplink] genegeerd, geen /app-pad:', event.url);
          return;
        }

        // Ook hier zetten, zodat een warme start die via de listener binnenkomt
        // niet even later nog eens door getLaunchUrl wordt overgedaan.
        launchUrlHandled = true;

        // `replace` omdat een deep link geen extra history-entry hoort te maken:
        // de gebruiker komt van buiten de app, er is geen "vorige" scherm.
        navigate(target, { replace: true });
      });

      if (cancelled) {
        void registered.remove();
        return;
      }

      handle = registered;

      // Koude start: wordt de app dóór de link opgestart, dan kan appUrlOpen
      // vuren voordat de listener hierboven klaarstaat, en is het event weg.
      // getLaunchUrl geeft die start-URL alsnog terug.
      if (!launchUrlHandled) {
        const launch = await App.getLaunchUrl();
        const target = launch?.url ? deepLinkPath(launch.url) : null;

        if (target && !cancelled) {
          launchUrlHandled = true;
          navigate(target, { replace: true });
        }
      }
    } catch (e) {
      console.warn('[deeplink] listener niet geregistreerd', e);
    }
  })();

  return () => {
    cancelled = true;
    void ready.then(() => handle?.remove());
  };
}
