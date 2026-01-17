export type MarketplaceType = 'bol_com' | 'amazon' | 'shopify' | 'woocommerce';

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
}

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
      { text: 'Track & Trace updates', available: true },
      { text: 'Product listing', available: false },
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
      { text: 'Product listing', available: false },
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
      { text: 'Product sync', available: true },
      { text: 'Klant sync', available: true },
    ],
    comingSoon: true,
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
      { text: 'Product sync', available: true },
      { text: 'Klant sync', available: true },
    ],
    comingSoon: true,
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
