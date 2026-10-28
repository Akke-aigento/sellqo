// MELDING-1 — houdt het scherm wakker zolang deze pagina zichtbaar is (kassa, keukenscherm).
// Een browser laat het slot los als de pagina verborgen wordt; bij terugkeer vragen we het opnieuw.
// Kan de browser het niet (oudere iOS), dan gebeurt er niets: de schakelaar zegt dat ook.
import { useEffect, useState } from 'react';

type Sentinel = { release: () => Promise<void>; addEventListener?: (t: 'release', f: () => void) => void };
type WakeLockApi = { request: (t: 'screen') => Promise<Sentinel> };

export const wakeLockSupported = (): boolean =>
  typeof navigator !== 'undefined' && !!(navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;

/** Geeft terug of het scherm nu effectief wakker gehouden wordt. */
export function useWakeLock(enabled: boolean): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!enabled || !api) { setActive(false); return; }
    let sentinel: Sentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (stopped || document.visibilityState !== 'visible' || sentinel) return;
      try {
        sentinel = await api.request('screen');
        if (stopped) { void sentinel.release(); sentinel = null; return; }
        setActive(true);
        sentinel.addEventListener?.('release', () => { sentinel = null; setActive(false); });
      } catch {
        setActive(false); // bv. batterijbesparing of geen toestemming
      }
    };
    const onVisible = () => { void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (sentinel) void sentinel.release();
      sentinel = null;
      setActive(false);
    };
  }, [enabled]);
  return active;
}
