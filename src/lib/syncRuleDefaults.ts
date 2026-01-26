import type { MarketplaceType } from '@/types/marketplace';
import type { 
  SyncRules, 
  SyncRuleConfig, 
  PlatformSyncCapabilities, 
  FieldMapping,
  StatusMapping,
  SyncPreset 
} from '@/types/syncRules';

// Platform capabilities - what each marketplace supports
export const PLATFORM_CAPABILITIES: Record<MarketplaceType, PlatformSyncCapabilities> = {
  bol_com: {
    orders: { import: true, export: false, bidirectional: false },
    products: { import: false, export: true, bidirectional: false },
    inventory: { import: false, export: true, bidirectional: false },
    customers: { import: true, export: false, bidirectional: false },
    invoices: null,
    returns: { import: true, export: false, bidirectional: false },
    shipments: { import: false, export: true, bidirectional: false },
    categories: null,
    taxes: null,
  },
  amazon: {
    orders: { import: true, export: false, bidirectional: false },
    products: { import: false, export: true, bidirectional: false },
    inventory: { import: false, export: true, bidirectional: false },
    customers: { import: true, export: false, bidirectional: false },
    invoices: null,
    returns: { import: true, export: false, bidirectional: false },
    shipments: { import: false, export: true, bidirectional: false },
    categories: null,
    taxes: null,
  },
  shopify: {
    orders: { import: true, export: true, bidirectional: true },
    products: { import: true, export: true, bidirectional: true },
    inventory: { import: true, export: true, bidirectional: true },
    customers: { import: true, export: true, bidirectional: true },
    invoices: null,
    returns: { import: true, export: true, bidirectional: true },
    shipments: { import: true, export: true, bidirectional: true },
    categories: { import: true, export: true, bidirectional: true },
    taxes: { import: true, export: false, bidirectional: false },
  },
  woocommerce: {
    orders: { import: true, export: true, bidirectional: true },
    products: { import: true, export: true, bidirectional: true },
    inventory: { import: true, export: true, bidirectional: true },
    customers: { import: true, export: true, bidirectional: true },
    invoices: { import: true, export: true, bidirectional: true },
    returns: { import: true, export: true, bidirectional: true },
    shipments: { import: true, export: true, bidirectional: true },
    categories: { import: true, export: true, bidirectional: true },
    taxes: { import: true, export: false, bidirectional: false },
  },
  odoo: {
    orders: { import: true, export: true, bidirectional: true },
    products: { import: true, export: true, bidirectional: true },
    inventory: { import: true, export: true, bidirectional: true },
    customers: { import: true, export: true, bidirectional: true },
    invoices: { import: false, export: true, bidirectional: false },
    returns: { import: true, export: true, bidirectional: true },
    shipments: { import: true, export: true, bidirectional: true },
    categories: { import: true, export: true, bidirectional: true },
    taxes: { import: true, export: true, bidirectional: true },
  },
};

// Default field mappings per data type
export const DEFAULT_FIELD_MAPPINGS: Record<string, FieldMapping[]> = {
  orders: [
    { id: 'order_id', sourceField: 'order_id', targetField: 'order_number', label: 'Order ID', enabled: true, required: true },
    { id: 'customer_email', sourceField: 'customer_email', targetField: 'customer.email', label: 'Klant Email', enabled: true, required: true },
    { id: 'line_items', sourceField: 'line_items', targetField: 'items', label: 'Order Items', enabled: true, required: true },
    { id: 'total', sourceField: 'total', targetField: 'total', label: 'Totaal Bedrag', enabled: true, required: true },
    { id: 'shipping_address', sourceField: 'shipping_address', targetField: 'shipping_address', label: 'Verzendadres', enabled: true },
    { id: 'billing_address', sourceField: 'billing_address', targetField: 'billing_address', label: 'Factuuradres', enabled: true },
    { id: 'order_status', sourceField: 'order_status', targetField: 'status', label: 'Order Status', enabled: true },
    { id: 'payment_status', sourceField: 'payment_status', targetField: 'payment_status', label: 'Betaalstatus', enabled: true },
    { id: 'notes', sourceField: 'notes', targetField: 'notes', label: 'Notities', enabled: false },
    { id: 'tags', sourceField: 'tags', targetField: 'tags', label: 'Tags', enabled: false },
  ],
  products: [
    { id: 'title', sourceField: 'title', targetField: 'name', label: 'Productnaam', enabled: true, required: true },
    { id: 'price', sourceField: 'price', targetField: 'price', label: 'Prijs', enabled: true, required: true },
    { id: 'compare_at_price', sourceField: 'compare_at_price', targetField: 'compare_at_price', label: 'Vergelijkprijs', enabled: true },
    { id: 'description', sourceField: 'description', targetField: 'description', label: 'Beschrijving', enabled: true },
    { id: 'images', sourceField: 'images', targetField: 'images', label: 'Afbeeldingen', enabled: true },
    { id: 'sku', sourceField: 'sku', targetField: 'sku', label: 'SKU', enabled: false },
    { id: 'barcode', sourceField: 'barcode', targetField: 'barcode', label: 'Barcode/EAN', enabled: false },
    { id: 'weight', sourceField: 'weight', targetField: 'weight', label: 'Gewicht', enabled: false },
    { id: 'inventory_quantity', sourceField: 'inventory_quantity', targetField: 'stock', label: 'Voorraad', enabled: true },
    { id: 'categories', sourceField: 'categories', targetField: 'category_id', label: 'Categorieën', enabled: true },
    { id: 'tags', sourceField: 'tags', targetField: 'tags', label: 'Tags', enabled: false },
    { id: 'meta_title', sourceField: 'meta_title', targetField: 'meta_title', label: 'Meta Titel', enabled: false },
    { id: 'meta_description', sourceField: 'meta_description', targetField: 'meta_description', label: 'Meta Beschrijving', enabled: false },
  ],
  inventory: [
    { id: 'sku', sourceField: 'sku', targetField: 'sku', label: 'SKU', enabled: true, required: true },
    { id: 'quantity', sourceField: 'quantity', targetField: 'stock', label: 'Voorraad Aantal', enabled: true, required: true },
    { id: 'location', sourceField: 'location', targetField: 'warehouse_location', label: 'Locatie', enabled: false },
    { id: 'reserved', sourceField: 'reserved', targetField: 'reserved_stock', label: 'Gereserveerd', enabled: false },
  ],
  customers: [
    { id: 'email', sourceField: 'email', targetField: 'email', label: 'Email', enabled: true, required: true },
    { id: 'first_name', sourceField: 'first_name', targetField: 'first_name', label: 'Voornaam', enabled: true },
    { id: 'last_name', sourceField: 'last_name', targetField: 'last_name', label: 'Achternaam', enabled: true },
    { id: 'phone', sourceField: 'phone', targetField: 'phone', label: 'Telefoon', enabled: true },
    { id: 'company', sourceField: 'company', targetField: 'company_name', label: 'Bedrijf', enabled: false },
    { id: 'address', sourceField: 'address', targetField: 'billing_address', label: 'Adres', enabled: true },
    { id: 'shipping_address', sourceField: 'shipping_address', targetField: 'shipping_address', label: 'Verzendadres', enabled: true },
    { id: 'total_spent', sourceField: 'total_spent', targetField: 'total_spent', label: 'Totaal Besteed', enabled: false },
    { id: 'orders_count', sourceField: 'orders_count', targetField: 'total_orders', label: 'Aantal Orders', enabled: false },
    { id: 'tags', sourceField: 'tags', targetField: 'tags', label: 'Tags', enabled: false },
    { id: 'notes', sourceField: 'notes', targetField: 'notes', label: 'Notities', enabled: false },
  ],
  invoices: [
    { id: 'invoice_number', sourceField: 'invoice_number', targetField: 'invoice_number', label: 'Factuurnummer', enabled: true, required: true },
    { id: 'customer', sourceField: 'customer', targetField: 'customer_id', label: 'Klant', enabled: true, required: true },
    { id: 'total', sourceField: 'total', targetField: 'total', label: 'Totaal', enabled: true, required: true },
    { id: 'tax', sourceField: 'tax', targetField: 'tax_amount', label: 'BTW Bedrag', enabled: true },
    { id: 'due_date', sourceField: 'due_date', targetField: 'due_date', label: 'Vervaldatum', enabled: true },
    { id: 'status', sourceField: 'status', targetField: 'status', label: 'Status', enabled: true },
  ],
  returns: [
    { id: 'return_id', sourceField: 'return_id', targetField: 'return_number', label: 'Retour ID', enabled: true, required: true },
    { id: 'order_id', sourceField: 'order_id', targetField: 'order_id', label: 'Order ID', enabled: true, required: true },
    { id: 'items', sourceField: 'items', targetField: 'items', label: 'Retour Items', enabled: true },
    { id: 'reason', sourceField: 'reason', targetField: 'reason', label: 'Reden', enabled: true },
    { id: 'status', sourceField: 'status', targetField: 'status', label: 'Status', enabled: true },
  ],
  shipments: [
    { id: 'tracking_number', sourceField: 'tracking_number', targetField: 'tracking_number', label: 'Track & Trace', enabled: true, required: true },
    { id: 'carrier', sourceField: 'carrier', targetField: 'carrier', label: 'Vervoerder', enabled: true },
    { id: 'status', sourceField: 'status', targetField: 'status', label: 'Status', enabled: true },
    { id: 'shipped_date', sourceField: 'shipped_date', targetField: 'shipped_at', label: 'Verzenddatum', enabled: true },
  ],
  categories: [
    { id: 'name', sourceField: 'name', targetField: 'name', label: 'Naam', enabled: true, required: true },
    { id: 'slug', sourceField: 'slug', targetField: 'slug', label: 'Slug', enabled: true },
    { id: 'parent', sourceField: 'parent', targetField: 'parent_id', label: 'Hoofdcategorie', enabled: true },
    { id: 'description', sourceField: 'description', targetField: 'description', label: 'Beschrijving', enabled: false },
  ],
  taxes: [
    { id: 'name', sourceField: 'name', targetField: 'name', label: 'Naam', enabled: true, required: true },
    { id: 'rate', sourceField: 'rate', targetField: 'rate', label: 'Percentage', enabled: true, required: true },
    { id: 'country', sourceField: 'country', targetField: 'country_code', label: 'Land', enabled: true },
  ],
};

// Default status mappings for orders
export const DEFAULT_STATUS_MAPPINGS: Record<MarketplaceType, StatusMapping[]> = {
  bol_com: [
    { externalStatus: 'OPEN', internalStatus: 'pending', label: 'Open' },
    { externalStatus: 'SHIPPED', internalStatus: 'shipped', label: 'Verzonden' },
    { externalStatus: 'DELIVERED', internalStatus: 'delivered', label: 'Afgeleverd' },
    { externalStatus: 'CANCELLED', internalStatus: 'cancelled', label: 'Geannuleerd' },
  ],
  amazon: [
    { externalStatus: 'Pending', internalStatus: 'pending', label: 'In afwachting' },
    { externalStatus: 'Unshipped', internalStatus: 'processing', label: 'Niet verzonden' },
    { externalStatus: 'Shipped', internalStatus: 'shipped', label: 'Verzonden' },
    { externalStatus: 'Canceled', internalStatus: 'cancelled', label: 'Geannuleerd' },
  ],
  shopify: [
    { externalStatus: 'pending', internalStatus: 'pending', label: 'In afwachting' },
    { externalStatus: 'paid', internalStatus: 'processing', label: 'Betaald' },
    { externalStatus: 'fulfilled', internalStatus: 'shipped', label: 'Vervuld' },
    { externalStatus: 'cancelled', internalStatus: 'cancelled', label: 'Geannuleerd' },
    { externalStatus: 'refunded', internalStatus: 'refunded', label: 'Terugbetaald' },
  ],
  woocommerce: [
    { externalStatus: 'pending', internalStatus: 'pending', label: 'In afwachting' },
    { externalStatus: 'processing', internalStatus: 'processing', label: 'In behandeling' },
    { externalStatus: 'on-hold', internalStatus: 'on_hold', label: 'In de wacht' },
    { externalStatus: 'completed', internalStatus: 'delivered', label: 'Afgerond' },
    { externalStatus: 'cancelled', internalStatus: 'cancelled', label: 'Geannuleerd' },
    { externalStatus: 'refunded', internalStatus: 'refunded', label: 'Terugbetaald' },
    { externalStatus: 'failed', internalStatus: 'cancelled', label: 'Mislukt' },
  ],
  odoo: [
    { externalStatus: 'draft', internalStatus: 'pending', label: 'Concept' },
    { externalStatus: 'sent', internalStatus: 'processing', label: 'Verzonden' },
    { externalStatus: 'sale', internalStatus: 'processing', label: 'Verkoop' },
    { externalStatus: 'done', internalStatus: 'delivered', label: 'Afgerond' },
    { externalStatus: 'cancel', internalStatus: 'cancelled', label: 'Geannuleerd' },
  ],
};

// Default sync rules per platform
export function getDefaultSyncRules(marketplaceType: MarketplaceType): SyncRules {
  const capabilities = PLATFORM_CAPABILITIES[marketplaceType];
  const statusMappings = DEFAULT_STATUS_MAPPINGS[marketplaceType];
  
  const createRule = (
    dataType: string, 
    enabled: boolean, 
    direction: 'import' | 'export' | 'bidirectional',
    autoSync: boolean
  ): SyncRuleConfig => ({
    enabled,
    direction,
    autoSync,
    fieldMappings: DEFAULT_FIELD_MAPPINGS[dataType] || [],
    statusMappings: dataType === 'orders' ? statusMappings : undefined,
    customSettings: {},
  });

  switch (marketplaceType) {
    case 'bol_com':
      return {
        orders: createRule('orders', true, 'import', true),
        products: createRule('products', true, 'export', false),
        inventory: createRule('inventory', true, 'export', true),
        customers: createRule('customers', false, 'import', true),
        returns: createRule('returns', true, 'import', true),
        shipments: createRule('shipments', true, 'export', true),
      };
    
    case 'amazon':
      return {
        orders: createRule('orders', true, 'import', true),
        products: createRule('products', true, 'export', false),
        inventory: createRule('inventory', true, 'export', true),
        customers: createRule('customers', false, 'import', true),
        returns: createRule('returns', true, 'import', true),
        shipments: createRule('shipments', true, 'export', true),
      };
    
    case 'shopify':
      return {
        orders: createRule('orders', true, 'bidirectional', true),
        products: createRule('products', true, 'bidirectional', true),
        inventory: createRule('inventory', true, 'bidirectional', true),
        customers: createRule('customers', true, 'bidirectional', true),
        returns: createRule('returns', true, 'bidirectional', true),
        shipments: createRule('shipments', true, 'bidirectional', true),
        categories: createRule('categories', true, 'bidirectional', false),
        taxes: createRule('taxes', false, 'import', false),
      };
    
    case 'woocommerce':
      return {
        orders: createRule('orders', true, 'bidirectional', true),
        products: createRule('products', true, 'bidirectional', true),
        inventory: createRule('inventory', true, 'bidirectional', true),
        customers: createRule('customers', true, 'bidirectional', true),
        invoices: createRule('invoices', false, 'bidirectional', false),
        returns: createRule('returns', true, 'bidirectional', true),
        shipments: createRule('shipments', true, 'bidirectional', true),
        categories: createRule('categories', true, 'bidirectional', false),
        taxes: createRule('taxes', false, 'import', false),
      };
    
    case 'odoo':
      return {
        orders: createRule('orders', true, 'bidirectional', true),
        products: createRule('products', true, 'bidirectional', true),
        inventory: createRule('inventory', true, 'bidirectional', true),
        customers: createRule('customers', true, 'bidirectional', true),
        invoices: createRule('invoices', false, 'export', false),
        returns: createRule('returns', true, 'bidirectional', true),
        shipments: createRule('shipments', true, 'bidirectional', true),
        categories: createRule('categories', true, 'bidirectional', false),
        taxes: createRule('taxes', true, 'bidirectional', false),
      };
    
    default:
      return {};
  }
}

// Preset configurations
export const SYNC_PRESETS: Record<MarketplaceType, SyncPreset[]> = {
  bol_com: [
    {
      id: 'minimal',
      name: 'Minimaal',
      description: 'Alleen orders importeren',
      rules: {
        orders: { enabled: true, direction: 'import', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
        products: { enabled: false, direction: 'export', autoSync: false, fieldMappings: [], customSettings: {} },
        inventory: { enabled: false, direction: 'export', autoSync: false, fieldMappings: [], customSettings: {} },
      },
    },
    {
      id: 'standard',
      name: 'Standaard',
      description: 'Orders + Voorraad synchronisatie',
      rules: {
        orders: { enabled: true, direction: 'import', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
        products: { enabled: true, direction: 'export', autoSync: false, fieldMappings: DEFAULT_FIELD_MAPPINGS.products, customSettings: {} },
        inventory: { enabled: true, direction: 'export', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.inventory, customSettings: { safetyStock: 5 } },
      },
    },
    {
      id: 'full',
      name: 'Volledig',
      description: 'Alle beschikbare synchronisaties',
      rules: {
        orders: { enabled: true, direction: 'import', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
        products: { enabled: true, direction: 'export', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.products, customSettings: {} },
        inventory: { enabled: true, direction: 'export', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.inventory, customSettings: { safetyStock: 5, realtimeUpdates: true } },
        returns: { enabled: true, direction: 'import', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.returns, customSettings: {} },
        shipments: { enabled: true, direction: 'export', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.shipments, customSettings: {} },
      },
    },
  ],
  amazon: [
    {
      id: 'minimal',
      name: 'Minimaal',
      description: 'Alleen orders importeren',
      rules: {
        orders: { enabled: true, direction: 'import', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
      },
    },
    {
      id: 'standard',
      name: 'Standaard',
      description: 'Orders + Voorraad synchronisatie',
      rules: {
        orders: { enabled: true, direction: 'import', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
        inventory: { enabled: true, direction: 'export', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.inventory, customSettings: { safetyStock: 5 } },
      },
    },
  ],
  shopify: [
    {
      id: 'minimal',
      name: 'Minimaal',
      description: 'Alleen orders importeren',
      rules: {
        orders: { enabled: true, direction: 'import', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
      },
    },
    {
      id: 'standard',
      name: 'Standaard',
      description: 'Bidirectionele sync voor orders, producten en voorraad',
      rules: {
        orders: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
        products: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.products, customSettings: {} },
        inventory: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.inventory, customSettings: {} },
      },
    },
  ],
  woocommerce: [
    {
      id: 'minimal',
      name: 'Minimaal',
      description: 'Alleen orders importeren',
      rules: {
        orders: { enabled: true, direction: 'import', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
      },
    },
    {
      id: 'standard',
      name: 'Standaard',
      description: 'Bidirectionele sync voor alles behalve facturen',
      rules: {
        orders: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
        products: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.products, customSettings: {} },
        inventory: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.inventory, customSettings: {} },
        customers: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.customers, customSettings: {} },
      },
    },
  ],
  odoo: [
    {
      id: 'ecommerce',
      name: 'E-commerce',
      description: 'Webshop functionaliteit',
      rules: {
        orders: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
        products: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.products, customSettings: {} },
        inventory: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.inventory, customSettings: {} },
      },
    },
    {
      id: 'accounting',
      name: 'Boekhouding',
      description: 'Facturen en BTW synchronisatie',
      rules: {
        invoices: { enabled: true, direction: 'export', autoSync: false, fieldMappings: DEFAULT_FIELD_MAPPINGS.invoices, customSettings: {} },
        customers: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.customers, customSettings: {} },
        taxes: { enabled: true, direction: 'bidirectional', autoSync: false, fieldMappings: DEFAULT_FIELD_MAPPINGS.taxes, customSettings: {} },
      },
    },
    {
      id: 'full',
      name: 'Volledig',
      description: 'Alle Odoo modules',
      rules: {
        orders: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.orders, customSettings: {} },
        products: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.products, customSettings: {} },
        inventory: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.inventory, customSettings: {} },
        customers: { enabled: true, direction: 'bidirectional', autoSync: true, fieldMappings: DEFAULT_FIELD_MAPPINGS.customers, customSettings: {} },
        invoices: { enabled: true, direction: 'export', autoSync: false, fieldMappings: DEFAULT_FIELD_MAPPINGS.invoices, customSettings: {} },
        taxes: { enabled: true, direction: 'bidirectional', autoSync: false, fieldMappings: DEFAULT_FIELD_MAPPINGS.taxes, customSettings: {} },
      },
    },
  ],
};
