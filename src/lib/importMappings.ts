import type { FieldMapping } from '@/types/import';

// Shopify Customer Mapping
export const SHOPIFY_CUSTOMER_MAPPING: FieldMapping = {
  'Customer ID': { target: 'external_id', transform: 'string' },
  'First Name': { target: 'first_name', required: false },
  'Last Name': { target: 'last_name', required: false },
  'Email': { target: 'email', required: true, validate: 'email' },
  'Phone': { target: 'phone', transform: 'phone' },
  'Default Address Company': { target: 'company_name' },
  'Default Address Address1': { target: 'billing_street' },
  'Default Address City': { target: 'billing_city' },
  'Default Address Province Code': { target: 'billing_state' },
  'Default Address Country Code': { target: 'billing_country', transform: 'countryCode' },
  'Default Address Zip': { target: 'billing_postal_code' },
  'Tax Exempt': { target: 'tax_exempt', transform: 'boolean' },
  'Tags': { target: 'tags', transform: 'tagArray' },
  'Note': { target: 'notes' },
};

// Shopify Product Mapping
export const SHOPIFY_PRODUCT_MAPPING: FieldMapping = {
  'Handle': { target: 'slug', required: true },
  'Title': { target: 'name', required: true },
  'Body (HTML)': { target: 'description', transform: 'html' },
  'Vendor': { target: null }, // Skip vendor
  'Product Category': { target: 'category_id', transform: 'categoryMatch' },
  'Type': { target: null },
  'Tags': { target: 'tags', transform: 'tagArray' },
  'Published': { target: 'is_active', transform: 'boolean' },
  'Variant SKU': { target: 'sku' },
  'Variant Price': { target: 'price', transform: 'decimal' },
  'Variant Compare At Price': { target: 'compare_at_price', transform: 'decimal' },
  'Variant Grams': { target: 'weight', transform: 'gramsToKg' },
  'Variant Inventory Qty': { target: 'stock', transform: 'number' },
  'Variant Barcode': { target: 'barcode' },
  'Image Src': { target: 'images', transform: 'imageArray' },
  'SEO Title': { target: 'meta_title' },
  'SEO Description': { target: 'meta_description' },
  'Cost per item': { target: 'cost_price', transform: 'decimal' },
};

// WooCommerce Customer Mapping
export const WOOCOMMERCE_CUSTOMER_MAPPING: FieldMapping = {
  'id': { target: 'external_id' },
  'email': { target: 'email', required: true, validate: 'email' },
  'first_name': { target: 'first_name' },
  'last_name': { target: 'last_name' },
  'billing_company': { target: 'company_name' },
  'billing_address_1': { target: 'billing_street' },
  'billing_city': { target: 'billing_city' },
  'billing_state': { target: 'billing_state' },
  'billing_postcode': { target: 'billing_postal_code' },
  'billing_country': { target: 'billing_country', transform: 'countryCode' },
  'billing_phone': { target: 'phone', transform: 'phone' },
  'shipping_address_1': { target: 'shipping_street' },
  'shipping_city': { target: 'shipping_city' },
  'shipping_postcode': { target: 'shipping_postal_code' },
  'shipping_country': { target: 'shipping_country', transform: 'countryCode' },
};

// WooCommerce Product Mapping
export const WOOCOMMERCE_PRODUCT_MAPPING: FieldMapping = {
  'id': { target: 'external_id' },
  'name': { target: 'name', required: true },
  'slug': { target: 'slug', required: true },
  'status': { target: 'is_active', transform: 'wooStatus' },
  'description': { target: 'description', transform: 'html' },
  'short_description': { target: 'short_description', transform: 'html' },
  'sku': { target: 'sku' },
  'price': { target: 'price', transform: 'decimal' },
  'regular_price': { target: 'compare_at_price', transform: 'decimal' },
  'stock_quantity': { target: 'stock', transform: 'number' },
  'weight': { target: 'weight', transform: 'decimal' },
  'categories': { target: 'category_id', transform: 'wcCategories' },
  'tags': { target: 'tags', transform: 'wcTags' },
  'images': { target: 'images', transform: 'wcImages' },
  // Yoast SEO fields (most common WooCommerce SEO plugin)
  'yoast_wpseo_title': { target: 'meta_title' },
  'yoast_wpseo_metadesc': { target: 'meta_description' },
  '_yoast_wpseo_title': { target: 'meta_title' },
  '_yoast_wpseo_metadesc': { target: 'meta_description' },
  // RankMath SEO fields (second most popular)
  'rank_math_title': { target: 'meta_title' },
  'rank_math_description': { target: 'meta_description' },
  // Generic SEO fields (some exports use these)
  'meta_title': { target: 'meta_title' },
  'meta_description': { target: 'meta_description' },
  'seo_title': { target: 'meta_title' },
  'seo_description': { target: 'meta_description' },
  'Meta: _yoast_wpseo_title': { target: 'meta_title' },
  'Meta: _yoast_wpseo_metadesc': { target: 'meta_description' },
};

// Shopify Category Mapping
export const SHOPIFY_CATEGORY_MAPPING: FieldMapping = {
  'Collection ID': { target: 'external_id' },
  'Handle': { target: 'slug', required: true },
  'Title': { target: 'name', required: true },
  'Body (HTML)': { target: 'description', transform: 'html' },
  'Image Src': { target: 'image_url' },
  'Sort Order': { target: 'sort_order', transform: 'number' },
  'SEO Title': { target: 'meta_title_nl' },
  'SEO Description': { target: 'meta_description_nl' },
};

// WooCommerce Category Mapping
export const WOOCOMMERCE_CATEGORY_MAPPING: FieldMapping = {
  'id': { target: 'external_id' },
  'name': { target: 'name', required: true },
  'slug': { target: 'slug', required: true },
  'parent': { target: 'parent_id' },
  'description': { target: 'description', transform: 'html' },
  'image': { target: 'image_url' },
  'menu_order': { target: 'sort_order', transform: 'number' },
  // Yoast SEO category fields
  'wpseo_title': { target: 'meta_title_nl' },
  'wpseo_desc': { target: 'meta_description_nl' },
  'yoast_wpseo_title': { target: 'meta_title_nl' },
  'yoast_wpseo_metadesc': { target: 'meta_description_nl' },
};
export function detectPlatform(headers: string[]): string {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Shopify indicators
  const shopifyIndicators = [
    'handle', 'variant sku', 'variant grams', 'variant inventory tracker',
    'default address company', 'accepts email marketing', 'customer id'
  ];
  
  // WooCommerce indicators
  const wooIndicators = [
    'billing_company', 'billing_address_1', 'shipping_address_1',
    'stock_status', 'regular_price', 'sale_price'
  ];
  
  // Magento indicators
  const magentoIndicators = [
    'attribute_set', 'configurable_variations', 'store_view_code'
  ];
  
  // PrestaShop indicators
  const prestaIndicators = [
    'id_product', 'id_category_default', 'reference'
  ];
  
  // Lightspeed indicators
  const lightspeedIndicators = [
    'product id', 'variant id', 'product type id'
  ];

  const shopifyScore = shopifyIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;
  const wooScore = wooIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;
  const magentoScore = magentoIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;
  const prestaScore = prestaIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;
  const lightspeedScore = lightspeedIndicators.filter(h => 
    normalizedHeaders.some(nh => nh.includes(h))
  ).length;

  const scores = { 
    shopify: shopifyScore, 
    woocommerce: wooScore, 
    magento: magentoScore, 
    prestashop: prestaScore,
    lightspeed: lightspeedScore
  };
  
  const maxScore = Math.max(...Object.values(scores));
  
  if (maxScore === 0) return 'csv';
  
  return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'csv';
}

// Get default mapping for platform and data type
export function getDefaultMapping(platform: string, dataType: string): FieldMapping {
  const mappings: Record<string, Record<string, FieldMapping>> = {
    shopify: {
      customers: SHOPIFY_CUSTOMER_MAPPING,
      products: SHOPIFY_PRODUCT_MAPPING,
      categories: SHOPIFY_CATEGORY_MAPPING,
    },
    woocommerce: {
      customers: WOOCOMMERCE_CUSTOMER_MAPPING,
      products: WOOCOMMERCE_PRODUCT_MAPPING,
      categories: WOOCOMMERCE_CATEGORY_MAPPING,
    },
  };
  
  return mappings[platform]?.[dataType] || {};
}

// Field transformers
export const TRANSFORMERS: Record<string, (value: string) => unknown> = {
  string: (v) => v?.trim() || null,
  
  number: (v) => {
    if (!v) return null;
    const num = parseFloat(v.replace(',', '.'));
    return isNaN(num) ? null : num;
  },
  
  decimal: (v) => {
    if (!v) return null;
    const cleaned = v.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.round(num * 100) / 100;
  },
  
  boolean: (v) => {
    if (!v) return false;
    const lower = v.toLowerCase().trim();
    return ['yes', 'true', '1', 'ja', 'oui', 'published', 'active'].includes(lower);
  },
  
  phone: (v) => {
    if (!v) return null;
    return v.replace(/[^\d+]/g, '') || null;
  },
  
  email: (v) => {
    if (!v) return null;
    const email = v.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  },
  
  countryCode: (v) => {
    if (!v) return null;
    const code = v.trim().toUpperCase();
    return code.length === 2 ? code : null;
  },
  
  tagArray: (v) => {
    if (!v) return [];
    return v.split(',').map(t => t.trim()).filter(Boolean);
  },
  
  html: (v) => {
    if (!v) return null;
    return v;
  },
  
  imageArray: (v) => {
    if (!v) return [];
    return v.split(',').map(url => url.trim()).filter(Boolean);
  },
  
  gramsToKg: (v) => {
    if (!v) return null;
    const grams = parseFloat(v);
    return isNaN(grams) ? null : Math.round(grams / 10) / 100; // Convert to kg with 2 decimals
  },
  
  wooStatus: (v) => {
    const status = v?.toLowerCase().trim();
    return status === 'publish' || status === 'published';
  },
};

// Transform a record using mapping
export function transformRecord(
  row: Record<string, string>, 
  mapping: FieldMapping
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [sourceField, config] of Object.entries(mapping)) {
    if (!config.target) continue;
    
    const value = row[sourceField];
    const transformer = config.transform ? TRANSFORMERS[config.transform] : TRANSFORMERS.string;
    
    result[config.target] = transformer ? transformer(value || '') : value;
  }
  
  return result;
}

// Validate a record
export function validateRecord(
  record: Record<string, unknown>,
  dataType: string
): { valid: boolean; errors: Array<{ field: string; error: string }> } {
  const errors: Array<{ field: string; error: string }> = [];
  
  if (dataType === 'customers') {
    if (!record.email) {
      errors.push({ field: 'email', error: 'Email is required' });
    }
  }
  
  if (dataType === 'products') {
    if (!record.name) {
      errors.push({ field: 'name', error: 'Product name is required' });
    }
    if (!record.price && record.price !== 0) {
      errors.push({ field: 'price', error: 'Price is required' });
    }
  }
  
  return { valid: errors.length === 0, errors };
}
