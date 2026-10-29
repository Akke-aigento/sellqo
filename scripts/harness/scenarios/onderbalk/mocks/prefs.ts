import { useSyncExternalStore } from 'react';
import { H } from './h';
let state: string[] | null = H.bottomNav ?? null;
const subs = new Set<() => void>();
export function useSidebarPreferences() {
  const bottomNav = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);
  return {
    bottomNav, isLoading: false, isSavingBottomNav: false, preferences: null,
    setBottomNav: async (v: string[] | null) => { state = v?.length ? v.slice(0, 5) : null; subs.forEach((f) => f()); },
  };
}
