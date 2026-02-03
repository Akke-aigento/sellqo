import type { FieldMapping } from '@/types/import';

// Bol.com Verkoopanalyse CSV Export Mapping
export const BOL_ORDER_CSV_MAPPING: FieldMapping = {
  'Bestelnummer': { target: 'marketplace_order_id', required: true },
  'Besteldatum': { target: 'created_at', transform: 'bolDate' },
  'Order ID': { target: 'marketplace_order_id', required: true, fallback: true },
  'Ordernummer': { target: 'marketplace_order_id', required: true, fallback: true },
  'Verzonden op': { target: 'shipped_at', transform: 'bolDate' },
  'Verzenddatum': { target: 'shipped_at', transform: 'bolDate' },
  'EAN': { target: 'ean' },
  'Titel': { target: 'product_name' },
  'Productnaam': { target: 'product_name', fallback: true },
  'Aantal': { target: 'quantity', transform: 'number' },
  'Prijs': { target: 'unit_price', transform: 'decimal' },
  'Prijs (incl. BTW)': { target: 'unit_price', transform: 'decimal' },
  'Verkoopprijs': { target: 'unit_price', transform: 'decimal', fallback: true },
  'Verzendkosten': { target: 'shipping_cost', transform: 'decimal' },
  'Commissie': { target: 'commission', transform: 'decimal' },
  'Bol.com commissie': { target: 'commission', transform: 'decimal', fallback: true },
  'Naam': { target: 'customer_name' },
  'Klantnaam': { target: 'customer_name', fallback: true },
  'E-mail': { target: 'customer_email', validate: 'email' },
  'Email': { target: 'customer_email', validate: 'email', fallback: true },
  'Straat': { target: 'shipping_street' },
  'Huisnummer': { target: 'shipping_house_number' },
  'Postcode': { target: 'shipping_postal_code' },
  'Plaats': { target: 'shipping_city' },
  'Stad': { target: 'shipping_city', fallback: true },
  'Land': { target: 'shipping_country' },
  'Fulfilment': { target: 'fulfillment_method' },
  'Fulfilment methode': { target: 'fulfillment_method', fallback: true },
  'Status': { target: 'order_status' },
  'Orderstatus': { target: 'order_status', fallback: true },
  'SKU': { target: 'sku' },
  'Artikelnummer': { target: 'sku', fallback: true },
  'BTW-percentage': { target: 'vat_percentage', transform: 'decimal' },
  'BTW-bedrag': { target: 'vat_amount', transform: 'decimal' },
};

// Bol.com specific date transformer
export const bolDateTransformer = (value: string): string | null => {
  if (!value) return null;
  
  // Try common Dutch date formats
  const formats = [
    // DD-MM-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // DD-MM-YYYY HH:mm
    /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})$/,
  ];
  
  // Try DD-MM-YYYY format first (most common for Bol.com)
  const dmyMatch = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try YYYY-MM-DD (ISO format)
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return value.split(' ')[0]; // Return date part only
  }
  
  // Try DD/MM/YYYY format
  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Fallback: try native Date parsing
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Ignore parsing errors
  }
  
  return null;
};

// Detect if CSV is from Bol.com
export function detectBolCsv(headers: string[]): boolean {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  const bolIndicators = [
    'bestelnummer',
    'besteldatum',
    'bol.com commissie',
    'fulfilment',
    'verzonden op',
    'ordernummer',
  ];
  
  const matchCount = bolIndicators.filter(indicator => 
    normalizedHeaders.some(h => h.includes(indicator))
  ).length;
  
  // If at least 2 Bol-specific columns are found, it's likely a Bol.com export
  return matchCount >= 2;
}

// Get required columns for Bol.com order import
export const BOL_REQUIRED_COLUMNS = [
  { key: 'order_id', labels: ['Bestelnummer', 'Order ID', 'Ordernummer'] },
  { key: 'date', labels: ['Besteldatum', 'Orderdatum'] },
  { key: 'product', labels: ['Titel', 'Productnaam', 'Product'] },
  { key: 'quantity', labels: ['Aantal', 'Quantity'] },
  { key: 'price', labels: ['Prijs', 'Prijs (incl. BTW)', 'Verkoopprijs'] },
];

// Find the best matching header for a required column
export function findMatchingHeader(headers: string[], labels: string[]): string | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  for (const label of labels) {
    const index = normalizedHeaders.indexOf(label.toLowerCase());
    if (index !== -1) {
      return headers[index];
    }
  }
  
  return null;
}

// Parse Bol.com CSV row into order data
export interface BolOrderRow {
  orderId: string;
  orderDate: string | null;
  shippedAt: string | null;
  ean: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  shippingCost: number;
  commission: number;
  customerName: string | null;
  customerEmail: string | null;
  shippingStreet: string | null;
  shippingHouseNumber: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  fulfillmentMethod: string | null;
  sku: string | null;
  vatPercentage: number | null;
  vatAmount: number | null;
}

export function parseBolCsvRow(row: Record<string, string>, headers: string[]): BolOrderRow | null {
  // Find order ID column
  const orderIdHeader = findMatchingHeader(headers, ['Bestelnummer', 'Order ID', 'Ordernummer']);
  if (!orderIdHeader || !row[orderIdHeader]) {
    return null;
  }
  
  const findValue = (labels: string[]): string => {
    const header = findMatchingHeader(headers, labels);
    return header ? (row[header] || '') : '';
  };
  
  const parseDecimal = (value: string): number => {
    if (!value) return 0;
    const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  };
  
  return {
    orderId: row[orderIdHeader],
    orderDate: bolDateTransformer(findValue(['Besteldatum', 'Orderdatum'])),
    shippedAt: bolDateTransformer(findValue(['Verzonden op', 'Verzenddatum'])),
    ean: findValue(['EAN']) || null,
    productName: findValue(['Titel', 'Productnaam', 'Product']) || 'Onbekend product',
    quantity: parseInt(findValue(['Aantal', 'Quantity'])) || 1,
    unitPrice: parseDecimal(findValue(['Prijs', 'Prijs (incl. BTW)', 'Verkoopprijs'])),
    shippingCost: parseDecimal(findValue(['Verzendkosten'])),
    commission: parseDecimal(findValue(['Commissie', 'Bol.com commissie'])),
    customerName: findValue(['Naam', 'Klantnaam']) || null,
    customerEmail: findValue(['E-mail', 'Email']) || null,
    shippingStreet: findValue(['Straat']) || null,
    shippingHouseNumber: findValue(['Huisnummer']) || null,
    shippingPostalCode: findValue(['Postcode']) || null,
    shippingCity: findValue(['Plaats', 'Stad']) || null,
    shippingCountry: findValue(['Land']) || 'NL',
    fulfillmentMethod: findValue(['Fulfilment', 'Fulfilment methode']) || null,
    sku: findValue(['SKU', 'Artikelnummer']) || null,
    vatPercentage: parseDecimal(findValue(['BTW-percentage'])) || null,
    vatAmount: parseDecimal(findValue(['BTW-bedrag'])) || null,
  };
}
