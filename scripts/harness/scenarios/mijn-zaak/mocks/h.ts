// Gedeelde instelling: ?screen=…&tracks=…&role=…&path=…&cache=… in de URL.
// 1b: `cache` = de sporen in localStorage['sq_last_tracks'] (per toestel); zolang de echte sporen laden
// (`delay` ms, standaard 600) geeft useTracks die terug met ready=false, zoals de echte hook.
const q = new URLSearchParams(location.search);
export const H = {
  screen: q.get('screen') ?? 'settings',
  tracks: q.get('tracks')?.split(',') ?? ['horeca'],
  role: q.get('role') ?? 'tenant_admin',
  path: q.get('path'),
  cache: q.get('cache')?.split(',') ?? null,
  delay: Number(q.get('delay') ?? 600),
};
