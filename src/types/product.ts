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
  is_featured: boolean;
  weight: number | null;
  requires_shipping: boolean;
  created_at: string;
  updated_at: string;
  category?: CategoryPartial | null;
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
  is_featured: boolean;
  weight: number | null;
  requires_shipping: boolean;
}

export interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  image_url: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export type ProductStatus = 'all' | 'active' | 'inactive';
export type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
