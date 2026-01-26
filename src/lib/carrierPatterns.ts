// Pre-configured carrier patterns for automatic tracking URL generation

export interface CarrierPattern {
  id: string;
  name: string;
  pattern: string;
  requiresPostalCode?: boolean;
  logoUrl?: string;
}

// EU/Local Carriers
export const EU_CARRIERS: CarrierPattern[] = [
  {
    id: 'postnl',
    name: 'PostNL',
    pattern: 'https://postnl.nl/tracktrace/?B={tracking}&P={postalCode}&D=NL&T=C',
    requiresPostalCode: true,
  },
  {
    id: 'dhl',
    name: 'DHL',
    pattern: 'https://www.dhl.com/nl-nl/home/tracking.html?tracking-id={tracking}',
  },
  {
    id: 'dpd',
    name: 'DPD',
    pattern: 'https://tracking.dpd.de/parcelstatus?query={tracking}&locale=nl_NL',
  },
  {
    id: 'ups',
    name: 'UPS',
    pattern: 'https://www.ups.com/track?tracknum={tracking}',
  },
  {
    id: 'gls',
    name: 'GLS',
    pattern: 'https://gls-group.eu/NL/nl/pakketten-volgen?match={tracking}',
  },
  {
    id: 'bpost',
    name: 'bpost',
    pattern: 'https://track.bpost.cloud/btr/web/#/search?itemCode={tracking}',
  },
  {
    id: 'fedex',
    name: 'FedEx',
    pattern: 'https://www.fedex.com/fedextrack/?trknbr={tracking}',
  },
];

// International/Dropshipping Carriers
export const INTERNATIONAL_CARRIERS: CarrierPattern[] = [
  {
    id: 'china_post',
    name: 'China Post',
    pattern: 'https://17track.net/nl/track?nums={tracking}',
  },
  {
    id: 'yanwen',
    name: 'Yanwen',
    pattern: 'https://track.yanwen.com.cn/en/web/tracking?numbers={tracking}',
  },
  {
    id: 'cainiao',
    name: 'Cainiao (AliExpress)',
    pattern: 'https://global.cainiao.com/detail.htm?mailNoList={tracking}',
  },
  {
    id: '4px',
    name: '4PX',
    pattern: 'https://track.4px.com/query/{tracking}',
  },
  {
    id: 'epacket',
    name: 'ePacket',
    pattern: 'https://17track.net/nl/track?nums={tracking}',
  },
  {
    id: '17track',
    name: '17TRACK (Universeel)',
    pattern: 'https://17track.net/nl/track?nums={tracking}',
  },
  {
    id: 'yunexpress',
    name: 'YunExpress',
    pattern: 'https://www.yuntrack.com/Track/Detail/{tracking}',
  },
  {
    id: 'sf_express',
    name: 'SF Express',
    pattern: 'https://www.sf-express.com/cn/en/dynamic_function/waybill/{tracking}',
  },
  {
    id: 'dhl_ecommerce',
    name: 'DHL eCommerce',
    pattern: 'https://webtrack.dhlecs.com/?trackingnumber={tracking}',
  },
  {
    id: 'royal_mail',
    name: 'Royal Mail',
    pattern: 'https://www.royalmail.com/track-your-item#{tracking}',
  },
  {
    id: 'usps',
    name: 'USPS',
    pattern: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}',
  },
  {
    id: 'parcel_force',
    name: 'Parcel Force',
    pattern: 'https://www.parcelforce.com/track-trace?trackNumber={tracking}',
  },
  {
    id: 'cj_packet',
    name: 'CJ Packet',
    pattern: 'https://17track.net/nl/track?nums={tracking}',
  },
  {
    id: 'wishpost',
    name: 'WishPost',
    pattern: 'https://17track.net/nl/track?nums={tracking}',
  },
];

// Other/Custom carrier option
export const OTHER_CARRIERS: CarrierPattern[] = [
  {
    id: 'other',
    name: 'Andere',
    pattern: '',
  },
];

// Combined list for backwards compatibility
export const CARRIER_PATTERNS: CarrierPattern[] = [
  ...EU_CARRIERS,
  ...INTERNATIONAL_CARRIERS,
  ...OTHER_CARRIERS,
];

export function generateTrackingUrl(
  carrierId: string,
  trackingNumber: string,
  postalCode?: string
): string | null {
  const carrier = CARRIER_PATTERNS.find((c) => c.id === carrierId);
  
  if (!carrier || !carrier.pattern) {
    return null;
  }

  if (carrier.requiresPostalCode && !postalCode) {
    // Return URL without postal code placeholder replaced
    return carrier.pattern
      .replace('{tracking}', trackingNumber)
      .replace('&P={postalCode}', '');
  }

  return carrier.pattern
    .replace('{tracking}', trackingNumber)
    .replace('{postalCode}', postalCode || '');
}

export function getCarrierById(carrierId: string): CarrierPattern | undefined {
  return CARRIER_PATTERNS.find((c) => c.id === carrierId);
}

export function getCarrierByName(name: string): CarrierPattern | undefined {
  return CARRIER_PATTERNS.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
}
