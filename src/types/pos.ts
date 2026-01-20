// POS System Types

export type POSTerminalStatus = 'active' | 'inactive' | 'maintenance';
export type POSSessionStatus = 'open' | 'closed' | 'reconciled';
export type POSTransactionStatus = 'pending' | 'completed' | 'voided' | 'refunded';
export type POSCashMovementType = 'in' | 'out' | 'adjustment';
export type POSSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export type POSParkedCartStatus = 'parked' | 'resumed' | 'expired';
export type POSPaymentMethod = 'cash' | 'card' | 'ideal' | 'gift_card' | 'loyalty_points' | 'manual';

export interface POSTerminalCapabilities {
  printer: boolean;
  scanner: boolean;
  cash_drawer: boolean;
}

export interface POSTerminalSettings {
  receipt_footer?: string;
  auto_print?: boolean;
  require_customer?: boolean;
  default_tax_rate?: number;
}

export interface POSTerminal {
  id: string;
  tenant_id: string;
  name: string;
  location_name: string | null;
  device_id: string | null;
  stripe_reader_id: string | null;
  stripe_location_id: string | null;
  status: POSTerminalStatus;
  last_seen_at: string | null;
  capabilities: POSTerminalCapabilities;
  settings: POSTerminalSettings;
  created_at: string;
  updated_at: string;
}

export interface POSSession {
  id: string;
  tenant_id: string;
  terminal_id: string;
  terminal?: POSTerminal;
  opened_by: string;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  notes: string | null;
  status: POSSessionStatus;
  created_at: string;
  updated_at: string;
}

export interface POSPayment {
  method: POSPaymentMethod;
  amount: number;
  reference?: string;
}

export interface POSCartItem {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number;
  quantity: number;
  tax_rate: number;
  discount: number;
  total: number;
  image_url?: string | null;
}

export interface POSTransaction {
  id: string;
  tenant_id: string;
  order_id: string | null;
  session_id: string | null;
  terminal_id: string;
  cashier_id: string;
  customer_id: string | null;
  payments: POSPayment[];
  cash_received: number | null;
  cash_change: number | null;
  stripe_payment_intent_id: string | null;
  stripe_reader_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  items: POSCartItem[];
  status: POSTransactionStatus;
  voided_at: string | null;
  voided_by: string | null;
  voided_reason: string | null;
  refunded_at: string | null;
  refunded_by: string | null;
  receipt_number: string | null;
  receipt_printed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface POSCashMovement {
  id: string;
  tenant_id: string;
  session_id: string;
  terminal_id: string;
  user_id: string;
  movement_type: POSCashMovementType;
  amount: number;
  reason: string;
  notes: string | null;
  created_at: string;
}

export interface POSOfflineQueueItem {
  id: string;
  tenant_id: string;
  terminal_id: string;
  transaction_data: POSTransaction;
  created_offline_at: string;
  synced_at: string | null;
  sync_status: POSSyncStatus;
  sync_attempts: number;
  sync_error: string | null;
  created_at: string;
}

export interface POSQuickButton {
  id: string;
  tenant_id: string;
  terminal_id: string | null;
  product_id: string;
  product?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  };
  label: string;
  color: string | null;
  icon: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface POSParkedCart {
  id: string;
  tenant_id: string;
  terminal_id: string;
  session_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  items: POSCartItem[];
  notes: string | null;
  parked_by: string;
  parked_at: string;
  resumed_at: string | null;
  resumed_by: string | null;
  status: POSParkedCartStatus;
  created_at: string;
}

// Form data types
export interface POSTerminalFormData {
  name: string;
  location_name?: string;
  status?: POSTerminalStatus;
  capabilities?: Partial<POSTerminalCapabilities>;
  settings?: Partial<POSTerminalSettings>;
}

export interface POSSessionOpenData {
  terminal_id: string;
  opening_cash: number;
}

export interface POSSessionCloseData {
  closing_cash: number;
  notes?: string;
}

export interface POSCashMovementFormData {
  movement_type: POSCashMovementType;
  amount: number;
  reason: string;
  notes?: string;
}

// POS State for real-time cart management
export interface POSCartState {
  items: POSCartItem[];
  customer_id: string | null;
  customer_name: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  applied_discounts: Array<{
    name: string;
    type: string;
    value: number;
  }>;
}
