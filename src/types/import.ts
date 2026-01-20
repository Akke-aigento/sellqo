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
  sampleData: Record<string, string>[];
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

// Target fields for each data type
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

export type CustomerTargetField = typeof CUSTOMER_TARGET_FIELDS[number];
export type ProductTargetField = typeof PRODUCT_TARGET_FIELDS[number];
export type CategoryTargetField = typeof CATEGORY_TARGET_FIELDS[number];
