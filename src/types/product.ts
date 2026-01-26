export interface ProductMarketplaceMappings {
  bol_com?: {
    offerId: string;
    lastSync?: string;
  };
  amazon?: {
    sku: string;
    lastSync?: string;
  };
}

// Product type enum
export type ProductType = 'physical' | 'digital' | 'service' | 'subscription' | 'bundle' | 'gift_card';

// Digital delivery method enum
export type DigitalDeliveryType = 'download' | 'license_key' | 'access_url' | 'email_attachment' | 'qr_code' | 'external_service';

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  low_stock_threshold: number;
  images: string[];
  featured_image: string | null;
  category_id: string | null;
  vat_rate_id: string | null;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  is_active: boolean;
  hide_from_storefront: boolean;
  is_featured: boolean;
  weight: number | null;
  requires_shipping: boolean;
  created_at: string;
  updated_at: string;
  category?: CategoryPartial | null;
  // Marketplace integration fields
  bol_ean?: string | null;
  amazon_asin?: string | null;
  marketplace_mappings?: ProductMarketplaceMappings | null;
  sync_inventory?: boolean;
  last_inventory_sync?: string | null;
  // Bol.com listing fields
  bol_listing_status?: string | null;
  bol_offer_id?: string | null;
  bol_optimized_title?: string | null;
  bol_optimized_description?: string | null;
  bol_bullets?: string[] | null;
  bol_delivery_code?: string | null;
  bol_condition?: string | null;
  bol_fulfilment_method?: string | null;
  bol_last_synced_at?: string | null;
  bol_listing_error?: string | null;
  // Amazon listing fields
  amazon_listing_status?: string | null;
  amazon_offer_id?: string | null;
  amazon_optimized_title?: string | null;
  amazon_optimized_description?: string | null;
  amazon_bullets?: string[] | null;
  amazon_last_synced_at?: string | null;
  amazon_listing_error?: string | null;
  // Digital product fields
  product_type: ProductType;
  digital_delivery_type?: DigitalDeliveryType | null;
  download_limit?: number | null;
  download_expiry_hours?: number | null;
  license_generator?: 'manual' | 'auto' | null;
  access_duration_days?: number | null;
  file_size_bytes?: number | null;
  // Gift card specific fields
  gift_card_denominations?: number[] | null;
  gift_card_min_amount?: number | null;
  gift_card_max_amount?: number | null;
  gift_card_allow_custom?: boolean | null;
  gift_card_expiry_months?: number | null;
  gift_card_design_id?: string | null;
  // Shopify listing fields
  shopify_product_id?: string | null;
  shopify_variant_id?: string | null;
  shopify_listing_status?: string | null;
  shopify_listing_error?: string | null;
  shopify_optimized_title?: string | null;
  shopify_optimized_description?: string | null;
  shopify_last_synced_at?: string | null;
  // WooCommerce listing fields
  woocommerce_product_id?: string | null;
  woocommerce_variant_id?: string | null;
  woocommerce_listing_status?: string | null;
  woocommerce_listing_error?: string | null;
  woocommerce_optimized_title?: string | null;
  woocommerce_optimized_description?: string | null;
  woocommerce_last_synced_at?: string | null;
  // Odoo listing fields
  odoo_product_id?: string | null;
  odoo_variant_id?: string | null;
  odoo_listing_status?: string | null;
  odoo_listing_error?: string | null;
  odoo_optimized_title?: string | null;
  odoo_optimized_description?: string | null;
  odoo_last_synced_at?: string | null;
  // Social channels
  social_channels?: Record<string, boolean> | null;
}

// Partial category for product listing (only id, name, slug returned by query)
export interface CategoryPartial {
  id: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  hide_from_storefront: boolean;
  created_at: string;
  updated_at: string;
  parent?: Category;
  children?: Category[];
}

export interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  short_description: string;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  sku: string;
  barcode: string;
  stock: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  low_stock_threshold: number;
  images: string[];
  featured_image: string;
  category_id: string;
  vat_rate_id: string | null;
  tags: string[];
  meta_title: string;
  meta_description: string;
  is_active: boolean;
  hide_from_storefront: boolean;
  is_featured: boolean;
  weight: number | null;
  requires_shipping: boolean;
  // Digital product fields
  product_type: ProductType;
  digital_delivery_type?: DigitalDeliveryType | null;
  download_limit?: number | null;
  download_expiry_hours?: number | null;
  license_generator?: 'manual' | 'auto' | null;
  access_duration_days?: number | null;
  // Gift card specific fields
  gift_card_denominations?: number[] | null;
  gift_card_min_amount?: number | null;
  gift_card_max_amount?: number | null;
  gift_card_allow_custom?: boolean | null;
  gift_card_expiry_months?: number | null;
  gift_card_design_id?: string | null;
}

export interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  image_url: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  hide_from_storefront: boolean;
}

export type ProductStatus = 'all' | 'active' | 'inactive';
export type VisibilityStatus = 'all' | 'online' | 'store_only' | 'hidden';
export type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

// Digital product file
export interface ProductFile {
  id: string;
  product_id: string;
  tenant_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  version: string;
  is_preview: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// License key for software products
export interface LicenseKey {
  id: string;
  product_id: string;
  tenant_id: string;
  license_key: string;
  status: 'available' | 'assigned' | 'revoked';
  assigned_to_order_item_id?: string | null;
  assigned_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

// Digital delivery tracking
export interface DigitalDelivery {
  id: string;
  order_item_id: string;
  tenant_id: string;
  product_file_id?: string | null;
  license_key_id?: string | null;
  download_token?: string | null;
  download_url?: string | null;
  access_url?: string | null;
  download_count: number;
  download_limit?: number | null;
  expires_at?: string | null;
  first_accessed_at?: string | null;
  last_accessed_at?: string | null;
  status: 'pending' | 'active' | 'expired' | 'revoked';
  delivery_data?: Record<string, unknown> | null;
  created_at: string;
}

// Product type display info
export const productTypeInfo: Record<ProductType, { label: string; description: string; icon: string }> = {
  physical: {
    label: 'Fysiek product',
    description: 'Producten die verzonden moeten worden',
    icon: 'Package',
  },
  digital: {
    label: 'Digitaal product',
    description: 'Downloads, licenties, e-books, software',
    icon: 'Download',
  },
  service: {
    label: 'Dienst',
    description: 'Diensten zonder fysieke levering',
    icon: 'Briefcase',
  },
  subscription: {
    label: 'Abonnement',
    description: 'Terugkerende betalingen en toegang',
    icon: 'RefreshCw',
  },
  bundle: {
    label: 'Bundel',
    description: 'Combinatie van producten en/of diensten',
    icon: 'Layers',
  },
  gift_card: {
    label: 'Cadeaukaart',
    description: 'Digitale cadeaukaart met waarde',
    icon: 'CreditCard',
  },
};

// Digital delivery type display info
export const digitalDeliveryTypeInfo: Record<DigitalDeliveryType, { label: string; description: string }> = {
  download: {
    label: 'Download',
    description: 'Directe bestandsdownload',
  },
  license_key: {
    label: 'Licentiecode',
    description: 'Software activeringscode',
  },
  access_url: {
    label: 'Toegangs-URL',
    description: 'Link naar content (streaming, SaaS)',
  },
  email_attachment: {
    label: 'E-mail bijlage',
    description: 'Bestand per e-mail verzenden',
  },
  qr_code: {
    label: 'QR-code',
    description: 'Tickets, evenementen, toegang',
  },
  external_service: {
    label: 'Externe dienst',
    description: 'Activering bij externe provider',
  },
};
