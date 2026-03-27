// Server-side carrier tracking URL generator
// Mirrors src/lib/carrierPatterns.ts for use in edge functions

const CARRIER_URL_PATTERNS: Record<string, string> = {
  postnl: 'https://postnl.nl/tracktrace/?B={tracking}',
  tnt: 'https://postnl.nl/tracktrace/?B={tracking}',
  dhl: 'https://www.dhl.com/nl-nl/home/tracking.html?tracking-id={tracking}',
  dhl_ecommerce: 'https://webtrack.dhlecs.com/?trackingnumber={tracking}',
  dpd: 'https://tracking.dpd.de/parcelstatus?query={tracking}&locale=nl_NL',
  ups: 'https://www.ups.com/track?tracknum={tracking}',
  gls: 'https://gls-group.eu/NL/nl/pakketten-volgen?match={tracking}',
  bpost: 'https://track.bpost.cloud/btr/web/#/search?itemCode={tracking}',
  fedex: 'https://www.fedex.com/fedextrack/?trknbr={tracking}',
  usps: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}',
  royal_mail: 'https://www.royalmail.com/track-your-item#{tracking}',
};

function normalizeCarrier(raw: string): string {
  const norm = raw.toLowerCase().replace(/[_\-\s]+/g, '');
  if (norm.includes('bpost')) return 'bpost';
  if (norm.includes('postnl') || norm === 'tnt') return 'postnl';
  if (norm.includes('dhl') && norm.includes('ecommerce')) return 'dhl_ecommerce';
  if (norm.includes('dhl')) return 'dhl';
  if (norm.includes('dpd')) return 'dpd';
  if (norm.includes('ups')) return 'ups';
  if (norm.includes('gls')) return 'gls';
  if (norm.includes('fedex')) return 'fedex';
  if (norm.includes('usps')) return 'usps';
  if (norm.includes('royalmail') || norm.includes('parcelforce')) return 'royal_mail';
  return raw.toLowerCase();
}

export function generateTrackingUrl(carrier: string, trackingCode: string): string {
  const normalized = normalizeCarrier(carrier);
  const pattern = CARRIER_URL_PATTERNS[normalized];
  if (pattern) {
    return pattern.replace('{tracking}', trackingCode);
  }
  // Universal fallback
  return `https://17track.net/nl/track?nums=${trackingCode}`;
}
