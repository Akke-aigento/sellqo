import { H } from './h';
export function useTracks() { const t = H.tracks ?? ['horeca']; return { ready: true, tracks: t, hasTrack: (x: string) => t.includes(x) }; }
export const useBusinessModules = useTracks;
