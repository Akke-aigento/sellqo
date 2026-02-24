import type { ProductType } from '@/types/product';

export interface BulkEditState {
  // Basis
  category_id?: string | null;
  category_ids_to_add?: string[];
  category_ids_to_remove?: string[];
  vat_rate_id?: string | null;
  product_type?: ProductType;
  
  // Prijzen
  price_adjustment?: {
    type: 'add' | 'subtract' | 'percentage_up' | 'percentage_down' | 'exact';
    value: number;
  };
  compare_at_price_action?: 'remove' | 'set_current' | 'exact';
  compare_at_price_value?: number;
  cost_price?: number | null;
  cost_price_action?: 'exact' | 'remove';
  
  // Voorraad
  stock_adjustment?: {
    type: 'add' | 'subtract' | 'exact';
    value: number;
  };
  track_inventory?: boolean;
  allow_backorder?: boolean;
  low_stock_threshold?: number;
  
  // Zichtbaarheid
  is_active?: boolean;
  hide_from_storefront?: boolean;
  is_featured?: boolean;
  requires_shipping?: boolean;
  
  // Tags
  tags_to_add?: string[];
  tags_to_remove?: string[];
  tags_replace_all?: string[];
  
  // Kanalen
  social_channels?: Record<string, boolean>;
  sync_marketplaces?: string[];
}

export interface BulkEditTabProps {
  state: BulkEditState;
  onChange: (updates: Partial<BulkEditState>) => void;
  enabledFields: Set<string>;
  onToggleField: (field: string) => void;
}
