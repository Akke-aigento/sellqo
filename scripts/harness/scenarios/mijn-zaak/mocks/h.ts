// Gedeelde instelling: ?screen=…&tracks=…&role=…&path=… in de URL.
const q = new URLSearchParams(location.search);
export const H = {
  screen: q.get('screen') ?? 'settings',
  tracks: q.get('tracks')?.split(',') ?? ['horeca'],
  role: q.get('role') ?? 'tenant_admin',
  path: q.get('path'),
};
