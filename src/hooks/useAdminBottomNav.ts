import { useEffect, useSyncExternalStore } from 'react';

/**
 * APP-KEYBOARD-2 — een scherm kan de navigatiepil tijdelijk wegzetten.
 *
 * Eerste gebruiker: een open gesprek in de inbox op mobiel. Daar hoort geen
 * tabbalk (zoals in elke chat-app): terug gaat via de pijl bovenaan, en de
 * antwoordbox krijgt de onderrand. Een teller en geen boolean, zodat twee
 * schermen die tegelijk "weg" vragen elkaar niet ongedaan maken.
 */
let hideRequests = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => hideRequests > 0;

/** Voor AdminLayout: vraagt er een scherm om de pil weg te zetten? */
export function useAdminBottomNavHidden(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Voor een scherm: zet de pil weg zolang `active` waar is. */
export function useHideAdminBottomNav(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    hideRequests += 1;
    emit();
    return () => {
      hideRequests -= 1;
      emit();
    };
  }, [active]);
}
