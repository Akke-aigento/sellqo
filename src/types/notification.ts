export type NotificationCategory = 
  | 'orders'
  | 'invoices'
  | 'payments'
  | 'customers'
  | 'products'
  | 'quotes'
  | 'subscriptions'
  | 'marketing'
  | 'team'
  | 'system'
  | 'ai_coach'
  | 'messages'
  | 'integrations';

// Quick Action types for inline notification buttons
export type QuickActionType = 'navigate' | 'execute' | 'dismiss' | 'snooze' | 'open_visual_editor';
export type QuickActionVariant = 'default' | 'primary' | 'secondary' | 'destructive' | 'outline';

export interface NotificationQuickAction {
  id: string;
  label: string;
  icon?: string;
  action_type: QuickActionType;
  action_url?: string;
  action_function?: string;
  action_params?: Record<string, unknown>;
  variant?: QuickActionVariant;
}

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  category: NotificationCategory;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  priority: NotificationPriority;
  read_at: string | null;
  email_sent_at: string | null;
  action_url: string | null;
  created_at: string;
}

export interface NotificationSetting {
  id: string;
  tenant_id: string;
  category: NotificationCategory;
  notification_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_recipients: string[];
  created_at: string;
  updated_at: string;
}

/**
 * BLOG-FIX-1: labels en omschrijvingen staan niet meer hier maar in i18n —
 * `settings.notifications.categories.<category>` en
 * `settings.notifications.types.<category>.<type>.{label,description}`
 * (helpers in src/lib/notificationLabels.ts). Een nieuw type krijgt die keys
 * in ALLE talen, anders toont het scherm de ruwe type-id.
 */
export interface NotificationTypeConfig {
  type: string;
  defaultInApp: boolean;
  defaultEmail: boolean;
}

export interface NotificationCategoryConfig {
  category: NotificationCategory;
  icon: string;
  types: NotificationTypeConfig[];
}

// All available notification types organized by category
export const NOTIFICATION_CONFIG: NotificationCategoryConfig[] = [
  {
    category: 'orders',
    icon: 'ShoppingCart',
    types: [
      { type: 'order_new', defaultInApp: true, defaultEmail: false },
      { type: 'order_paid', defaultInApp: true, defaultEmail: false },
      { type: 'order_cancelled', defaultInApp: true, defaultEmail: false },
      { type: 'order_refund_requested', defaultInApp: true, defaultEmail: false },
      { type: 'order_shipped', defaultInApp: false, defaultEmail: false },
      { type: 'order_delivered', defaultInApp: false, defaultEmail: false },
      { type: 'order_high_value', defaultInApp: true, defaultEmail: false },
      // FONSKE-READY-1: betaald maar event intussen volzet — klant heeft geen ticket.
      { type: 'ticket_overbooking', defaultInApp: true, defaultEmail: false },
      { type: 'marketplace_order_new', defaultInApp: true, defaultEmail: false },
      // NOTIF-TYPES-1: poll-tracking-status (tracking_<status>) en useReturns.
      { type: 'tracking_in_transit', defaultInApp: true, defaultEmail: false },
      { type: 'tracking_out_for_delivery', defaultInApp: true, defaultEmail: false },
      { type: 'tracking_delivered', defaultInApp: true, defaultEmail: false },
      { type: 'tracking_exception', defaultInApp: true, defaultEmail: false },
      { type: 'return_new_request', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'invoices',
    icon: 'FileText',
    types: [
      { type: 'invoice_created', defaultInApp: false, defaultEmail: false },
      { type: 'invoice_sent', defaultInApp: false, defaultEmail: false },
      { type: 'invoice_paid', defaultInApp: true, defaultEmail: false },
      { type: 'invoice_overdue', defaultInApp: true, defaultEmail: false },
      { type: 'invoice_overdue_7days', defaultInApp: true, defaultEmail: false },
      { type: 'invoice_overdue_30days', defaultInApp: true, defaultEmail: false },
      { type: 'invoice_reminder_sent', defaultInApp: false, defaultEmail: false },
      { type: 'peppol_invoice_accepted', defaultInApp: true, defaultEmail: false },
      { type: 'peppol_invoice_rejected', defaultInApp: true, defaultEmail: false },
      // NOTIF-TYPES-1: process-invoice-dunning.
      { type: 'invoice_final_reminder', defaultInApp: true, defaultEmail: false },
      { type: 'invoice_charge_exhausted', defaultInApp: true, defaultEmail: false },
      { type: 'mandate_setup_stalled', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'payments',
    icon: 'CreditCard',
    types: [
      { type: 'payment_received', defaultInApp: true, defaultEmail: false },
      { type: 'payout_available', defaultInApp: true, defaultEmail: false },
      { type: 'payout_completed', defaultInApp: true, defaultEmail: false },
      { type: 'payout_canceled', defaultInApp: true, defaultEmail: false },
      { type: 'stripe_account_issue', defaultInApp: true, defaultEmail: false },
      { type: 'chargeback_received', defaultInApp: true, defaultEmail: false },
      // PAY-LINK-1: betaling op een post die al betaald of geannuleerd was — nooit automatisch terugbetaald.
      { type: 'payment_duplicate', defaultInApp: true, defaultEmail: false },
      // NOTIF-TYPES-1: handle_payment_notification stuurt deze met categorie payments.
      { type: 'order_payment_failed', defaultInApp: true, defaultEmail: false },
      { type: 'order_refunded', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'customers',
    icon: 'Users',
    types: [
      { type: 'customer_new', defaultInApp: true, defaultEmail: false },
      { type: 'customer_first_order', defaultInApp: true, defaultEmail: false },
      { type: 'customer_vip', defaultInApp: true, defaultEmail: false },
      { type: 'customer_inactive_30days', defaultInApp: false, defaultEmail: false },
      { type: 'customer_inactive_90days', defaultInApp: true, defaultEmail: false },
      { type: 'customer_message_received', defaultInApp: true, defaultEmail: false },
      { type: 'newsletter_signup', defaultInApp: true, defaultEmail: false },
      { type: 'newsletter_unsubscribe', defaultInApp: false, defaultEmail: false },
    ]
  },
  {
    category: 'products',
    icon: 'Package',
    types: [
      { type: 'stock_low', defaultInApp: true, defaultEmail: false },
      { type: 'stock_critical', defaultInApp: true, defaultEmail: false },
      { type: 'stock_out', defaultInApp: true, defaultEmail: false },
      { type: 'stock_replenished', defaultInApp: false, defaultEmail: false },
      { type: 'product_bestseller', defaultInApp: true, defaultEmail: false },
      { type: 'product_no_sales_30days', defaultInApp: true, defaultEmail: false },
      // NOTIF-TYPES-1: sync-bol-orders.
      { type: 'product_unmapped', defaultInApp: true, defaultEmail: false },
      { type: 'out_of_stock', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'quotes',
    icon: 'FileEdit',
    types: [
      { type: 'quote_new', defaultInApp: false, defaultEmail: false },
      { type: 'quote_sent', defaultInApp: false, defaultEmail: false },
      { type: 'quote_viewed', defaultInApp: true, defaultEmail: false },
      { type: 'quote_accepted', defaultInApp: true, defaultEmail: false },
      { type: 'quote_rejected', defaultInApp: true, defaultEmail: false },
      { type: 'quote_expiring_soon', defaultInApp: true, defaultEmail: false },
      { type: 'quote_expired', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'subscriptions',
    icon: 'RefreshCw',
    types: [
      { type: 'subscription_new', defaultInApp: true, defaultEmail: false },
      { type: 'subscription_renewed', defaultInApp: true, defaultEmail: false },
      { type: 'subscription_cancelled', defaultInApp: true, defaultEmail: false },
      { type: 'subscription_payment_failed', defaultInApp: true, defaultEmail: false },
      { type: 'subscription_expiring', defaultInApp: true, defaultEmail: false },
      { type: 'subscription_paused', defaultInApp: true, defaultEmail: false },
      // NOTIF-TYPES-1: process-cycle-reminders.
      { type: 'billing_cycle_expired', defaultInApp: true, defaultEmail: false },
      // BILLING-ENFORCE-1: de statusmachine meldt een wissel aan de winkel zelf.
      { type: 'subscription_state_changed', defaultInApp: true, defaultEmail: false },
      { type: 'subscription_reactivated', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'marketing',
    icon: 'Megaphone',
    types: [
      { type: 'campaign_sent', defaultInApp: true, defaultEmail: false },
      { type: 'campaign_completed', defaultInApp: true, defaultEmail: false },
      { type: 'campaign_high_open_rate', defaultInApp: true, defaultEmail: false },
      { type: 'campaign_high_bounce', defaultInApp: true, defaultEmail: false },
      { type: 'ab_test_winner', defaultInApp: true, defaultEmail: false },
      { type: 'ai_credits_empty', defaultInApp: true, defaultEmail: false },
      // SOCIAL-3: herinnering "zelf posten" en "nieuwe posts klaar om goed te keuren".
      { type: 'social_manual_due', defaultInApp: true, defaultEmail: false },
      { type: 'social_posts_ready', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'team',
    icon: 'UserPlus',
    types: [
      { type: 'team_member_invited', defaultInApp: false, defaultEmail: false },
      { type: 'team_member_joined', defaultInApp: true, defaultEmail: false },
      { type: 'team_member_removed', defaultInApp: true, defaultEmail: false },
      { type: 'team_role_changed', defaultInApp: true, defaultEmail: false },
      { type: 'login_new_device', defaultInApp: true, defaultEmail: false },
      { type: 'login_failed_attempts', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'system',
    icon: 'Settings',
    types: [
      { type: 'platform_gift', defaultInApp: true, defaultEmail: false },
      { type: 'platform_update', defaultInApp: true, defaultEmail: false },
      { type: 'feature_new', defaultInApp: true, defaultEmail: false },
      { type: 'usage_limit_80', defaultInApp: true, defaultEmail: false },
      { type: 'usage_limit_reached', defaultInApp: true, defaultEmail: false },
      { type: 'integration_error', defaultInApp: true, defaultEmail: false },
      { type: 'export_ready', defaultInApp: true, defaultEmail: false },
      { type: 'backup_completed', defaultInApp: false, defaultEmail: false },
      // NOTIF-TYPES-1: check-scheduled-notifications stuurt ai_credits_low met categorie system.
      { type: 'ai_credits_low', defaultInApp: true, defaultEmail: false },
      { type: 'trial_expiring', defaultInApp: true, defaultEmail: false },
      { type: 'trial_expired', defaultInApp: true, defaultEmail: false },
      { type: 'trial_converted', defaultInApp: true, defaultEmail: false },
      { type: 'trial_conversion_failed', defaultInApp: true, defaultEmail: false },
      { type: 'admin_announcement', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    // NOTIF-TYPES-1: ai-proactive-monitor en ai-business-coach. Alleen bij prioriteit
    // high/urgent — die mailen volgens PUSH-DEFAULT-1 ook zonder e-mailschakelaar.
    category: 'ai_coach',
    icon: 'Sparkles',
    types: [
      { type: 'ai_suggestion', defaultInApp: true, defaultEmail: false },
      { type: 'ai_coach_suggestion', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'messages',
    icon: 'MessageSquare',
    types: [
      { type: 'email_inbound', defaultInApp: true, defaultEmail: true },
      { type: 'whatsapp_inbound', defaultInApp: true, defaultEmail: true },
      { type: 'facebook_inbound', defaultInApp: true, defaultEmail: true },
      { type: 'instagram_inbound', defaultInApp: true, defaultEmail: true },
      { type: 'bol_inbound', defaultInApp: true, defaultEmail: true },
      // CONTACT-NOTIFY-1: storefront-api (submit_contact_form) en storefront-contact-form.
      { type: 'contact_form_inbound', defaultInApp: true, defaultEmail: true },
    ]
  },
  {
    category: 'integrations',
    icon: 'Plug',
    types: [
      { type: 'shopify_request_received', defaultInApp: true, defaultEmail: false },
      { type: 'shopify_request_approved', defaultInApp: true, defaultEmail: false },
      { type: 'shopify_request_completed', defaultInApp: true, defaultEmail: false },
      { type: 'shopify_request_rejected', defaultInApp: true, defaultEmail: false },
      { type: 'shopify_request_updated', defaultInApp: true, defaultEmail: false },
      { type: 'integration_connected', defaultInApp: true, defaultEmail: false },
      { type: 'integration_disconnected', defaultInApp: true, defaultEmail: false },
      { type: 'integration_error', defaultInApp: true, defaultEmail: false },
    ]
  },
];
