import type { MarketplaceType } from './marketplace';

// Data types that can be synchronized
export type SyncDataType = 
  | 'orders' 
  | 'products' 
  | 'inventory' 
  | 'customers' 
  | 'invoices' 
  | 'returns' 
  | 'shipments' 
  | 'categories' 
  | 'taxes';

// Direction of synchronization
export type SyncDirection = 'import' | 'export' | 'bidirectional';

// Conflict resolution strategies for bidirectional sync
export type ConflictStrategy = 'sellqo_wins' | 'platform_wins' | 'newest_wins' | 'manual';

// Sync frequency options
export type SyncFrequency = '5min' | '15min' | '30min' | '1hour' | '4hour' | 'daily' | 'weekly';

// Sync status
export type SyncStatus = 'success' | 'partial' | 'failed';

// Supported directions per platform and data type
export interface SupportedDirections {
  import: boolean;
  export: boolean;
  bidirectional: boolean;
}

// Sync statistics
export interface SyncStats {
  processed: number;
  failed: number;
  duration: number;
}

// Field mapping between external platform and SellQo
export interface FieldMapping {
  id: string;
  sourceField: string;      // Field in the external platform
  targetField: string;      // Field in SellQo
  label: string;            // Human-readable label
  enabled: boolean;
  required?: boolean;       // Some fields are mandatory
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'none';
}

// Status mapping for orders
export interface StatusMapping {
  externalStatus: string;
  internalStatus: string;
  label?: string;
}

// Custom settings per data type
export interface SyncCustomSettings {
  // Inventory specific
  safetyStock?: number;
  realtimeUpdates?: boolean;
  
  // Orders specific
  autoConfirm?: boolean;
  importHistorical?: boolean;
  historicalDays?: number;
  
  // Invoices specific
  autoCreate?: boolean;
  journalId?: string;
  
  // Generic
  [key: string]: unknown;
}

// Configuration for a single sync rule
export interface SyncRuleConfig {
  enabled: boolean;
  direction: SyncDirection;
  autoSync: boolean;
  fieldMappings: FieldMapping[];
  statusMappings?: StatusMapping[];
  customSettings: SyncCustomSettings;
  lastModified?: string;
  
  // Conflict resolution for bidirectional sync
  conflictStrategy?: ConflictStrategy;
  
  // Per-data-type sync frequency
  syncFrequency?: SyncFrequency;
  
  // Sync history tracking
  lastSyncedAt?: string;
  lastSyncStatus?: SyncStatus;
  lastSyncStats?: SyncStats;
}

// All sync rules for a connection
export interface SyncRules {
  orders?: SyncRuleConfig;
  products?: SyncRuleConfig;
  inventory?: SyncRuleConfig;
  customers?: SyncRuleConfig;
  invoices?: SyncRuleConfig;
  returns?: SyncRuleConfig;
  shipments?: SyncRuleConfig;
  categories?: SyncRuleConfig;
  taxes?: SyncRuleConfig;
}

// Platform capabilities - what each platform supports
export interface PlatformSyncCapabilities {
  orders: SupportedDirections | null;
  products: SupportedDirections | null;
  inventory: SupportedDirections | null;
  customers: SupportedDirections | null;
  invoices: SupportedDirections | null;
  returns: SupportedDirections | null;
  shipments: SupportedDirections | null;
  categories: SupportedDirections | null;
  taxes: SupportedDirections | null;
}

// Data type metadata for UI
export interface SyncDataTypeInfo {
  type: SyncDataType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

// Preset configuration
export interface SyncPreset {
  id: string;
  name: string;
  description: string;
  rules: Partial<SyncRules>;
}

// Export the data type info for UI rendering
export const SYNC_DATA_TYPES: SyncDataTypeInfo[] = [
  {
    type: 'orders',
    label: 'Bestellingen',
    description: 'Order import en status updates',
    icon: 'ShoppingCart',
    color: 'blue',
  },
  {
    type: 'products',
    label: 'Producten',
    description: 'Product informatie en listings',
    icon: 'Package',
    color: 'green',
  },
  {
    type: 'inventory',
    label: 'Voorraad',
    description: 'Stock levels en beschikbaarheid',
    icon: 'Warehouse',
    color: 'amber',
  },
  {
    type: 'customers',
    label: 'Klanten',
    description: 'Klantgegevens en contactinfo',
    icon: 'Users',
    color: 'purple',
  },
  {
    type: 'invoices',
    label: 'Facturen',
    description: 'Facturen en betalingen',
    icon: 'FileText',
    color: 'emerald',
  },
  {
    type: 'returns',
    label: 'Retouren',
    description: 'Retourzendingen en RMA',
    icon: 'RotateCcw',
    color: 'red',
  },
  {
    type: 'shipments',
    label: 'Verzendingen',
    description: 'Track & trace en verzendstatus',
    icon: 'Truck',
    color: 'cyan',
  },
  {
    type: 'categories',
    label: 'Categorieën',
    description: 'Productcategorieën en structuur',
    icon: 'FolderTree',
    color: 'indigo',
  },
  {
    type: 'taxes',
    label: 'BTW/Belastingen',
    description: 'BTW-tarieven en belastingregels',
    icon: 'Percent',
    color: 'slate',
  },
];
