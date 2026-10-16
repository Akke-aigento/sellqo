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
  } else if (tab === 'library' || tab === 'calendar') {
    path = '/admin/marketing/social';
  } else {
    // create, menu, social, purchase-terugkeer of geen tab: de AI-tools in Social.
    params.set('tab', 'create');
    if (tab === 'social') params.set('tool', 'social');
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
