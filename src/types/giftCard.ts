// Gift Card Status
export type GiftCardStatus = 'active' | 'depleted' | 'expired' | 'disabled';

// Transaction types
export type GiftCardTransactionType = 'purchase' | 'redeem' | 'refund' | 'adjustment';

// Gift Card Design
export interface GiftCardDesign {
  id: string;
  tenant_id: string;
  name: string;
  image_url?: string | null;
  theme: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GiftCardDesignFormData {
  name: string;
  image_url?: string | null;
  theme: string;
  is_active: boolean;
  sort_order: number;
}

// Gift Card
export interface GiftCard {
  id: string;
  tenant_id: string;
  code: string;
  initial_balance: number;
  current_balance: number;
  currency: string;
  status: GiftCardStatus;
  purchased_by_customer_id?: string | null;
  purchased_by_email?: string | null;
  recipient_email?: string | null;
  recipient_name?: string | null;
  personal_message?: string | null;
  order_id?: string | null;
  design_id?: string | null;
  expires_at?: string | null;
  activated_at?: string | null;
  email_sent_at?: string | null;
  email_resent_count?: number;
  created_at: string;
  updated_at: string;
  // Joined data
  design?: GiftCardDesign | null;
  transactions?: GiftCardTransaction[];
}

export interface GiftCardFormData {
  initial_balance: number;
  currency: string;
  recipient_email?: string | null;
  recipient_name?: string | null;
  personal_message?: string | null;
  design_id?: string | null;
  expires_at?: string | null;
}

// Gift Card Transaction
export interface GiftCardTransaction {
  id: string;
  gift_card_id: string;
  transaction_type: GiftCardTransactionType;
  amount: number;
  balance_after: number;
  order_id?: string | null;
  description?: string | null;
  created_at: string;
}

// Gift Card Statistics
export interface GiftCardStats {
  total_issued: number;
  total_issued_amount: number;
  total_redeemed_amount: number;
  outstanding_balance: number;
  active_count: number;
  depleted_count: number;
  expired_count: number;
}

// Theme options
export const giftCardThemes = [
  { value: 'general', label: 'Algemeen' },
  { value: 'birthday', label: 'Verjaardag' },
  { value: 'christmas', label: 'Kerst' },
  { value: 'valentines', label: 'Valentijn' },
  { value: 'thank_you', label: 'Bedankt' },
  { value: 'congratulations', label: 'Gefeliciteerd' },
  { value: 'wedding', label: 'Bruiloft' },
  { value: 'baby', label: 'Baby' },
] as const;

// Status display info
export const giftCardStatusInfo: Record<GiftCardStatus, { label: string; color: string }> = {
  active: { label: 'Actief', color: 'bg-green-100 text-green-800' },
  depleted: { label: 'Opgebruikt', color: 'bg-gray-100 text-gray-800' },
  expired: { label: 'Verlopen', color: 'bg-orange-100 text-orange-800' },
  disabled: { label: 'Gedeactiveerd', color: 'bg-red-100 text-red-800' },
};
