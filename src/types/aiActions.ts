// AI Action Suggestions Types

export type AISuggestionType = 
  | 'purchase_order' 
  | 'marketing_campaign' 
  | 'price_change' 
  | 'stock_alert' 
  | 'customer_winback' 
  | 'supplier_order' 
  | 'promotion';

export type AISuggestionStatus = 
  | 'pending' 
  | 'accepted' 
  | 'modified' 
  | 'rejected' 
  | 'executed' 
  | 'expired';

export type AISuggestionPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AIActionSuggestion {
  id: string;
  tenant_id: string;
  suggestion_type: AISuggestionType;
  title: string;
  description: string | null;
  priority: AISuggestionPriority;
  confidence_score: number;
  reasoning: string | null;
  action_data: Record<string, unknown>;
  status: AISuggestionStatus;
  user_modifications: Record<string, unknown> | null;
  notification_id: string | null;
  expires_at: string | null;
  executed_at: string | null;
  executed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIFeedback {
  id: string;
  tenant_id: string;
  content_id: string | null;
  user_id: string | null;
  feedback_type: 'positive' | 'negative' | 'edit';
  original_content: string | null;
  edited_content: string | null;
  edit_reason: string | null;
  rating: number | null;
  comments: string | null;
  content_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AILearningPattern {
  id: string;
  tenant_id: string;
  pattern_type: string;
  learned_value: Record<string, unknown>;
  confidence_score: number;
  sample_count: number;
  last_updated_at: string;
  created_at: string;
}

// Action data structures for different suggestion types
export interface PurchaseOrderActionData {
  type: 'create_purchase_order';
  supplier_id: string;
  supplier_name: string;
  items: Array<{
    product_id: string;
    product_name: string;
    current_stock: number;
    suggested_quantity: number;
    unit_cost: number;
    total: number;
  }>;
  estimated_delivery: string;
  total_value: number;
  notes?: string;
}

export interface MarketingCampaignActionData {
  type: 'create_marketing_campaign';
  campaign_type: 'email' | 'social';
  subject?: string;
  content: string;
  html_content?: string;
  product_ids?: string[];
  segment_id?: string;
  platform?: string;
}

export interface CustomerWinbackActionData {
  type: 'create_winback_campaign';
  customer_ids: string[];
  customer_count: number;
  suggested_discount?: number;
  email_subject: string;
  email_content: string;
}

export interface StockAlertActionData {
  type: 'stock_reorder';
  product_id: string;
  product_name: string;
  current_stock: number;
  avg_daily_sales: number;
  days_until_stockout: number;
  supplier_id?: string;
  supplier_name?: string;
  lead_time_days?: number;
  suggested_quantity: number;
}

// UI-specific types
export interface AISuggestionWithMeta extends AIActionSuggestion {
  icon?: string;
  color?: string;
  actionLabel?: string;
}

export const SUGGESTION_TYPE_CONFIG: Record<AISuggestionType, {
  label: string;
  icon: string;
  color: string;
  actionLabel: string;
}> = {
  purchase_order: {
    label: 'Inkooporder',
    icon: 'Package',
    color: 'text-blue-500',
    actionLabel: 'Order Aanmaken',
  },
  marketing_campaign: {
    label: 'Marketing Campagne',
    icon: 'Megaphone',
    color: 'text-purple-500',
    actionLabel: 'Campagne Starten',
  },
  price_change: {
    label: 'Prijswijziging',
    icon: 'TrendingUp',
    color: 'text-green-500',
    actionLabel: 'Prijs Aanpassen',
  },
  stock_alert: {
    label: 'Voorraad Alert',
    icon: 'AlertTriangle',
    color: 'text-orange-500',
    actionLabel: 'Bestelling Plaatsen',
  },
  customer_winback: {
    label: 'Win-back Campagne',
    icon: 'UserCheck',
    color: 'text-pink-500',
    actionLabel: 'Campagne Versturen',
  },
  supplier_order: {
    label: 'Leverancier Bestelling',
    icon: 'Truck',
    color: 'text-indigo-500',
    actionLabel: 'Bestellen',
  },
  promotion: {
    label: 'Promotie',
    icon: 'Percent',
    color: 'text-yellow-500',
    actionLabel: 'Promotie Starten',
  },
};

export const PRIORITY_CONFIG: Record<AISuggestionPriority, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  low: {
    label: 'Laag',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  medium: {
    label: 'Gemiddeld',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  high: {
    label: 'Hoog',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  urgent: {
    label: 'Urgent',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
};
