import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * Openen van links buiten de eigen UI.
 *
 * Waarom deze helper bestaat: in de Capacitor-WebView gooit `target="_blank"`
 * (en `window.open`) de gebruiker naar Safari of Chrome. Die verlaat de app, en
 * er is geen weg terug — er is geen deep-link-handler geregistreerd. Met
 * `Browser.open` opent de URL in een in-app browser (SFSafariViewController op
 * iOS, Chrome Custom Tab op Android) die met één tik weer sluit.
 *
 * Op web verandert er niets: daar blijft het een nieuw tabblad.
 */

/** Schemes die per definitie bij het besturingssysteem horen. */
const SYSTEEM_SCHEMES = ['mailto:', 'tel:', 'sms:'];

/**
 * Is dit een URL buiten deze app? Alles met een scheme (`https:`, `mailto:`) of
 * een protocol-relatieve `//host` telt als extern; een pad als `/shop/slug`
 * hoort bij deze SPA en dus niet.
 */
export function isExternalUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
}

/**
 * Opent een externe URL. Native: in-app browser. Web: nieuw tabblad.
 * `mailto:`/`tel:`/`sms:` gaan altijd naar het systeem — een in-app browser
 * kan die niet afhandelen.
 *
 * Een lege of ontbrekende URL is een no-op in plaats van een crash: de
 * aanroepende schermen bouwen hun URL vaak uit tenant-data die nog laadt.
 */
export async function openExternal(url: string | null | undefined): Promise<void> {
  if (!url) return;

  if (SYSTEEM_SCHEMES.some((scheme) => url.startsWith(scheme))) {
    window.location.href = url;
    return;
  }

  if (!Capacitor.isNativePlatform()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    await Browser.open({ url });
  } catch {
    // Faalt de plugin (plugin niet gelinkt na een oude native build, of een
    // URL die het systeem weigert), dan liever alsnog openen dan stil niets
    // doen: een dode knop is erger dan een lelijke.
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
