// Shopify CSV export parsers for manual import

export interface ParsedProduct {
  title: string;
  description: string;
  sku: string;
  barcode: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  stock: number;
  weight: number | null;
  weight_unit: string;
  vendor: string | null;
  product_type: string | null;
  tags: string[];
  images: string[];
  variants: ParsedVariant[];
}

export interface ParsedVariant {
  title: string;
  sku: string;
  barcode: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  weight: number | null;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
}

export interface ParsedOrder {
  order_number: string;
  email: string;
  financial_status: string;
  fulfillment_status: string | null;
  currency: string;
  subtotal: number;
  shipping: number;
  taxes: number;
  total: number;
  discount_code: string | null;
  discount_amount: number;
  created_at: string;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_zip: string;
  shipping_country: string;
  line_items: ParsedLineItem[];
}

export interface ParsedLineItem {
  title: string;
  sku: string;
  quantity: number;
  price: number;
}

export interface ParsedCustomer {
  email: string;
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  zip: string | null;
  country: string | null;
  accepts_marketing: boolean;
  total_spent: number;
  orders_count: number;
  tags: string[];
  created_at: string;
}

export interface ParsedDiscount {
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: number;
  usage_count: number;
  usage_limit: number | null;
  minimum_amount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

// Parse CSV string to array of objects
function parseCSV(csvString: string): Record<string, string>[] {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header - handle quoted fields
  const header = parseCSVLine(lines[0]);
  
  const results: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj: Record<string, string> = {};
    
    header.forEach((key, index) => {
      obj[key.trim()] = values[index]?.trim() || '';
    });
    
    results.push(obj);
  }
  
  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

// Parse Shopify products export
export function parseShopifyProducts(csvString: string): ParsedProduct[] {
  const rows = parseCSV(csvString);
  const productsMap = new Map<string, ParsedProduct>();
  
  for (const row of rows) {
    const handle = row['Handle'] || row['handle'];
    if (!handle) continue;
    
    let product = productsMap.get(handle);
    
    if (!product) {
      product = {
        title: row['Title'] || row['title'] || '',
        description: row['Body (HTML)'] || row['body_html'] || '',
        sku: row['Variant SKU'] || row['sku'] || '',
        barcode: row['Variant Barcode'] || row['barcode'] || null,
        price: parseFloat(row['Variant Price'] || row['price'] || '0') || 0,
        compare_at_price: parseFloat(row['Variant Compare At Price'] || '') || null,
        cost_price: parseFloat(row['Cost per item'] || '') || null,
        stock: parseInt(row['Variant Inventory Qty'] || row['inventory_quantity'] || '0') || 0,
        weight: parseFloat(row['Variant Grams'] || '0') / 1000 || null,
        weight_unit: 'kg',
        vendor: row['Vendor'] || row['vendor'] || null,
        product_type: row['Type'] || row['product_type'] || null,
        tags: (row['Tags'] || row['tags'] || '').split(',').map(t => t.trim()).filter(Boolean),
        images: [],
        variants: [],
      };
      productsMap.set(handle, product);
    }
    
    // Add image
    const imageSrc = row['Image Src'] || row['image_src'];
    if (imageSrc && !product.images.includes(imageSrc)) {
      product.images.push(imageSrc);
    }
    
    // Add variant if it has variant-specific data
    const variantTitle = row['Option1 Value'] || row['Variant Title'];
    if (variantTitle && variantTitle !== 'Default Title') {
      product.variants.push({
        title: variantTitle,
        sku: row['Variant SKU'] || '',
        barcode: row['Variant Barcode'] || null,
        price: parseFloat(row['Variant Price'] || '0') || 0,
        compare_at_price: parseFloat(row['Variant Compare At Price'] || '') || null,
        stock: parseInt(row['Variant Inventory Qty'] || '0') || 0,
        weight: parseFloat(row['Variant Grams'] || '0') / 1000 || null,
        option1_name: row['Option1 Name'] || null,
        option1_value: row['Option1 Value'] || null,
        option2_name: row['Option2 Name'] || null,
        option2_value: row['Option2 Value'] || null,
        option3_name: row['Option3 Name'] || null,
        option3_value: row['Option3 Value'] || null,
      });
    }
  }
  
  return Array.from(productsMap.values());
}

// Parse Shopify orders export
export function parseShopifyOrders(csvString: string): ParsedOrder[] {
  const rows = parseCSV(csvString);
  const ordersMap = new Map<string, ParsedOrder>();
  
  for (const row of rows) {
    const orderNumber = row['Name'] || row['name'] || row['Order'];
    if (!orderNumber) continue;
    
    let order = ordersMap.get(orderNumber);
    
    if (!order) {
      order = {
        order_number: orderNumber,
        email: row['Email'] || row['email'] || '',
        financial_status: row['Financial Status'] || row['financial_status'] || 'pending',
        fulfillment_status: row['Fulfillment Status'] || row['fulfillment_status'] || null,
        currency: row['Currency'] || row['currency'] || 'EUR',
        subtotal: parseFloat(row['Subtotal'] || row['subtotal'] || '0') || 0,
        shipping: parseFloat(row['Shipping'] || row['shipping'] || '0') || 0,
        taxes: parseFloat(row['Taxes'] || row['taxes'] || '0') || 0,
        total: parseFloat(row['Total'] || row['total'] || '0') || 0,
        discount_code: row['Discount Code'] || row['discount_code'] || null,
        discount_amount: parseFloat(row['Discount Amount'] || row['discount_amount'] || '0') || 0,
        created_at: row['Created at'] || row['created_at'] || new Date().toISOString(),
        shipping_name: row['Shipping Name'] || row['shipping_name'] || '',
        shipping_address: row['Shipping Street'] || row['Shipping Address1'] || '',
        shipping_city: row['Shipping City'] || row['shipping_city'] || '',
        shipping_zip: row['Shipping Zip'] || row['shipping_zip'] || '',
        shipping_country: row['Shipping Country'] || row['shipping_country'] || 'NL',
        line_items: [],
      };
      ordersMap.set(orderNumber, order);
    }
    
    // Add line item
    const itemTitle = row['Lineitem name'] || row['lineitem_name'];
    if (itemTitle) {
      order.line_items.push({
        title: itemTitle,
        sku: row['Lineitem sku'] || row['lineitem_sku'] || '',
        quantity: parseInt(row['Lineitem quantity'] || row['lineitem_quantity'] || '1') || 1,
        price: parseFloat(row['Lineitem price'] || row['lineitem_price'] || '0') || 0,
      });
    }
  }
  
  return Array.from(ordersMap.values());
}

// Parse Shopify customers export
export function parseShopifyCustomers(csvString: string): ParsedCustomer[] {
  const rows = parseCSV(csvString);
  
  return rows.map(row => ({
    email: row['Email'] || row['email'] || '',
    first_name: row['First Name'] || row['first_name'] || '',
    last_name: row['Last Name'] || row['last_name'] || '',
    company: row['Company'] || row['company'] || null,
    phone: row['Phone'] || row['phone'] || null,
    address1: row['Address1'] || row['address1'] || null,
    address2: row['Address2'] || row['address2'] || null,
    city: row['City'] || row['city'] || null,
    province: row['Province'] || row['province'] || null,
    zip: row['Zip'] || row['zip'] || null,
    country: row['Country'] || row['country'] || null,
    accepts_marketing: (row['Accepts Marketing'] || row['accepts_marketing'] || '').toLowerCase() === 'yes',
    total_spent: parseFloat(row['Total Spent'] || row['total_spent'] || '0') || 0,
    orders_count: parseInt(row['Orders Count'] || row['orders_count'] || '0') || 0,
    tags: (row['Tags'] || row['tags'] || '').split(',').map(t => t.trim()).filter(Boolean),
    created_at: row['Created At'] || row['created_at'] || new Date().toISOString(),
  })).filter(c => c.email);
}

// Parse Shopify discounts export
export function parseShopifyDiscounts(csvString: string): ParsedDiscount[] {
  const rows = parseCSV(csvString);
  
  return rows.map(row => {
    const type = row['Type'] || row['type'] || '';
    let discountType: ParsedDiscount['type'] = 'percentage';
    
    if (type.toLowerCase().includes('fixed') || type.toLowerCase().includes('amount')) {
      discountType = 'fixed_amount';
    } else if (type.toLowerCase().includes('shipping')) {
      discountType = 'free_shipping';
    }
    
    return {
      code: row['Code'] || row['code'] || '',
      type: discountType,
      value: parseFloat(row['Value'] || row['value'] || row['Amount'] || '0') || 0,
      usage_count: parseInt(row['Usage Count'] || row['usage_count'] || '0') || 0,
      usage_limit: parseInt(row['Usage Limit'] || row['usage_limit'] || '') || null,
      minimum_amount: parseFloat(row['Minimum Amount'] || row['minimum_amount'] || '') || null,
      starts_at: row['Starts At'] || row['starts_at'] || null,
      ends_at: row['Ends At'] || row['ends_at'] || null,
      is_active: (row['Status'] || row['status'] || '').toLowerCase() !== 'disabled',
    };
  }).filter(d => d.code);
}

// Validate parsed data
export function validateProducts(products: ParsedProduct[]): { valid: ParsedProduct[]; errors: string[] } {
  const valid: ParsedProduct[] = [];
  const errors: string[] = [];
  
  products.forEach((product, index) => {
    if (!product.title) {
      errors.push(`Rij ${index + 2}: Product titel ontbreekt`);
      return;
    }
    if (product.price < 0) {
      errors.push(`Rij ${index + 2}: Ongeldige prijs voor "${product.title}"`);
      return;
    }
    valid.push(product);
  });
  
  return { valid, errors };
}

export function validateOrders(orders: ParsedOrder[]): { valid: ParsedOrder[]; errors: string[] } {
  const valid: ParsedOrder[] = [];
  const errors: string[] = [];
  
  orders.forEach((order, index) => {
    if (!order.order_number) {
      errors.push(`Rij ${index + 2}: Ordernummer ontbreekt`);
      return;
    }
    if (order.line_items.length === 0) {
      errors.push(`Rij ${index + 2}: Order ${order.order_number} heeft geen producten`);
      return;
    }
    valid.push(order);
  });
  
  return { valid, errors };
}

export function validateCustomers(customers: ParsedCustomer[]): { valid: ParsedCustomer[]; errors: string[] } {
  const valid: ParsedCustomer[] = [];
  const errors: string[] = [];
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  customers.forEach((customer, index) => {
    if (!customer.email) {
      errors.push(`Rij ${index + 2}: Email ontbreekt`);
      return;
    }
    if (!emailRegex.test(customer.email)) {
      errors.push(`Rij ${index + 2}: Ongeldige email "${customer.email}"`);
      return;
    }
    valid.push(customer);
  });
  
  return { valid, errors };
}
