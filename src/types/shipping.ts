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
}
