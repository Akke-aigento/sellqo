// Platform types
export type ImportPlatform = 'shopify' | 'woocommerce' | 'magento' | 'prestashop' | 'lightspeed' | 'csv';

export type ImportDataType = 'customers' | 'products' | 'categories' | 'orders' | 'coupons';

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Field mapping types
export interface FieldMappingItem {
  target: string | null; // null = skip
  transform?: string;
  required?: boolean;
  validate?: string;
  fallback?: boolean;
}

export interface FieldMapping {
  [sourceField: string]: FieldMappingItem;
}

export interface MappingOption {
  sourceField: string;
  targetField: string | null;
  confidence: number;
  transform?: string;
  reason?: string;
}

// Import job types
export interface ImportJob {
  id: string;
  tenant_id: string;
  source_platform: ImportPlatform;
  data_type: ImportDataType;
  file_name: string | null;
  status: ImportStatus;
  total_rows: number | null;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  categories_created: number;
  categories_matched: number;
  mapping: FieldMapping | null;
  options: ImportOptions | null;
  errors: ImportError[];
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
  created_by: string | null;
}

export interface ImportOptions {
  skipErrors: boolean;
  updateExisting: boolean;
  matchField?: string;
  batchSize: number;
  importImages?: boolean;
  sendWelcomeEmail?: boolean;
}

export interface ImportError {
  row: number;
  field?: string;
  value?: string;
  error: string;
  severity: 'warning' | 'error';
}

// Category mapping types
export interface ImportCategoryMapping {
  id: string;
  import_job_id: string;
  original_value: string;
  source_field: string | null;
  suggested_name: string;
  suggested_slug: string | null;
  parent_category_id: string | null;
  parent_mapping_id: string | null;
  matched_existing_id: string | null;
  confidence: number | null;
  is_approved: boolean;
  user_modified_name: string | null;
  user_assigned_parent: string | null;
  product_count: number;
  created_category_id: string | null;
  created_at: string;
}

// File upload types
export interface UploadedFile {
  file: File;
  dataType: ImportDataType;
  rowCount: number;
  headers: string[];
  sampleData: Record<string, string>[];  // Preview (first 5 rows)
  allData: Record<string, string>[];     // ALL rows for actual import
}

// Validation result
export interface ValidationResult {
  valid: number;
  warnings: number;
  errors: number;
  issues: ImportError[];
}

// Preview record
export interface PreviewRecord {
  index: number;
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  selected: boolean;
}

// Wizard state
export interface ImportWizardState {
  step: number;
  platform: ImportPlatform | null;
  dataTypes: ImportDataType[];
  uploadedFiles: Map<ImportDataType, UploadedFile>;
  mappings: Map<ImportDataType, MappingOption[]>;
  categoryMappings: ImportCategoryMapping[];
  previewData: Map<ImportDataType, PreviewRecord[]>;
  options: ImportOptions;
}

// Target fields for each data type - Extended for Shopify
export const CUSTOMER_TARGET_FIELDS = [
  'first_name',
  'last_name', 
  'email',
  'phone',
  'company_name',
  'billing_street',
  'billing_city',
  'billing_postal_code',
  'billing_country',
  'shipping_street',
  'shipping_city',
  'shipping_postal_code',
  'shipping_country',
  'vat_number',
  'notes',
  'tags',
  'customer_type',
  'external_id',
  // Extended fields for Shopify
  'province',
  'province_code',
  'tax_exempt',
  'verified_email',
  'email_subscribed',
  'sms_subscribed',
  'email_marketing_status',
  'email_marketing_level',
  'sms_marketing_status',
  'sms_marketing_level',
  'total_spent',
  'total_orders',
  'shopify_customer_id',
  'original_created_at',
  'import_source',
  'raw_import_data',
] as const;

export const PRODUCT_TARGET_FIELDS = [
  'name',
  'slug',
  'description',
  'short_description',
  'price',
  'compare_at_price',
  'cost_price',
  'sku',
  'barcode',
  'stock',
  'track_inventory',
  'weight',
  'category_id',
  'tags',
  'images',
  'featured_image',
  'meta_title',
  'meta_description',
  'is_active',
  'external_id',
  // Extended fields for Shopify
  'vendor',
  'google_product_category',
  'shopify_handle',
  'shopify_product_id',
  'original_category_value',
  'requires_shipping',
  'taxable',
  'gift_card',
  'variant_weight_unit',
  'original_created_at',
  'import_source',
  'raw_import_data',
] as const;

export const CATEGORY_TARGET_FIELDS = [
  'name',
  'slug',
  'description',
  'parent_id',
  'image_url',
  'sort_order',
  'is_active',
  'meta_title_nl',
  'meta_title_en',
  'meta_title_de',
  'meta_title_fr',
  'meta_description_nl',
  'meta_description_en',
  'meta_description_de',
  'meta_description_fr',
  'external_id',
] as const;

// NEW: Order target fields for Shopify orders import
export const ORDER_TARGET_FIELDS = [
  'order_number',
  'customer_email',
  'customer_name',
  'customer_phone',
  'status',
  'payment_status',
  'paid_at',
  'shipped_at',
  'delivered_at',
  'cancelled_at',
  'currency',
  'subtotal',
  'shipping_cost',
  'tax_amount',
  'discount_code',
  'discount_amount',
  'total',
  'shipping_method',
  'billing_address',
  'shipping_address',
  'notes',
  'internal_notes',
  'order_tags',
  'risk_level',
  'marketplace_source',
  'marketplace_order_id',
  'external_reference',
  'payment_method',
  'refunded_amount',
  'outstanding_balance',
  'employee',
  'location',
  'original_created_at',
  'import_source',
  'raw_marketplace_data',
] as const;

export type CustomerTargetField = typeof CUSTOMER_TARGET_FIELDS[number];
export type ProductTargetField = typeof PRODUCT_TARGET_FIELDS[number];
export type CategoryTargetField = typeof CATEGORY_TARGET_FIELDS[number];
export type OrderTargetField = typeof ORDER_TARGET_FIELDS[number];
