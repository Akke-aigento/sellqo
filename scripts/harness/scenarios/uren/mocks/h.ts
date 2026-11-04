// UREN-1 / WEBSITE-HORECA-1 — instelling via ?screen=…&tracks=…&role=…&hours=empty (&logo=set, UREN-1c).
const q = new URLSearchParams(location.search);
export const H = {
  screen: q.get('screen') ?? 'bedrijf',
  tracks: q.get('tracks')?.split(',') ?? ['horeca'],
  role: q.get('role') ?? 'tenant_admin',
  hours: q.get('hours') ?? 'set',
  // UREN-1c: themalogo aanwezig (Branding: "Logo verwijderen").
  logo: q.get('logo') ?? 'none',
};
