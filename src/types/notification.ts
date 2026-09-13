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

export interface NotificationTypeConfig {
  type: string;
  label: string;
  description: string;
  defaultInApp: boolean;
  defaultEmail: boolean;
}

export interface NotificationCategoryConfig {
  category: NotificationCategory;
  label: string;
  icon: string;
  types: NotificationTypeConfig[];
}

// All available notification types organized by category
export const NOTIFICATION_CONFIG: NotificationCategoryConfig[] = [
  {
    category: 'orders',
    label: 'Bestellingen',
    icon: 'ShoppingCart',
    types: [
      { type: 'order_new', label: 'Nieuwe bestelling', description: 'Ontvang een melding bij elke nieuwe bestelling', defaultInApp: true, defaultEmail: true },
      { type: 'order_paid', label: 'Betaling ontvangen', description: 'Wanneer een bestelling is betaald', defaultInApp: true, defaultEmail: false },
      { type: 'order_payment_failed', label: 'Betaling mislukt', description: 'Wanneer een betaling faalt', defaultInApp: true, defaultEmail: true },
      { type: 'order_cancelled', label: 'Bestelling geannuleerd', description: 'Wanneer een bestelling wordt geannuleerd', defaultInApp: true, defaultEmail: false },
      { type: 'order_refund_requested', label: 'Terugbetaling aangevraagd', description: 'Wanneer een klant terugbetaling vraagt', defaultInApp: true, defaultEmail: true },
      { type: 'order_shipped', label: 'Bestelling verzonden', description: 'Wanneer een bestelling is verzonden', defaultInApp: false, defaultEmail: false },
      { type: 'order_delivered', label: 'Bestelling afgeleverd', description: 'Wanneer een bestelling is afgeleverd', defaultInApp: false, defaultEmail: false },
      { type: 'order_high_value', label: 'Hoge waarde bestelling', description: 'Bestellingen boven €500', defaultInApp: true, defaultEmail: true },
      { type: 'marketplace_order_new', label: 'Marketplace bestelling', description: 'Nieuwe bestelling via marketplace', defaultInApp: true, defaultEmail: true },
    ]
  },
  {
    category: 'invoices',
    label: 'Facturen',
    icon: 'FileText',
    types: [
      { type: 'invoice_created', label: 'Factuur aangemaakt', description: 'Wanneer een nieuwe factuur wordt aangemaakt', defaultInApp: false, defaultEmail: false },
      { type: 'invoice_sent', label: 'Factuur verzonden', description: 'Wanneer een factuur is verzonden', defaultInApp: false, defaultEmail: false },
      { type: 'invoice_paid', label: 'Factuur betaald', description: 'Wanneer een factuur is betaald', defaultInApp: true, defaultEmail: false },
      { type: 'invoice_overdue', label: 'Factuur achterstallig', description: 'Wanneer een factuur over de vervaldatum is', defaultInApp: true, defaultEmail: true },
      { type: 'invoice_overdue_7days', label: '7 dagen achterstallig', description: 'Factuur is 7 dagen over datum', defaultInApp: true, defaultEmail: true },
      { type: 'invoice_overdue_30days', label: '30 dagen achterstallig', description: 'Factuur is 30 dagen over datum - urgent', defaultInApp: true, defaultEmail: true },
      { type: 'invoice_reminder_sent', label: 'Herinnering verzonden', description: 'Wanneer een betalingsherinnering is verzonden', defaultInApp: false, defaultEmail: false },
      { type: 'peppol_invoice_accepted', label: 'Peppol geaccepteerd', description: 'Peppol factuur is geaccepteerd', defaultInApp: true, defaultEmail: false },
      { type: 'peppol_invoice_rejected', label: 'Peppol afgewezen', description: 'Peppol factuur is afgewezen', defaultInApp: true, defaultEmail: true },
    ]
  },
  {
    category: 'payments',
    label: 'Betalingen',
    icon: 'CreditCard',
    types: [
      { type: 'payment_received', label: 'Betaling ontvangen', description: 'Wanneer een betaling binnenkomt', defaultInApp: true, defaultEmail: false },
      { type: 'payout_available', label: 'Uitbetaling beschikbaar', description: 'Wanneer een uitbetaling klaar staat', defaultInApp: true, defaultEmail: true },
      { type: 'payout_completed', label: 'Uitbetaling voltooid', description: 'Wanneer een uitbetaling is gedaan', defaultInApp: true, defaultEmail: false },
      { type: 'stripe_account_issue', label: 'Stripe probleem', description: 'Probleem met je Stripe account', defaultInApp: true, defaultEmail: true },
      { type: 'chargeback_received', label: 'Chargeback ontvangen', description: 'Wanneer een klant een chargeback indient', defaultInApp: true, defaultEmail: true },
    ]
  },
  {
    category: 'customers',
    label: 'Klanten',
    icon: 'Users',
    types: [
      { type: 'customer_new', label: 'Nieuwe klant', description: 'Wanneer een nieuwe klant registreert', defaultInApp: true, defaultEmail: false },
      { type: 'customer_first_order', label: 'Eerste bestelling', description: 'Wanneer een klant zijn eerste bestelling plaatst', defaultInApp: true, defaultEmail: false },
      { type: 'customer_vip_status', label: 'VIP status bereikt', description: 'Wanneer een klant VIP wordt', defaultInApp: true, defaultEmail: false },
      { type: 'customer_inactive_30days', label: '30 dagen inactief', description: 'Klant is 30 dagen niet actief geweest', defaultInApp: false, defaultEmail: false },
      { type: 'customer_inactive_90days', label: '90 dagen inactief', description: 'Klant is 90 dagen niet actief geweest', defaultInApp: true, defaultEmail: false },
      { type: 'customer_message_received', label: 'Bericht ontvangen', description: 'Wanneer een klant reageert op een email', defaultInApp: true, defaultEmail: true },
      { type: 'newsletter_signup', label: 'Nieuwsbrief inschrijving', description: 'Nieuwe inschrijving op de nieuwsbrief', defaultInApp: true, defaultEmail: false },
      { type: 'newsletter_unsubscribe', label: 'Nieuwsbrief uitschrijving', description: 'Klant schrijft zich uit voor nieuwsbrief', defaultInApp: false, defaultEmail: false },
    ]
  },
  {
    category: 'products',
    label: 'Producten & Voorraad',
    icon: 'Package',
    types: [
      { type: 'stock_low', label: 'Voorraad laag', description: 'Wanneer voorraad onder minimum niveau komt', defaultInApp: true, defaultEmail: true },
      { type: 'stock_critical', label: 'Voorraad kritiek', description: 'Voorraad kritiek laag (< 5 stuks)', defaultInApp: true, defaultEmail: true },
      { type: 'stock_out', label: 'Uitverkocht', description: 'Product is uitverkocht', defaultInApp: true, defaultEmail: true },
      { type: 'stock_replenished', label: 'Voorraad aangevuld', description: 'Voorraad is weer op peil', defaultInApp: false, defaultEmail: false },
      { type: 'product_bestseller', label: 'Bestseller', description: 'Product is bestseller geworden', defaultInApp: true, defaultEmail: false },
      { type: 'product_no_sales_30days', label: 'Geen verkopen', description: 'Product heeft 30 dagen geen verkopen', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'quotes',
    label: 'Offertes',
    icon: 'FileEdit',
    types: [
      { type: 'quote_created', label: 'Offerte aangemaakt', description: 'Wanneer een nieuwe offerte wordt aangemaakt', defaultInApp: false, defaultEmail: false },
      { type: 'quote_sent', label: 'Offerte verzonden', description: 'Wanneer een offerte is verzonden', defaultInApp: false, defaultEmail: false },
      { type: 'quote_viewed', label: 'Offerte bekeken', description: 'Klant heeft offerte bekeken', defaultInApp: true, defaultEmail: false },
      { type: 'quote_accepted', label: 'Offerte geaccepteerd', description: 'Klant heeft offerte geaccepteerd', defaultInApp: true, defaultEmail: true },
      { type: 'quote_rejected', label: 'Offerte afgewezen', description: 'Klant heeft offerte afgewezen', defaultInApp: true, defaultEmail: false },
      { type: 'quote_expiring_soon', label: 'Offerte verloopt', description: 'Offerte verloopt binnen 3 dagen', defaultInApp: true, defaultEmail: true },
      { type: 'quote_expired', label: 'Offerte verlopen', description: 'Offerte is verlopen', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'subscriptions',
    label: 'Abonnementen',
    icon: 'RefreshCw',
    types: [
      { type: 'subscription_new', label: 'Nieuw abonnement', description: 'Nieuw abonnement gestart', defaultInApp: true, defaultEmail: true },
      { type: 'subscription_renewed', label: 'Abonnement verlengd', description: 'Abonnement is automatisch verlengd', defaultInApp: true, defaultEmail: false },
      { type: 'subscription_cancelled', label: 'Abonnement opgezegd', description: 'Klant heeft abonnement opgezegd', defaultInApp: true, defaultEmail: true },
      { type: 'subscription_payment_failed', label: 'Betaling mislukt', description: 'Abonnement betaling is mislukt', defaultInApp: true, defaultEmail: true },
      { type: 'subscription_expiring', label: 'Abonnement verloopt', description: 'Abonnement verloopt binnenkort', defaultInApp: true, defaultEmail: true },
      { type: 'subscription_paused', label: 'Abonnement gepauzeerd', description: 'Abonnement is gepauzeerd', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'marketing',
    label: 'Marketing',
    icon: 'Megaphone',
    types: [
      { type: 'campaign_sent', label: 'Campagne verzonden', description: 'Email campagne is verzonden', defaultInApp: true, defaultEmail: false },
      { type: 'campaign_completed', label: 'Campagne afgerond', description: 'Campagne is volledig afgerond', defaultInApp: true, defaultEmail: false },
      { type: 'campaign_high_open_rate', label: 'Hoge open rate', description: 'Campagne heeft > 50% open rate', defaultInApp: true, defaultEmail: false },
      { type: 'campaign_bounce_alert', label: 'Bounce alert', description: 'Veel bounces in campagne', defaultInApp: true, defaultEmail: true },
      { type: 'ab_test_winner', label: 'A/B test winnaar', description: 'A/B test winnaar is bepaald', defaultInApp: true, defaultEmail: false },
      { type: 'ai_credits_low', label: 'AI credits laag', description: 'AI credits zijn bijna op', defaultInApp: true, defaultEmail: true },
      { type: 'ai_credits_empty', label: 'AI credits op', description: 'AI credits zijn op', defaultInApp: true, defaultEmail: true },
    ]
  },
  {
    category: 'team',
    label: 'Team',
    icon: 'UserPlus',
    types: [
      { type: 'team_invitation_sent', label: 'Uitnodiging verzonden', description: 'Team uitnodiging is verzonden', defaultInApp: false, defaultEmail: false },
      { type: 'team_invitation_accepted', label: 'Uitnodiging geaccepteerd', description: 'Nieuw teamlid is toegevoegd', defaultInApp: true, defaultEmail: false },
      { type: 'team_member_removed', label: 'Teamlid verwijderd', description: 'Teamlid is verwijderd', defaultInApp: true, defaultEmail: false },
      { type: 'team_role_changed', label: 'Rol gewijzigd', description: 'Rol van teamlid is gewijzigd', defaultInApp: true, defaultEmail: false },
      { type: 'login_new_device', label: 'Nieuwe apparaat', description: 'Inlog vanaf nieuw apparaat', defaultInApp: true, defaultEmail: true },
      { type: 'login_failed_attempts', label: 'Mislukte inlogpogingen', description: 'Meerdere mislukte inlogpogingen', defaultInApp: true, defaultEmail: true },
    ]
  },
  {
    category: 'system',
    label: 'Systeem',
    icon: 'Settings',
    types: [
      { type: 'platform_gift', label: 'Gratis geschenk', description: 'Ontvang meldingen wanneer je gratis credits, maanden of features krijgt', defaultInApp: true, defaultEmail: true },
      { type: 'platform_update', label: 'Platform update', description: 'Nieuwe platform update beschikbaar', defaultInApp: true, defaultEmail: false },
      { type: 'feature_new', label: 'Nieuwe functie', description: 'Nieuwe functie beschikbaar', defaultInApp: true, defaultEmail: false },
      { type: 'usage_limit_80', label: '80% limiet', description: '80% van plan limiet bereikt', defaultInApp: true, defaultEmail: true },
      { type: 'usage_limit_reached', label: 'Limiet bereikt', description: 'Plan limiet is bereikt', defaultInApp: true, defaultEmail: true },
      { type: 'integration_error', label: 'Integratie fout', description: 'Fout met marketplace of shipping integratie', defaultInApp: true, defaultEmail: true },
      { type: 'export_ready', label: 'Export gereed', description: 'Gegevensexport is gereed voor download', defaultInApp: true, defaultEmail: false },
      { type: 'backup_completed', label: 'Backup voltooid', description: 'Database backup is voltooid', defaultInApp: false, defaultEmail: false },
    ]
  },
  {
    category: 'messages',
    label: 'Berichten',
    icon: 'MessageSquare',
    types: [
      { type: 'email_inbound', label: 'Email ontvangen', description: 'Wanneer een inkomende email binnenkomt', defaultInApp: true, defaultEmail: false },
      { type: 'whatsapp_inbound', label: 'WhatsApp ontvangen', description: 'Wanneer een WhatsApp bericht binnenkomt', defaultInApp: true, defaultEmail: false },
      { type: 'facebook_inbound', label: 'Facebook bericht', description: 'Wanneer een Facebook bericht binnenkomt', defaultInApp: true, defaultEmail: false },
      { type: 'instagram_inbound', label: 'Instagram DM', description: 'Wanneer een Instagram DM binnenkomt', defaultInApp: true, defaultEmail: false },
      { type: 'bol_inbound', label: 'Bol.com vraag', description: 'Wanneer een vraag via Bol.com binnenkomt', defaultInApp: true, defaultEmail: false },
    ]
  },
  {
    category: 'integrations',
    label: 'SellQo Connect',
    icon: 'Plug',
    types: [
      { type: 'shopify_request_submitted', label: 'Shopify verzoek ingediend', description: 'Wanneer je een Shopify koppelverzoek indient', defaultInApp: true, defaultEmail: false },
      { type: 'shopify_request_approved', label: 'Shopify verzoek goedgekeurd', description: 'Wanneer je Shopify verzoek is goedgekeurd', defaultInApp: true, defaultEmail: true },
      { type: 'shopify_request_completed', label: 'Shopify koppeling actief', description: 'Wanneer je Shopify koppeling is geactiveerd', defaultInApp: true, defaultEmail: true },
      { type: 'shopify_request_rejected', label: 'Shopify verzoek afgewezen', description: 'Wanneer je Shopify verzoek is afgewezen', defaultInApp: true, defaultEmail: true },
      { type: 'integration_connected', label: 'SellQo Connect verbonden', description: 'Wanneer een nieuwe integratie wordt gekoppeld', defaultInApp: true, defaultEmail: false },
      { type: 'integration_disconnected', label: 'SellQo Connect ontkoppeld', description: 'Wanneer een integratie wordt ontkoppeld', defaultInApp: true, defaultEmail: false },
      { type: 'integration_error', label: 'SellQo Connect fout', description: 'Wanneer er een fout optreedt bij een integratie', defaultInApp: true, defaultEmail: true },
    ]
  },
];
