export function useTracks() { return { ready: true, tracks: ['horeca'], planTrack: 'horeca', bypass: false, hasTrack: (x: string) => x === 'horeca' }; }
export function useBusinessModules() { return { has: (x: string) => x === 'horeca', ready: true, chosen: ['horeca'], planTrack: 'horeca', tracks: ['horeca'] }; }
