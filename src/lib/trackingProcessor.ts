// Carrier name normalization map
export const CARRIER_ALIASES: Record<string, string> = {
  // China carriers
  'china post': 'china_post',
  'chinapost': 'china_post',
  'china-post': 'china_post',
  'yanwen': 'yanwen',
  'yan wen': 'yanwen',
  'cainiao': 'cainiao',
  'aliexpress': 'cainiao',
  '4px': '4px',
  'epacket': 'epacket',
  'e-packet': 'epacket',
  'yunexpress': 'yunexpress',
  'yun express': 'yunexpress',
  'sf express': 'sf_express',
  'sfexpress': 'sf_express',
  '17track': '17track',
  // EU carriers
  'postnl': 'postnl',
  'post nl': 'postnl',
  'dhl': 'dhl',
  'dhl express': 'dhl',
  'dhl ecommerce': 'dhl_ecommerce',
  'dpd': 'dpd',
  'bpost': 'bpost',
  'gls': 'gls',
  'ups': 'ups',
  'fedex': 'fedex',
  // UK/US
  'royal mail': 'royal_mail',
  'royalmail': 'royal_mail',
  'usps': 'usps',
  'parcel force': 'parcel_force',
  'parcelforce': 'parcel_force',
};

export function normalizeCarrier(carrier: string): string {
  if (!carrier) return 'other';
  const normalized = carrier.toLowerCase().trim().replace(/[-_\s]+/g, ' ');
  return CARRIER_ALIASES[normalized] || carrier.toLowerCase().replace(/\s+/g, '_');
}

// Column name alternatives for CSV import
export const COLUMN_ALTERNATIVES: Record<string, string[]> = {
  order_reference: ['order_reference', 'order_number', 'order_id', 'bestelnummer', 'reference', 'ref', 'ordernummer'],
  carrier: ['carrier', 'courier', 'verzender', 'shipping_carrier', 'transporter', 'vervoerder'],
  tracking_number: ['tracking_number', 'track_trace', 'trackingnummer', 'barcode', 'tracking', 'tracknumber', 'zendingsnummer'],
  tracking_url: ['tracking_url', 'track_url', 'url', 'link'],
  shipped_at: ['shipped_at', 'ship_date', 'verzenddatum', 'shipped_date', 'date', 'datum'],
};

export function findColumnName(headers: string[], targetColumn: string): string | null {
  const alternatives = COLUMN_ALTERNATIVES[targetColumn] || [targetColumn];
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
  
  for (const alt of alternatives) {
    const normalizedAlt = alt.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const index = normalizedHeaders.findIndex(h => h === normalizedAlt);
    if (index !== -1) {
      return headers[index];
    }
  }
  return null;
}

export interface CSVRow {
  order_reference: string;
  carrier?: string;
  tracking_number: string;
  tracking_url?: string;
  shipped_at?: string;
}

export interface ParsedCSV {
  rows: CSVRow[];
  headers: string[];
  columnMapping: Record<string, string>;
  errors: string[];
}

export function parseCSV(csvContent: string): ParsedCSV {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  const errors: string[] = [];
  
  if (lines.length < 2) {
    errors.push('CSV must have at least a header row and one data row');
    return { rows: [], headers: [], columnMapping: {}, errors };
  }
  
  // Parse headers (support both comma and semicolon)
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  // Find column mappings
  const orderRefCol = findColumnName(headers, 'order_reference');
  const carrierCol = findColumnName(headers, 'carrier');
  const trackingCol = findColumnName(headers, 'tracking_number');
  const urlCol = findColumnName(headers, 'tracking_url');
  const dateCol = findColumnName(headers, 'shipped_at');
  
  if (!orderRefCol) {
    errors.push('Could not find order reference column. Expected: order_reference, order_number, bestelnummer');
  }
  if (!trackingCol) {
    errors.push('Could not find tracking number column. Expected: tracking_number, track_trace, barcode');
  }
  
  if (errors.length > 0) {
    return { rows: [], headers, columnMapping: {}, errors };
  }
  
  const columnMapping: Record<string, string> = {
    order_reference: orderRefCol!,
    tracking_number: trackingCol!,
  };
  if (carrierCol) columnMapping.carrier = carrierCol;
  if (urlCol) columnMapping.tracking_url = urlCol;
  if (dateCol) columnMapping.shipped_at = dateCol;
  
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    
    const getVal = (colName: string | undefined) => {
      if (!colName) return undefined;
      const idx = headers.indexOf(colName);
      return idx !== -1 ? values[idx] || undefined : undefined;
    };
    
    const orderRef = getVal(orderRefCol);
    const trackingNum = getVal(trackingCol);
    
    if (!orderRef || !trackingNum) {
      errors.push(`Row ${i + 1}: Missing required fields`);
      continue;
    }
    
    rows.push({
      order_reference: orderRef,
      carrier: getVal(carrierCol),
      tracking_number: trackingNum,
      tracking_url: getVal(urlCol),
      shipped_at: getVal(dateCol),
    });
  }
  
  return { rows, headers, columnMapping, errors };
}

export interface ImportResult {
  total: number;
  matched: number;
  failed: number;
  results: {
    order_reference: string;
    status: 'success' | 'not_found' | 'error';
    order_id?: string;
    error?: string;
  }[];
}
