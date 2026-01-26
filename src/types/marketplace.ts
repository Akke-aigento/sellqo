export type MarketplaceType = 'bol_com' | 'amazon' | 'shopify' | 'woocommerce' | 'odoo';

export interface MarketplaceConnection {
  id: string;
  tenant_id: string;
  marketplace_type: MarketplaceType;
  marketplace_name: string | null;
  credentials: MarketplaceCredentials;
  settings: MarketplaceSettings;
  is_active: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  stats: MarketplaceStats;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceCredentials {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  sellerId?: string;
  marketplaceId?: string;
  // Shopify-specific
  storeUrl?: string;
  // WooCommerce-specific
  siteUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  // Odoo-specific
  odooUrl?: string;
  odooDatabase?: string;
  odooUsername?: string;
  odooApiKey?: string;
}

import type { SyncRules } from './syncRules';

export interface MarketplaceSettings {
  syncInterval: number;
  autoImport: boolean;
  autoSyncInventory: boolean;
  safetyStock: number;
  lowStockThreshold: number;
  emailNotifyNewOrders?: boolean;
  emailNotifySyncErrors?: boolean;
  emailNotifyLowStock?: boolean;
  importHistorical?: boolean;
  historicalPeriodDays?: number; // 30, 90, 180, 365, or 730 for "all"
  // Odoo module selection
  odooModuleEcommerce?: boolean;  // Orders, producten, voorraad sync
  odooModuleAccounting?: boolean; // Facturen push, klanten sync, BTW mapping
  // Odoo-specific settings
  odooSyncInvoices?: boolean;
  odooSyncCustomers?: boolean;
  odooDefaultJournalId?: string;
  odooDefaultTaxId?: string;
  odooAutoConfirmInvoices?: boolean;
  // Granular sync rules
  syncRules?: SyncRules;
}

export interface MarketplaceStats {
  totalOrders: number;
  totalRevenue: number;
  lastOrderDate: string | null;
  productsLinked: number;
}

export interface InventorySyncLog {
  id: string;
  tenant_id: string;
  product_id: string;
  marketplace_connection_id: string;
  marketplace_type: MarketplaceType;
  old_quantity: number;
  new_quantity: number;
  sync_status: 'success' | 'failed' | 'pending';
  error_message: string | null;
  synced_at: string;
}

export interface SyncQueueItem {
  id: string;
  tenant_id: string;
  marketplace_connection_id: string;
  sync_type: 'order_import' | 'inventory_export' | 'order_status_update' | 'full_sync';
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  scheduled_for: string;
  processed_at: string | null;
  created_at: string;
}

export interface MarketplaceInfo {
  type?: MarketplaceType;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  features: { text: string; available: boolean }[];
  comingSoon?: boolean;
}

export const MARKETPLACE_INFO: Record<MarketplaceType | 'request', MarketplaceInfo & { type?: MarketplaceType }> = {
  bol_com: {
    type: 'bol_com',
    name: 'Bol.com',
    icon: 'ShoppingBag',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Synchroniseer bestellingen en voorraad met Bol.com Retailer',
    features: [
      { text: 'Automatische order import', available: true },
      { text: 'Realtime voorraad sync', available: true },
      { text: 'LVB ondersteuning', available: true },
      { text: 'AI Product listing', available: true },
    ],
  },
  amazon: {
    type: 'amazon',
    name: 'Amazon',
    icon: 'Package',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Verbind met Amazon Seller Central voor volledige synchronisatie',
    features: [
      { text: 'Automatische order import', available: true },
      { text: 'Realtime voorraad sync', available: true },
      { text: 'FBA ondersteuning', available: true },
      { text: 'AI Product listing', available: true },
    ],
  },
  shopify: {
    type: 'shopify',
    name: 'Shopify',
    icon: 'Store',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Koppel je Shopify webshop voor volledige integratie',
    features: [
      { text: 'Automatische order import', available: true },
      { text: 'Realtime voorraad sync', available: true },
      { text: 'Bi-directionele product sync', available: true },
      { text: 'AI Product listing', available: true },
    ],
  },
  woocommerce: {
    type: 'woocommerce',
    name: 'WooCommerce',
    icon: 'ShoppingCart',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Integreer met je WordPress WooCommerce webshop',
    features: [
      { text: 'Automatische order import', available: true },
      { text: 'Realtime voorraad sync', available: true },
      { text: 'Bi-directionele product sync', available: true },
      { text: 'AI Product listing', available: true },
    ],
  },
  odoo: {
    type: 'odoo',
    name: 'Odoo',
    icon: 'Building2',
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    description: 'Complete integratie met Odoo ERP: webshop én boekhouding',
    features: [
      { text: 'Automatische order import', available: true },
      { text: 'Realtime voorraad sync', available: true },
      { text: 'Factuur export naar Odoo Accounting', available: true },
      { text: 'Klant synchronisatie (res.partner)', available: true },
      { text: 'BTW mapping', available: true },
      { text: 'AI Product listing', available: true },
    ],
  },
  request: {
    name: 'Andere Integratie',
    icon: 'Plus',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    description: 'Mis je een platform? Laat het ons weten!',
    features: [],
  },
};
