// PUSH-DEFAULT-1 — defaults van meldingen, en hoe een ontbrekende rij wordt uitgelegd.
//
// Puur, geen imports: backend (create-notification, send-push-notification) en de
// tests laden dit rechtstreeks. De UI leest NOTIFICATION_CONFIG in
// src/types/notification.ts (met labels); src/test/notificationDefaults.test.ts
// houdt die twee type-voor-type gelijk. Wijzig je een default, wijzig hem daar ook.
//
// Tot 18 sep 2026 telde een ontbrekende voorkeursrij als "uit": push kwam nergens
// aan behalve waar iemand zelf rijen had gezet. Nu is een ontbrekende rij de
// default hieronder, en push staat standaard aan.

/** Sleutel = `${category}/${type}`: een type is niet uniek over categorieën heen (integration_error staat in system én integrations). */
export interface TypeDefaults {
  category: string;
  inApp: boolean;
  email: boolean;
}

/** Gegenereerd uit NOTIFICATION_CONFIG; zie de test voor de pariteit. */
export const NOTIFICATION_DEFAULTS: Readonly<Record<string, TypeDefaults>> = {
  "orders/order_new": { category: "orders", inApp: true, email: false },
  "orders/order_paid": { category: "orders", inApp: true, email: false },
  "orders/order_payment_failed": { category: "orders", inApp: true, email: false },
  "orders/order_cancelled": { category: "orders", inApp: true, email: false },
  "orders/order_refund_requested": { category: "orders", inApp: true, email: false },
  "orders/order_shipped": { category: "orders", inApp: false, email: false },
  "orders/order_delivered": { category: "orders", inApp: false, email: false },
  "orders/order_high_value": { category: "orders", inApp: true, email: false },
  "orders/marketplace_order_new": { category: "orders", inApp: true, email: false },
  "invoices/invoice_created": { category: "invoices", inApp: false, email: false },
  "invoices/invoice_sent": { category: "invoices", inApp: false, email: false },
  "invoices/invoice_paid": { category: "invoices", inApp: true, email: false },
  "invoices/invoice_overdue": { category: "invoices", inApp: true, email: false },
  "invoices/invoice_overdue_7days": { category: "invoices", inApp: true, email: false },
  "invoices/invoice_overdue_30days": { category: "invoices", inApp: true, email: false },
  "invoices/invoice_reminder_sent": { category: "invoices", inApp: false, email: false },
  "invoices/peppol_invoice_accepted": { category: "invoices", inApp: true, email: false },
  "invoices/peppol_invoice_rejected": { category: "invoices", inApp: true, email: false },
  "payments/payment_received": { category: "payments", inApp: true, email: false },
  "payments/payout_available": { category: "payments", inApp: true, email: false },
  "payments/payout_completed": { category: "payments", inApp: true, email: false },
  "payments/stripe_account_issue": { category: "payments", inApp: true, email: false },
  "payments/chargeback_received": { category: "payments", inApp: true, email: false },
  "customers/customer_new": { category: "customers", inApp: true, email: false },
  "customers/customer_first_order": { category: "customers", inApp: true, email: false },
  "customers/customer_vip_status": { category: "customers", inApp: true, email: false },
  "customers/customer_inactive_30days": { category: "customers", inApp: false, email: false },
  "customers/customer_inactive_90days": { category: "customers", inApp: true, email: false },
  "customers/customer_message_received": { category: "customers", inApp: true, email: false },
  "customers/newsletter_signup": { category: "customers", inApp: true, email: false },
  "customers/newsletter_unsubscribe": { category: "customers", inApp: false, email: false },
  "products/stock_low": { category: "products", inApp: true, email: false },
  "products/stock_critical": { category: "products", inApp: true, email: false },
  "products/stock_out": { category: "products", inApp: true, email: false },
  "products/stock_replenished": { category: "products", inApp: false, email: false },
  "products/product_bestseller": { category: "products", inApp: true, email: false },
  "products/product_no_sales_30days": { category: "products", inApp: true, email: false },
  "quotes/quote_created": { category: "quotes", inApp: false, email: false },
  "quotes/quote_sent": { category: "quotes", inApp: false, email: false },
  "quotes/quote_viewed": { category: "quotes", inApp: true, email: false },
  "quotes/quote_accepted": { category: "quotes", inApp: true, email: false },
  "quotes/quote_rejected": { category: "quotes", inApp: true, email: false },
  "quotes/quote_expiring_soon": { category: "quotes", inApp: true, email: false },
  "quotes/quote_expired": { category: "quotes", inApp: true, email: false },
  "subscriptions/subscription_new": { category: "subscriptions", inApp: true, email: false },
  "subscriptions/subscription_renewed": { category: "subscriptions", inApp: true, email: false },
  "subscriptions/subscription_cancelled": { category: "subscriptions", inApp: true, email: false },
  "subscriptions/subscription_payment_failed": { category: "subscriptions", inApp: true, email: false },
  "subscriptions/subscription_expiring": { category: "subscriptions", inApp: true, email: false },
  "subscriptions/subscription_paused": { category: "subscriptions", inApp: true, email: false },
  "marketing/campaign_sent": { category: "marketing", inApp: true, email: false },
  "marketing/campaign_completed": { category: "marketing", inApp: true, email: false },
  "marketing/campaign_high_open_rate": { category: "marketing", inApp: true, email: false },
  "marketing/campaign_bounce_alert": { category: "marketing", inApp: true, email: false },
  "marketing/ab_test_winner": { category: "marketing", inApp: true, email: false },
  "marketing/ai_credits_low": { category: "marketing", inApp: true, email: false },
  "marketing/ai_credits_empty": { category: "marketing", inApp: true, email: false },
  "team/team_invitation_sent": { category: "team", inApp: false, email: false },
  "team/team_invitation_accepted": { category: "team", inApp: true, email: false },
  "team/team_member_removed": { category: "team", inApp: true, email: false },
  "team/team_role_changed": { category: "team", inApp: true, email: false },
  "team/login_new_device": { category: "team", inApp: true, email: false },
  "team/login_failed_attempts": { category: "team", inApp: true, email: false },
  "system/platform_gift": { category: "system", inApp: true, email: false },
  "system/platform_update": { category: "system", inApp: true, email: false },
  "system/feature_new": { category: "system", inApp: true, email: false },
  "system/usage_limit_80": { category: "system", inApp: true, email: false },
  "system/usage_limit_reached": { category: "system", inApp: true, email: false },
  "system/integration_error": { category: "system", inApp: true, email: false },
  "system/export_ready": { category: "system", inApp: true, email: false },
  "system/backup_completed": { category: "system", inApp: false, email: false },
  "messages/email_inbound": { category: "messages", inApp: true, email: true },
  "messages/whatsapp_inbound": { category: "messages", inApp: true, email: true },
  "messages/facebook_inbound": { category: "messages", inApp: true, email: true },
  "messages/instagram_inbound": { category: "messages", inApp: true, email: true },
  "messages/bol_inbound": { category: "messages", inApp: true, email: true },
  "messages/contact_form_inbound": { category: "messages", inApp: true, email: true },
  "integrations/shopify_request_submitted": { category: "integrations", inApp: true, email: false },
  "integrations/shopify_request_approved": { category: "integrations", inApp: true, email: false },
  "integrations/shopify_request_completed": { category: "integrations", inApp: true, email: false },
  "integrations/shopify_request_rejected": { category: "integrations", inApp: true, email: false },
  "integrations/integration_connected": { category: "integrations", inApp: true, email: false },
  "integrations/integration_disconnected": { category: "integrations", inApp: true, email: false },
  "integrations/integration_error": { category: "integrations", inApp: true, email: false },
};

/** Push staat voor elk type standaard aan — ook voor een type dat hier (nog) niet staat. */
export const DEFAULT_PUSH = true;

/** Zonder eigen rij mailen deze prioriteiten altijd (bestaande regel, vóór PUSH-DEFAULT-1). */
const EMAIL_PRIORITIES = new Set(["high", "urgent"]);

export function defaultsFor(category: string, type: string): TypeDefaults | undefined {
  return NOTIFICATION_DEFAULTS[`${category}/${type}`];
}

export function resolveEmailEnabled(
  row: { email_enabled?: boolean | null } | null | undefined,
  category: string,
  type: string,
  priority: string | null | undefined,
): boolean {
  if (row && typeof row.email_enabled === "boolean") return row.email_enabled;
  return (defaultsFor(category, type)?.email ?? false) || EMAIL_PRIORITIES.has(priority ?? "");
}

/**
 * Push voor één gebruiker. Een eigen rij beslist. Zonder rij: aan voor wie een rol in
 * de winkel heeft, uit voor een platform-admin zonder rol daar (opt-in, keuze Akke) —
 * anders kwam van elke klantwinkel elke bestelling op de eigen telefoon binnen.
 */
export function resolvePushEnabled(
  row: { push_enabled?: boolean | null } | null | undefined,
  opts: { isTenantMember: boolean },
): boolean {
  if (row && typeof row.push_enabled === "boolean") return row.push_enabled;
  return opts.isTenantMember ? DEFAULT_PUSH : false;
}

// ── E-mail-throttle voor categorie `messages` ─────────────────────────

export const MESSAGE_EMAIL_WINDOW_MS = 15 * 60 * 1000;

function normalizeAddress(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const angled = /<([^<>]+)>/.exec(raw);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}

/**
 * Wie is "het gesprek"? Kanaal (het type) + afzender uit de meldingsdata. De afzender
 * staat er altijd in (e-mail: `from`, WhatsApp: `from_phone`, Meta: `sender_id`);
 * `customer_id` ontbreekt bij een nieuwe afzender en is alleen de laatste terugval.
 */
export function messageConversationKey(type: string, data: Record<string, unknown> | null | undefined): string | null {
  const d = data ?? {};
  const sender =
    normalizeAddress(d.from) ??
    (typeof d.from_phone === "string" && d.from_phone.trim() ? d.from_phone.trim() : null) ??
    (typeof d.sender_id === "string" && d.sender_id.trim() ? d.sender_id.trim() : null) ??
    (typeof d.customer_id === "string" && d.customer_id.trim() ? `customer:${d.customer_id.trim()}` : null);
  return sender ? `${type}|${sender}` : null;
}

/** Is er in het venster al een mail gegaan voor hetzelfde gesprek? */
export function isEmailThrottled(
  key: string | null,
  recent: ReadonlyArray<{ key: string | null; emailSentAt: string | null }>,
  now: Date,
  windowMs: number = MESSAGE_EMAIL_WINDOW_MS,
): boolean {
  if (!key) return false;
  const since = now.getTime() - windowMs;
  return recent.some((r) => r.key === key && !!r.emailSentAt && new Date(r.emailSentAt).getTime() >= since);
}
