import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FolderTree,
  Truck,
  Settings,
  BarChart3,
  Building2,
  Store,
  FileText,
  Receipt,
  Upload,
  Cable,
  Megaphone,
  HelpCircle,
  BookOpen,
  Percent,
  FileSpreadsheet,
  Factory,
  ClipboardList,
  FileBox,
  BellRing,
  Bot,
  Monitor,
  CalendarDays,
  Globe,
  Search,
  Gift,
  Layers,
  Tags,
  TrendingUp,
  Sparkles,
  LucideIcon,
  PackageCheck,
  MessageSquare,
  Megaphone as MegaphoneIcon,
  LayoutDashboard as PlatformDashboardIcon,
  MessageCircle,
  Bell as ChangelogIcon,
  Activity,
  FileText as LegalIcon,
  Banknote,
} from 'lucide-react';

import type { AppRole } from '@/hooks/useAuth';
import type { Resource } from '@/hooks/useCan';

export interface NavItem {
  id: string;
  /** i18n-key; render met t(titleKey). Nooit een letterlijke tekst. */
  titleKey: string;
  url: string;
  icon?: LucideIcon;
  children?: NavItem[];
  featureKey?: string; // For subscription-based hiding
  allowedRoles?: AppRole[]; // Which roles CAN see this item
  excludeRoles?: AppRole[]; // Which roles CANNOT see this item
  badge?: boolean; // Show dynamic badge (e.g., unread count)
  disabled?: boolean; // Show as grayed out with "soon" badge
  /**
   * H4a — whitelist via permissie-matrix. Als gevuld, dan moet de huidige
   * rol minstens `read` rechten hebben op deze resource om het item te
   * zien. Heeft voorrang op legacy allowedRoles/excludeRoles.
   */
  requireRead?: Resource;
}

export interface NavGroup {
  id: string;
  /** i18n-key; render met t(titleKey). Nooit een letterlijke tekst. */
  titleKey: string;
  items: NavItem[];
}

// Items that warehouse users are allowed to see
export const WAREHOUSE_ALLOWED_ITEMS = [
  'dashboard',
  'orders',
  'orders-all',
  'orders-fulfillment',
  'products',
  'shipping',
];

// Items that marketing users are allowed to see. Everything else is hidden
// from the sidebar for this role (matrix-driven; see useCan.ts).
export const MARKETING_ALLOWED_ITEMS = [
  'dashboard',
  'inbox',
  'orders', 'orders-all',
  'products',
  'customers',
  'ads', 'ads-overview', 'ads-bolcom', 'ads-products', 'ads-amazon', 'ads-google', 'ads-meta', 'ads-ai',
  'promotions', 'promo-codes', 'promo-bundles', 'promo-bogo', 'promo-volume', 'promo-auto', 'promo-gifts', 'promo-loyalty', 'promo-groups', 'promo-giftcards',
  'campaigns', 'ai-tools', 'ai-content', 'ai-actions', 'seo',
  'translations',
  'reports', 'reports-overview', 'reports-analytics', 'reports-stock',
  'help',
];

// DAGELIJKS - Meest gebruikte functies
const dailyItems: NavItem[] = [
  { id: 'dashboard', titleKey: 'navigation.dashboard', url: '/admin', icon: LayoutDashboard },
  { id: 'inbox', titleKey: 'navigation.items.inbox', url: '/admin/messages', icon: MessageSquare, badge: true, requireRead: 'inbox' },
  {
    id: 'orders',
    titleKey: 'navigation.orders',
    url: '/admin/orders',
    icon: ShoppingCart,
    requireRead: 'orders',
    children: [
      { id: 'orders-all', titleKey: 'navigation.items.orders_all', url: '/admin/orders', requireRead: 'orders' },
      { id: 'orders-fulfillment', titleKey: 'navigation.items.orders_fulfillment', url: '/admin/fulfillment', excludeRoles: ['marketing'], requireRead: 'orders' },
      { id: 'orders-returns', titleKey: 'navigation.items.orders_returns', url: '/admin/returns', excludeRoles: ['warehouse', 'marketing'], requireRead: 'returns' },
      { id: 'orders-invoices', titleKey: 'navigation.items.orders_invoices', url: '/admin/orders/invoices', excludeRoles: ['warehouse', 'marketing'], requireRead: 'invoices' },
      { id: 'orders-quotes', titleKey: 'navigation.items.orders_quotes', url: '/admin/orders/quotes', excludeRoles: ['warehouse', 'marketing'], requireRead: 'invoices' },
      { id: 'orders-subscriptions', titleKey: 'navigation.items.orders_subscriptions', url: '/admin/orders/subscriptions', excludeRoles: ['warehouse', 'marketing'], requireRead: 'invoices' },
    ],
  },
  { id: 'products', titleKey: 'navigation.products', url: '/admin/products', icon: Package, requireRead: 'products' },
  { id: 'customers', titleKey: 'navigation.customers', url: '/admin/customers', icon: Users, excludeRoles: ['warehouse'], requireRead: 'customers' },
];

// VERKOOP - Verkoopgerelateerde functies
const salesItems: NavItem[] = [
  { id: 'pos', titleKey: 'navigation.items.pos', url: '/admin/pos', icon: Monitor, featureKey: 'pos', excludeRoles: ['marketing'], requireRead: 'pos' },
  {
    id: 'event-dashboard',
    titleKey: 'navigation.items.event_dashboard',
    url: '/admin/events',
    icon: CalendarDays,
    allowedRoles: ['platform_admin', 'tenant_admin', 'staff'],
    children: [
      { id: 'events-all', titleKey: 'navigation.items.events_all', url: '/admin/events', allowedRoles: ['platform_admin', 'tenant_admin', 'staff'] },
      { id: 'ticket-checkin', titleKey: 'navigation.items.ticket_checkin', url: '/admin/checkin', allowedRoles: ['platform_admin', 'tenant_admin', 'staff'] },
    ],
  },
  { id: 'storefront', titleKey: 'navigation.items.storefront', url: '/admin/storefront', icon: Globe, featureKey: 'webshop_builder', excludeRoles: ['marketing'], requireRead: 'themes' },
  { id: 'payments', titleKey: 'navigation.items.payments', url: '/admin/payments', icon: Banknote, excludeRoles: ['marketing'], requireRead: 'payments' },
  {
    id: 'ads',
    titleKey: 'navigation.items.ads',
    url: '/admin/ads',
    icon: MegaphoneIcon,
    featureKey: 'social_commerce',
    requireRead: 'ads',
    children: [
      { id: 'ads-overview', titleKey: 'navigation.items.ads_overview', url: '/admin/ads', requireRead: 'ads' },
      { id: 'ads-bolcom', titleKey: 'navigation.items.ads_bolcom', url: '/admin/ads/bolcom', requireRead: 'ads' },
      { id: 'ads-products', titleKey: 'navigation.items.ads_products', url: '/admin/ads/products', requireRead: 'ads' },
      { id: 'ads-amazon', titleKey: 'navigation.items.ads_amazon', url: '/admin/ads/amazon', disabled: true },
      { id: 'ads-google', titleKey: 'navigation.items.ads_google', url: '/admin/ads/google', disabled: true },
      { id: 'ads-meta', titleKey: 'navigation.items.ads_meta', url: '/admin/ads/meta', disabled: true },
      { id: 'ads-ai', titleKey: 'navigation.items.ads_ai', url: '/admin/ads/ai', badge: true, requireRead: 'ads' },
    ],
  },
  {
    id: 'promotions',
    titleKey: 'navigation.items.promotions',
    url: '/admin/promotions',
    icon: Percent,
    requireRead: 'discount_codes',
    children: [
      { id: 'promo-codes', titleKey: 'navigation.items.promo_codes', url: '/admin/promotions', requireRead: 'discount_codes' },
      { id: 'promo-bundles', titleKey: 'navigation.items.promo_bundles', url: '/admin/promotions/bundles', featureKey: 'promo_bundles', requireRead: 'discount_codes' },
      { id: 'promo-bogo', titleKey: 'navigation.items.promo_bogo', url: '/admin/promotions/bogo', featureKey: 'promo_bogo', requireRead: 'discount_codes' },
      { id: 'promo-volume', titleKey: 'navigation.items.promo_volume', url: '/admin/promotions/volume', featureKey: 'promo_volume', requireRead: 'volume_discounts' },
      { id: 'promo-auto', titleKey: 'navigation.items.promo_auto', url: '/admin/promotions/auto', requireRead: 'discount_codes' },
      { id: 'promo-gifts', titleKey: 'navigation.items.promo_gifts', url: '/admin/promotions/gifts', requireRead: 'discount_codes' },
      { id: 'promo-loyalty', titleKey: 'navigation.items.promo_loyalty', url: '/admin/promotions/loyalty', featureKey: 'loyalty_program', requireRead: 'loyalty' },
      { id: 'promo-groups', titleKey: 'navigation.items.promo_groups', url: '/admin/promotions/customer-groups', requireRead: 'customers' },
      { id: 'promo-giftcards', titleKey: 'navigation.items.promo_giftcards', url: '/admin/promotions/gift-cards', featureKey: 'promo_giftcards', requireRead: 'discount_codes' },
    ],
  },
];

// MARKETING - Campagnes en content
const marketingItems: NavItem[] = [
  { id: 'campaigns', titleKey: 'navigation.items.campaigns', url: '/admin/marketing', icon: Megaphone, requireRead: 'marketing' },
  {
    id: 'ai-tools',
    titleKey: 'navigation.items.ai_tools',
    url: '/admin/marketing/ai',
    icon: Sparkles,
    featureKey: 'ai_marketing',
    requireRead: 'ai_assistant',
    children: [
      { id: 'ai-content', titleKey: 'navigation.items.ai_content', url: '/admin/marketing/ai', featureKey: 'ai_marketing', requireRead: 'ai_assistant' },
      { id: 'ai-actions', titleKey: 'navigation.items.ai_actions', url: '/admin/marketing/ai-center', featureKey: 'ai_coach', requireRead: 'ai_coach' },
    ],
  },
  { id: 'seo', titleKey: 'navigation.items.seo', url: '/admin/marketing/seo', icon: Search, featureKey: 'ai_seo', requireRead: 'seo' },
];

// BEHEER - Administratieve functies
const managementItems: NavItem[] = [
  { id: 'categories', titleKey: 'navigation.categories', url: '/admin/categories', icon: FolderTree, excludeRoles: ['marketing'], requireRead: 'products' },
  { id: 'translations', titleKey: 'navigation.items.translations', url: '/admin/marketing/translations', icon: Globe, requireRead: 'cms' },
  {
    id: 'purchasing',
    titleKey: 'navigation.items.purchasing',
    url: '/admin/suppliers',
    icon: Factory,
    excludeRoles: ['marketing'],
    requireRead: 'suppliers',
    children: [
      { id: 'suppliers', titleKey: 'navigation.items.suppliers', url: '/admin/suppliers', requireRead: 'suppliers' },
      { id: 'purchase-orders', titleKey: 'navigation.items.purchase_orders', url: '/admin/purchase-orders', requireRead: 'suppliers' },
      { id: 'supplier-docs', titleKey: 'navigation.items.supplier_docs', url: '/admin/supplier-documents', requireRead: 'suppliers' },
    ],
  },
  {
    id: 'reports',
    titleKey: 'navigation.items.reports',
    url: '/admin/reports',
    icon: FileSpreadsheet,
    // PERM-2: parent staat op 'products' (ALL_ROLES) zodat warehouse het
    // voorraadrapport ziet; de kinderen zijn afzonderlijk gegated.
    requireRead: 'products',
    children: [
      { id: 'reports-overview', titleKey: 'navigation.items.reports_overview', url: '/admin/reports', requireRead: 'reports_financial' },
      { id: 'reports-analytics', titleKey: 'navigation.analytics', url: '/admin/analytics', requireRead: 'reports_analytics' },
      { id: 'reports-stock', titleKey: 'navigation.items.reports_stock', url: '/admin/reports/stock', requireRead: 'products' },
    ],
  },
  { id: 'shipping', titleKey: 'navigation.shipping', url: '/admin/shipping', icon: Truck, excludeRoles: ['marketing'] },
];

// SYSTEEM - Instellingen en integraties
const systemItems: NavItem[] = [
  { id: 'notifications', titleKey: 'navigation.items.notifications', url: '/admin/notifications', icon: BellRing, excludeRoles: ['marketing'], requireRead: 'settings_general' },
  {
    id: 'integrations',
    titleKey: 'navigation.items.integrations',
    url: '/admin/connect',
    icon: Cable,
    featureKey: 'apiAccess',
    excludeRoles: ['marketing'],
    requireRead: 'integrations',
    children: [
      { id: 'integrations-connect', titleKey: 'navigation.items.integrations_connect', url: '/admin/connect', requireRead: 'integrations' },
      { id: 'integrations-import', titleKey: 'navigation.import', url: '/admin/import', requireRead: 'integrations' },
    ],
  },
  { id: 'billing', titleKey: 'navigation.items.billing', url: '/admin/billing', icon: Receipt, excludeRoles: ['marketing'], requireRead: 'platform_billing' },
  { id: 'settings', titleKey: 'navigation.settings', url: '/admin/settings', icon: Settings, excludeRoles: ['marketing'], requireRead: 'settings_general' },
  { id: 'help', titleKey: 'navigation.items.help', url: '/admin/help', icon: HelpCircle },
];

// PLATFORM - Platform admin only
const platformItems: NavItem[] = [
  { id: 'platform-dashboard', titleKey: 'navigation.dashboard', url: '/admin/platform/dashboard', icon: PlatformDashboardIcon },
  { id: 'platform-tenants', titleKey: 'navigation.tenants', url: '/admin/platform', icon: Building2 },
  { id: 'platform-billing', titleKey: 'navigation.items.platform_billing', url: '/admin/platform/billing', icon: Receipt },
  { id: 'platform-coupons', titleKey: 'navigation.items.platform_coupons', url: '/admin/platform/coupons', icon: Gift },
  { id: 'platform-feedback', titleKey: 'navigation.items.platform_feedback', url: '/admin/platform/feedback', icon: MessageCircle },
  { id: 'platform-support', titleKey: 'navigation.items.platform_support', url: '/admin/platform/support', icon: MessageSquare },
  { id: 'platform-changelog', titleKey: 'navigation.items.platform_changelog', url: '/admin/platform/changelog', icon: ChangelogIcon },
  { id: 'platform-blog', titleKey: 'navigation.items.platform_blog', url: '/admin/platform/blog', icon: BookOpen },
  { id: 'platform-health', titleKey: 'navigation.items.platform_health', url: '/admin/platform/health', icon: Activity },
  { id: 'platform-legal', titleKey: 'navigation.items.platform_legal', url: '/admin/platform/legal', icon: LegalIcon },
  { id: 'platform-docs', titleKey: 'navigation.items.platform_docs', url: '/admin/platform/docs', icon: BookOpen },
];

export const sidebarGroups: NavGroup[] = [
  { id: 'daily', titleKey: 'navigation.groups.daily', items: dailyItems },
  { id: 'sales', titleKey: 'navigation.groups.sales', items: salesItems },
  { id: 'marketing', titleKey: 'navigation.groups.marketing', items: marketingItems },
  { id: 'management', titleKey: 'navigation.groups.management', items: managementItems },
  { id: 'system', titleKey: 'navigation.groups.system', items: systemItems },
];

export const platformGroup: NavGroup = { id: 'platform', titleKey: 'navigation.platform', items: platformItems };

// Flatten all items for the customize dialog
export function getAllMenuItems(): { id: string; titleKey: string; groupKey: string }[] {
  const items: { id: string; titleKey: string; groupKey: string }[] = [];

  for (const group of sidebarGroups) {
    for (const item of group.items) {
      items.push({ id: item.id, titleKey: item.titleKey, groupKey: group.titleKey });
      if (item.children) {
        for (const child of item.children) {
          items.push({ id: child.id, titleKey: child.titleKey, groupKey: group.titleKey });
        }
      }
    }
  }

  return items;
}
