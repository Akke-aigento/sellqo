// Shared carrier tracking URL patterns for edge functions
// Mirror of src/lib/carrierPatterns.ts (edge functions can't import from src/)

const CARRIER_PATTERNS: Record<string, string> = {
  // EU carriers
  postnl: 'https://postnl.nl/tracktrace/?B={tracking}&P={postalCode}&D=NL&T=C',
  tnt: 'https://postnl.nl/tracktrace/?B={tracking}&P={postalCode}&D=NL&T=C', // TNT = PostNL
  dhl: 'https://www.dhl.com/nl-nl/home/tracking.html?tracking-id={tracking}',
  dpd: 'https://tracking.dpd.de/parcelstatus?query={tracking}&locale=nl_NL',
  'dpd-nl': 'https://tracking.dpd.de/parcelstatus?query={tracking}&locale=nl_NL',
  ups: 'https://www.ups.com/track?tracknum={tracking}',
  gls: 'https://gls-group.eu/NL/nl/pakketten-volgen?match={tracking}',
  bpost: 'https://track.bpost.cloud/btr/web/#/search?itemCode={tracking}',
  bpost_be: 'https://track.bpost.cloud/btr/web/#/search?itemCode={tracking}',
  fedex: 'https://www.fedex.com/fedextrack/?trknbr={tracking}',
  // International
  china_post: 'https://17track.net/nl/track?nums={tracking}',
  yanwen: 'https://track.yanwen.com.cn/en/web/tracking?numbers={tracking}',
  cainiao: 'https://global.cainiao.com/detail.htm?mailNoList={tracking}',
  '4px': 'https://track.4px.com/query/{tracking}',
  epacket: 'https://17track.net/nl/track?nums={tracking}',
  '17track': 'https://17track.net/nl/track?nums={tracking}',
  yunexpress: 'https://www.yuntrack.com/Track/Detail/{tracking}',
  sf_express: 'https://www.sf-express.com/cn/en/dynamic_function/waybill/{tracking}',
  dhl_ecommerce: 'https://webtrack.dhlecs.com/?trackingnumber={tracking}',
  royal_mail: 'https://www.royalmail.com/track-your-item#{tracking}',
  usps: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}',
  parcel_force: 'https://www.parcelforce.com/track-trace?trackNumber={tracking}',
};

export function generateTrackingUrl(carrier: string, trackingNumber: string): string {
  const normalized = carrier.toLowerCase().trim().replace(/[-\s]+/g, '_');
  const pattern = CARRIER_PATTERNS[normalized];
  
  if (!pattern) {
    // Fallback: 17track universal tracker
    return `https://17track.net/nl/track?nums=${encodeURIComponent(trackingNumber)}`;
  }
  
  return pattern
    .replace('{tracking}', encodeURIComponent(trackingNumber))
    .replace('&P={postalCode}', ''); // Strip postal code placeholder if not available
}
