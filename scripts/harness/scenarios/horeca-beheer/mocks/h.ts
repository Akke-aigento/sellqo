// Gedeelde instelling: window.__harness (steps.mjs) en ?screen=…&tracks=… in de URL.
const q = new URLSearchParams(location.search);
const base = ((window as unknown as { __harness?: Record<string, unknown> }).__harness ?? {}) as { tracks?: string[] };
export const H = {
  screen: q.get('screen') ?? 'sidebar',
  tracks: q.get('tracks')?.split(',') ?? base.tracks ?? ['horeca'],
  role: q.get('role') ?? 'tenant_admin',
  tab: q.get('tab'),
};
