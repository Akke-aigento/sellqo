import { useEffect, useState } from 'react';
import { H } from './h';
const start = Date.now();
/** Zoals de echte hook: tijdens het laden (enkel met ?cache=) de sporen uit de cache en ready=false. */
function useLoaded() {
  const [loaded, setLoaded] = useState(!H.cache || Date.now() - start >= H.delay);
  useEffect(() => {
    if (loaded) return;
    const id = setTimeout(() => setLoaded(true), Math.max(0, H.delay - (Date.now() - start)));
    return () => clearTimeout(id);
  }, [loaded]);
  return loaded;
}
export function useTracks() {
  const ready = useLoaded();
  const t = ready ? H.tracks : (H.cache ?? H.tracks);
  return { ready, tracks: t, planTrack: t[0], bypass: false, hasTrack: (x: string) => t.includes(x) };
}
export function useBusinessModules() {
  const ready = useLoaded();
  const t = ready ? H.tracks : (H.cache ?? H.tracks);
  return { has: (x: string) => t.includes(x), ready, chosen: t, planTrack: t[0], tracks: t };
}
export const BUSINESS_MODULES = ['webshop', 'horeca', 'events'];
export const isBusinessModule = (k?: string) => !!k && BUSINESS_MODULES.includes(k);
export function tenantModules() { return []; }
