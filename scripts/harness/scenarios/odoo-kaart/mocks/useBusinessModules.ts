import { useCard } from './ctx';
export function useTracks() {
  const s = useCard();
  return { tracks: [s.track], planTrack: s.track, hasTrack: (t: string) => t === s.track, ready: true, bypass: false };
}
