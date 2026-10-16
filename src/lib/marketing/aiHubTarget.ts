// MARKETING-2 — waar een oude link naar de AI Content Hub nu naartoe gaat (zie AIHubRedirect).

export function aiHubTarget(search: string): string {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  params.delete('tab');
  let path = '/admin/marketing/social';
  if (tab === 'assets') {
    path = '/admin/marketing/media';
  } else if (tab === 'email') {
    path = '/admin/marketing';
    params.set('ai', 'email');
  } else if (tab === 'social' || tab === 'create') {
    // MARKETING-3: de AI-post zit als knop op Social; ?ai=post opent hem (met ?product= mee).
    params.set('ai', 'post');
  }
  // menu, purchase-terugkeer of geen tab: gewoon Social (de credits-terugkeer wordt daar afgehandeld).
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
