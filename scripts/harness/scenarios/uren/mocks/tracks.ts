import { H } from './h';
export function useTracks() { const t = H.tracks; return { ready: true, tracks: t, planTrack: t[0], bypass: false, hasTrack: (x: string) => t.includes(x) }; }
export function useBusinessModules() { const t = H.tracks; return { has: (x: string) => t.includes(x), ready: true, chosen: t, planTrack: t[0], tracks: t }; }
