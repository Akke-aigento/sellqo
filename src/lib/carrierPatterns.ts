// Pre-configured carrier patterns for automatic tracking URL generation

export interface CarrierPattern {
  id: string;
  name: string;
  pattern: string;
  requiresPostalCode?: boolean;
  logoUrl?: string;
}

export const CARRIER_PATTERNS: CarrierPattern[] = [
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
  {
    id: 'other',
    name: 'Andere',
    pattern: '',
  },
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
