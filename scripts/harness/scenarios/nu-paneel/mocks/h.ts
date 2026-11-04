// HORECA-NU-1 — instelling via ?screen=beheer|kassa &role=tenant_admin|staff|marketing|owner|waiter &v=rustig|druk.
const q = new URLSearchParams(location.search);
export const H = {
  screen: q.get('screen') ?? 'beheer',
  role: q.get('role') ?? 'tenant_admin',
  // rustig: alles open, niets op; druk: keuken gepauzeerd, terras dicht, 2 op, dagschotel, vandaag dicht.
  v: q.get('v') ?? 'rustig',
  lang: q.get('lang') ?? 'nl',
};
export const druk = H.v === 'druk';
// HORECA-STAAT-1: enkel de keuken gepauzeerd (zaak open), voor de pauzestatus bovenaan.
export const pauze = H.v === 'pauze';
