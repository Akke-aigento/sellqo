export interface ShippingMethod {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  price: number;
  free_above: number | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number | null;
  shipping_class: string | null;
  shipping_class_id: string | null;
  /** SHIP-GEO-1 — ISO-2 landcodes. Leeg/null = alle toegestane landen. */
  countries: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ShippingMethodFormData {
  name: string;
  description?: string;
  price: number;
  free_above?: number | null;
  estimated_days_min?: number;
  estimated_days_max?: number;
  is_active: boolean;
  is_default: boolean;
  shipping_class_id?: string | null;
  countries?: string[] | null;
}

export interface ShippingClass {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShippingClassWithCounts extends ShippingClass {
  method_count: number;
  product_count: number;
}

export interface ShippingClassFormData {
  name: string;
  description?: string | null;
  sort_order?: number;
}

export type ShippingConflictRule = "highest_price" | "sum";
