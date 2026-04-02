import type { Product } from '@/types/product';

export type CellType = 
  | 'text'
  | 'number'
  | 'currency'
  | 'select'
  | 'multiselect'
  | 'toggle'
  | 'tags'
  | 'channels'
  | 'readonly';

export interface ColumnDefinition {
  field: string; // Changed from keyof Product to string for flexibility
  header: string;
  type: CellType;
  width: number;
  minWidth?: number;
  editable: boolean;
  bulkEditable: boolean;
  options?: { value: string; label: string }[];
  format?: (value: unknown) => string;
  validate?: (value: unknown) => boolean | string;
}

export interface CellPosition {
  productId: string;
  field: string;
}

export interface PendingChange {
  productId: string;
  productName: string;
  field: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface GridState {
  selectedCells: Map<string, Set<string>>;
  pendingChanges: Map<string, Map<string, unknown>>;
  editingCell: CellPosition | null;
  visibleColumns: string[];
  lastSelectedCell: CellPosition | null;
}

// Default visible columns
export const DEFAULT_VISIBLE_COLUMNS = [
  'name',
  'sku',
  'price',
  'stock',
  'category_id',
  'is_active',
];

// All available column definitions
export const GRID_COLUMNS: ColumnDefinition[] = [
  { field: 'name', header: 'Naam', type: 'text', width: 250, minWidth: 150, editable: true, bulkEditable: false },
  { field: 'sku', header: 'SKU', type: 'text', width: 120, minWidth: 80, editable: true, bulkEditable: false },
  { field: 'price', header: 'Prijs', type: 'currency', width: 110, minWidth: 80, editable: true, bulkEditable: true },
  { field: 'cost_price', header: 'Kostprijs', type: 'currency', width: 110, minWidth: 80, editable: true, bulkEditable: true },
  { field: 'compare_at_price', header: 'Van-prijs', type: 'currency', width: 110, minWidth: 80, editable: true, bulkEditable: true },
  { field: 'stock', header: 'Voorraad', type: 'number', width: 90, minWidth: 70, editable: true, bulkEditable: true },
  { field: 'category_id', header: 'Categorie', type: 'multiselect', width: 180, minWidth: 120, editable: true, bulkEditable: true },
  { field: 'vat_rate_id', header: 'BTW', type: 'select', width: 120, minWidth: 80, editable: true, bulkEditable: true },
  { field: 'social_channels', header: 'Kanalen', type: 'channels', width: 180, minWidth: 120, editable: true, bulkEditable: true },
  { field: 'is_active', header: 'Actief', type: 'toggle', width: 80, minWidth: 60, editable: true, bulkEditable: true },
  { field: 'is_featured', header: 'Uitgelicht', type: 'toggle', width: 90, minWidth: 70, editable: true, bulkEditable: true },
  { field: 'tags', header: 'Tags', type: 'tags', width: 200, minWidth: 120, editable: true, bulkEditable: true },
  { field: 'barcode', header: 'Barcode', type: 'text', width: 130, minWidth: 80, editable: true, bulkEditable: false },
  { field: 'weight', header: 'Gewicht (g)', type: 'number', width: 100, minWidth: 70, editable: true, bulkEditable: true },
  { field: 'low_stock_threshold', header: 'Min. voorraad', type: 'number', width: 110, minWidth: 80, editable: true, bulkEditable: true },
];

// Get cell key for Map usage
export function getCellKey(productId: string, field: string): string {
  return `${productId}:${field}`;
}

// Parse cell key back to position
export function parseCellKey(key: string): CellPosition {
  const [productId, field] = key.split(':');
  return { productId, field };
}
