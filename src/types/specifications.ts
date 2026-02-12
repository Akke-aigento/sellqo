export interface ProductSpecification {
  id: string;
  product_id: string;
  tenant_id: string;
  // Dimensions & Weight
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  package_length_cm: number | null;
  package_width_cm: number | null;
  package_height_cm: number | null;
  package_weight_kg: number | null;
  units_per_package: number | null;
  // Identification
  upc: string | null;
  mpn: string | null;
  isbn: string | null;
  brand: string | null;
  manufacturer: string | null;
  model_number: string | null;
  country_of_origin: string | null;
  hs_tariff_code: string | null;
  // Material
  material: string | null;
  color: string | null;
  size: string | null;
  composition: CompositionItem[] | null;
  // Warranty & Compliance
  warranty_months: number | null;
  ce_marking: boolean | null;
  energy_label: string | null;
  safety_warnings: string | null;
  // Logistics
  lead_time_days: number | null;
  shipping_class: string | null;
  is_fragile: boolean | null;
  is_hazardous: boolean | null;
  hazard_class: string | null;
  storage_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export type CompositionItem = {
  material: string;
  percentage: number;
}

export interface ProductCustomSpec {
  id: string;
  product_id: string;
  tenant_id: string;
  group_name: string;
  spec_key: string;
  spec_value: string;
  value_type: 'text' | 'number' | 'boolean';
  sort_order: number;
  group_sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelFieldMapping {
  id: string;
  channel_type: 'bol_com' | 'amazon' | 'shopify' | 'woocommerce' | 'ebay';
  channel_category: string | null;
  sellqo_field: string;
  channel_field: string;
  channel_field_label: string;
  is_required: boolean;
  transform_rule: TransformRule | null;
  field_group: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TransformRule = {
  type?: 'unit_conversion' | 'format' | 'enum_map' | 'custom';
  from_unit?: string;
  to_unit?: string;
  conversion_factor?: number;
  format_pattern?: string;
  enum_map?: Record<string, string>;
  custom_function?: string;
}

export interface ProductChannelWarning {
  id: string;
  product_id: string;
  tenant_id: string;
  channel_type: string;
  missing_fields: string[];
  warning_message: string;
  severity: 'error' | 'warning';
  checked_at: string;
}

export interface SpecificationSection {
  group: string;
  specs: Array<{ key: string; value: string | number | boolean }>;
}

export interface ProductSpecifications {
  dimensions: Record<string, number | null>;
  identification: Record<string, string | null>;
  material: Record<string, string | null>;
  compliance: Record<string, any>;
  logistics: Record<string, any>;
  custom: SpecificationSection[];
}
