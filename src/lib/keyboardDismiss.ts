/**
 * APP-KEYBOARD-3 — het toetsenbord wegkrijgen zoals in een chat-app.
 *
 * De Keyboard-plugin verbergt op iOS standaard de balk met "Gereed"
 * (node_modules/@capacitor/keyboard/ios/.../Keyboard.m: hideFormAccessoryBar =
 * YES), en in een WKWebView sluit een tik náást een veld het toetsenbord niet.
 * Tot 29-09 was er in de app dus geen enkele manier om het weg te krijgen.
 *
 * Keuze Akke 29-09: gebaren, geen Gereed-balk.
 *  - tik op iets dat niet interactief is → toetsenbord weg;
 *  - veeg in een gesprek naar beneden → toetsenbord weg;
 *  - tik in het tekstvak → het komt terug (standaard gedrag), tekst blijft staan.
 */

/** Wat een tik zelf nodig heeft: daarop sluiten we het toetsenbord nooit. */
export const KEEP_KEYBOARD_SELECTOR = [
  'input', 'textarea', 'select', 'button', 'a[href]', 'label', 'summary',
  '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="option"]', '[role="tab"]',
  '[role="checkbox"]', '[role="switch"]', '[role="combobox"]', '[role="textbox"]', '[role="slider"]',
  '[contenteditable=""]', '[contenteditable="true"]',
  // Opt-in voor een vlak rond een veld (bv. de antwoordbox): een net-mis tik
  // naast het tekstvak mag het toetsenbord niet laten wegzakken.
  '[data-keep-keyboard]',
].join(', ');

/** Mag een tik op dit element het toetsenbord sluiten? */
export function shouldDismissKeyboardOnTap(target: Element | null): boolean {
  if (!target) return false;
  return target.closest(KEEP_KEYBOARD_SELECTOR) === null;
}

/** Een tik, geen veeg of lange druk. */
export const TAP_MAX_MOVE_PX = 10;
export const TAP_MAX_MS = 500;
export function isTap(move: { dx: number; dy: number; ms: number }): boolean {
  return Math.hypot(move.dx, move.dy) <= TAP_MAX_MOVE_PX && move.ms <= TAP_MAX_MS;
}

/** Vinger naar beneden en overwegend verticaal: zo veeg je in iMessage het toetsenbord weg. */
export const SWIPE_DISMISS_PX = 24;
export function isDismissSwipe(move: { dx: number; dy: number }): boolean {
  return move.dy >= SWIPE_DISMISS_PX && Math.abs(move.dy) > Math.abs(move.dx) * 1.5;
}

/** Staat de lijst (bijna) onderaan? Dan blijft hij daar als het venster krimpt. */
export const STICK_TO_BOTTOM_PX = 48;
export function isNearBottom(el: { scrollTop: number; clientHeight: number; scrollHeight: number }): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_TO_BOTTOM_PX;
}
