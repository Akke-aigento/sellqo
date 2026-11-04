// UREN-1 / WEBSITE-HORECA-1 — instelling via ?screen=…&tracks=…&role=…&hours=empty.
const q = new URLSearchParams(location.search);
export const H = {
  screen: q.get('screen') ?? 'bedrijf',
  tracks: q.get('tracks')?.split(',') ?? ['horeca'],
  role: q.get('role') ?? 'tenant_admin',
  hours: q.get('hours') ?? 'set',
};
