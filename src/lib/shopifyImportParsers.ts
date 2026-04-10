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
  featured_image: string | null;
  variants: ParsedVariant[];
  // Nieuwe velden voor complete import
  handle: string | null;
  shopify_id: string | null;
  status: string;
  published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  google_product_category: string | null;
  image_alt_texts: string[];
  created_at: string;
  requires_shipping: boolean;
  taxable: boolean;
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
  shipping_province: string | null;
  shipping_country: string;
  line_items: ParsedLineItem[];
  // Nieuwe velden voor complete import
  shopify_order_id: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  fulfilled_at: string | null;
  billing_name: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_zip: string | null;
  billing_province: string | null;
  billing_country: string | null;
  billing_phone: string | null;
  phone: string | null;
  note: string | null;
  tags: string[];
  risk_level: string | null;
  payment_reference: string | null;
}

export interface ParsedLineItem {
  title: string;
  sku: string;
  quantity: number;
  price: number;
  // Nieuwe velden
  variant_id: string | null;
  variant_title: string | null;
  vendor: string | null;
  fulfillment_status: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
}

export interface ParsedCustomer {
  id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string | null;
  address_phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  province_code: string | null;
  zip: string | null;
  country: string | null;
  country_code: string | null;
  accepts_marketing: boolean;
  accepts_sms_marketing: boolean;
  total_spent: number;
  orders_count: number;
  tags: string[];
  note: string | null;
  tax_exempt: boolean;
  verified_email: boolean;
  email_marketing_status: string | null;
  email_marketing_level: string | null;
  sms_marketing_status: string | null;
  sms_marketing_level: string | null;
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
      const status = row['Status'] || row['status'] || 'active';
      const published = (row['Published'] || row['published'] || 'true').toLowerCase() === 'true';
      
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
        featured_image: null,
        variants: [],
        // Nieuwe velden
        handle: handle,
        shopify_id: row['ID'] || row['id'] || null,
        status,
        published,
        seo_title: row['SEO Title'] || row['seo_title'] || null,
        seo_description: row['SEO Description'] || row['seo_description'] || null,
        // Product Category (Shopify's nieuwe categorisatie) - jouw export gebruikt 'Product Category'
        google_product_category: row['Product Category'] || row['Google Shopping / Google Product Category'] || row['Google: Category'] || null,
        image_alt_texts: [],
        created_at: row['Created At'] || row['created_at'] || new Date().toISOString(),
        requires_shipping: (row['Variant Requires Shipping'] || 'true').toLowerCase() === 'true',
        taxable: (row['Variant Taxable'] || 'true').toLowerCase() === 'true',
      };
      productsMap.set(handle, product);
    }
    
    // Add image
    const imageSrc = row['Image Src'] || row['image_src'];
    if (imageSrc && !product.images.includes(imageSrc)) {
      product.images.push(imageSrc);
      // Add alt text if available
      const altText = row['Image Alt Text'] || row['image_alt_text'];
      if (altText) {
        product.image_alt_texts.push(altText);
      }
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
  
  // Ensure featured_image is always images[0]
  const results = Array.from(productsMap.values());
  for (const product of results) {
    if (!product.featured_image && product.images.length > 0) {
      product.featured_image = product.images[0];
    }
    if (product.featured_image && product.images[0] !== product.featured_image) {
      product.images = [product.featured_image, ...product.images.filter(i => i !== product.featured_image)];
    }
  }
  return results;
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
        shipping_province: row['Shipping Province'] || row['shipping_province'] || null,
        shipping_country: row['Shipping Country'] || row['shipping_country'] || 'NL',
        line_items: [],
        // Nieuwe velden - Let op: 'Id' met kleine 'd' in jouw export!
        shopify_order_id: row['Id'] || row['ID'] || row['id'] || null,
        paid_at: row['Paid at'] || row['paid_at'] || null,
        cancelled_at: row['Cancelled at'] || row['cancelled_at'] || null,
        fulfilled_at: row['Fulfilled at'] || row['fulfilled_at'] || null,
        billing_name: row['Billing Name'] || row['billing_name'] || null,
        billing_street: row['Billing Street'] || row['Billing Address1'] || null,
        billing_city: row['Billing City'] || row['billing_city'] || null,
        billing_zip: row['Billing Zip'] || row['billing_zip'] || null,
        billing_province: row['Billing Province'] || row['billing_province'] || null,
        billing_country: row['Billing Country'] || row['billing_country'] || null,
        billing_phone: row['Billing Phone'] || row['billing_phone'] || null,
        phone: row['Phone'] || row['phone'] || null,
        note: row['Notes'] || row['Note'] || row['notes'] || null,
        tags: (row['Tags'] || row['tags'] || '').split(',').map(t => t.trim()).filter(Boolean),
        risk_level: row['Risk Level'] || row['risk_level'] || null,
        payment_reference: row['Payment Reference'] || row['payment_reference'] || null,
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
        // Nieuwe velden
        variant_id: row['Lineitem variant id'] || null,
        variant_title: row['Lineitem variant title'] || null,
        vendor: row['Lineitem vendor'] || row['Vendor'] || null,
        fulfillment_status: row['Lineitem fulfillment status'] || null,
        requires_shipping: (row['Lineitem requires shipping'] || 'true').toLowerCase() === 'true',
        taxable: (row['Lineitem taxable'] || 'true').toLowerCase() === 'true',
        gift_card: (row['Lineitem gift card'] || row['Gift Card'] || 'false').toLowerCase() === 'true',
      });
    }
  }
  
  return Array.from(ordersMap.values());
}

// Parse Shopify customers export
export function parseShopifyCustomers(csvString: string): ParsedCustomer[] {
  const rows = parseCSV(csvString);
  
  return rows.map(row => ({
    // Shopify Customer ID - Let op: 'Customer ID' in jouw export!
    id: row['Customer ID'] || row['ID'] || row['id'] || null,
    
    // Basis info
    email: row['Email'] || row['email'] || '',
    first_name: row['First Name'] || row['first_name'] || '',
    last_name: row['Last Name'] || row['last_name'] || '',
    
    // Bedrijf - Let op: "Default Address" prefix in jouw export!
    company: row['Default Address Company'] || row['Company'] || row['company'] || null,
    
    // Telefoon - zowel direct als adres telefoon
    phone: row['Phone'] || row['phone'] || null,
    address_phone: row['Default Address Phone'] || null,
    
    // Adres - Let op: "Default Address" prefix in jouw export!
    address1: row['Default Address Address1'] || row['Address1'] || row['address1'] || null,
    address2: row['Default Address Address2'] || row['Address2'] || row['address2'] || null,
    city: row['Default Address City'] || row['City'] || row['city'] || null,
    province: row['Default Address Province'] || row['Province'] || row['province'] || null,
    province_code: row['Default Address Province Code'] || row['Province Code'] || null,
    zip: row['Default Address Zip'] || row['Zip'] || row['zip'] || null,
    country: row['Default Address Country'] || row['Country'] || row['country'] || null,
    country_code: row['Default Address Country Code'] || row['Country Code'] || null,
    
    // Marketing - Let op exacte kolomnamen in jouw export!
    accepts_marketing: (row['Accepts Email Marketing'] || row['Accepts Marketing'] || '').toLowerCase() === 'yes',
    accepts_sms_marketing: (row['Accepts SMS Marketing'] || '').toLowerCase() === 'yes',
    
    // Stats - Let op: "Total Orders" niet "Orders Count" in jouw export!
    total_spent: parseFloat((row['Total Spent'] || '0').replace(/[^0-9.-]/g, '')) || 0,
    orders_count: parseInt(row['Total Orders'] || row['Orders Count'] || '0') || 0,
    
    // Extra velden
    tags: (row['Tags'] || row['tags'] || '').split(',').map(t => t.trim()).filter(Boolean),
    note: row['Note'] || row['note'] || null,
    tax_exempt: (row['Tax Exempt'] || 'no').toLowerCase() === 'yes',
    verified_email: (row['Verified Email'] || 'no').toLowerCase() === 'yes',
    
    // Marketing status velden
    email_marketing_status: row['Email Marketing: Status'] || null,
    email_marketing_level: row['Email Marketing: Level'] || null,
    sms_marketing_status: row['SMS Marketing: Status'] || null,
    sms_marketing_level: row['SMS Marketing: Level'] || null,
    
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
