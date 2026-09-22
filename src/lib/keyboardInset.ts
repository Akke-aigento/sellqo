/**
 * APP-KEYBOARD-1 — hoeveel van het venster het schermtoetsenbord afdekt.
 *
 * Twee werelden, één antwoord:
 *  - **web/PWA**: het toetsenbord legt zich óver de pagina. `window.innerHeight`
 *    blijft gelijk, `visualViewport.height` krimpt. Het verschil is de hoogte
 *    die we moeten ontwijken.
 *  - **native (Capacitor, `resize: 'native'`)**: de WebView krimpt zelf, dus er
 *    valt niets te ontwijken — maar het toetsenbord staat wél open, en de
 *    zwevende balken moeten weg. Daarom `isOpen` los van `inset`.
 *
 * De drempel filtert de kleine schommelingen van een adresbalk die in- of
 * uitschuift; een toetsenbord is altijd ruim hoger.
 */

export const KEYBOARD_MIN_HEIGHT = 120;

export interface ViewportSize {
  /** `window.innerHeight` */
  innerHeight: number;
  /** `visualViewport.height`, of `innerHeight` als die er niet is. */
  viewportHeight: number;
  /** `visualViewport.offsetTop` — meegeteld bij het uitrekenen van de bedekking. */
  offsetTop?: number;
}

export interface KeyboardInset {
  isOpen: boolean;
  /** Pixels onderaan het venster die het toetsenbord afdekt (0 bij een krimpende WebView). */
  inset: number;
}

export function keyboardInsetFromViewport(
  size: ViewportSize,
  threshold: number = KEYBOARD_MIN_HEIGHT,
): KeyboardInset {
  const covered = size.innerHeight - size.viewportHeight - (size.offsetTop ?? 0);
  if (covered >= threshold) return { isOpen: true, inset: Math.round(covered) };
  return { isOpen: false, inset: 0 };
}

/** Native meldt zijn eigen hoogte; krimpt de WebView mee, dan valt er niets te ontwijken. */
export function keyboardInsetFromNative(keyboardHeight: number, webviewResizes: boolean): KeyboardInset {
  if (keyboardHeight <= 0) return { isOpen: false, inset: 0 };
  return { isOpen: true, inset: webviewResizes ? 0 : Math.round(keyboardHeight) };
}

/**
 * Of het zoekveld van de winkelkiezer focus mag krijgen bij openen. Op een
 * touchtoestel niet: het toetsenbord schoot dan meteen op en dekte de lijst af,
 * waardoor de onderste groep onbereikbaar werd. Tikken op het veld opent het
 * toetsenbord daarna gewoon.
 */
export function shouldAutoFocusSearch(env: { isCoarsePointer: boolean; isNative: boolean }): boolean {
  return !env.isCoarsePointer && !env.isNative;
}

/** Hoogte voor een lijst die onder `top` begint en binnen het zichtbare deel moet blijven. */
export function availableListHeight(opts: {
  viewportHeight: number;
  top: number;
  max: number;
  margin?: number;
  min?: number;
}): number {
  const margin = opts.margin ?? 16;
  const min = opts.min ?? 120;
  return Math.max(min, Math.min(opts.max, Math.round(opts.viewportHeight - opts.top - margin)));
}
