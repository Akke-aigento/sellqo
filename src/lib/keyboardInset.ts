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

// ── APP-KEYBOARD-2: meer dan één signaal ─────────────────────────────

/** Invoertypes die géén schermtoetsenbord openen. */
const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
]);

export interface FocusedElementLike {
  tagName: string;
  type?: string | null;
  readOnly?: boolean;
  disabled?: boolean;
  isContentEditable?: boolean;
}

/** Opent focus op dit element een schermtoetsenbord? */
export function isEditableElement(el: FocusedElementLike | null | undefined): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.disabled || el.readOnly) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  return !NON_TEXT_INPUT_TYPES.has((el.type ?? 'text').toLowerCase());
}

/**
 * Staat het toetsenbord open? Tot 29-09 hing dat in de native app aan één
 * enkel signaal: het `keyboardWillShow`-event van de plugin. Kwam dat niet
 * binnen, dan bleef de navigatiepil midden over de antwoordbox hangen.
 *
 * - Native, en de plugin heeft zich al eens gemeld: de plugin is leidend. Hij
 *   ziet ook een toetsenbord dat wegveegt terwijl het veld focus houdt.
 * - Anders (web, of een plugin die zwijgt): krimpende viewport, óf een
 *   tekstveld met focus op een touchtoestel. Dat laatste hangt van geen enkele
 *   plugin of browsereigenaardigheid af.
 */
export function resolveKeyboardOpen(signals: {
  isNative: boolean;
  pluginSeen: boolean;
  pluginOpen: boolean;
  viewportOpen: boolean;
  editableFocused: boolean;
  isCoarsePointer: boolean;
}): boolean {
  if (signals.isNative && signals.pluginSeen) return signals.pluginOpen;
  if (signals.viewportOpen) return true;
  return (signals.isNative || signals.isCoarsePointer) && signals.editableFocused;
}
