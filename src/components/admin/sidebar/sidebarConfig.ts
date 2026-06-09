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
  title: string;
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
  title: string;
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
  'reports', 'reports-overview', 'reports-analytics',
  'help',
];

// DAGELIJKS - Meest gebruikte functies
const dailyItems: NavItem[] = [
  { id: 'dashboard', title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { id: 'inbox', title: 'Inbox', url: '/admin/messages', icon: MessageSquare, badge: true, requireRead: 'inbox' },
  {
    id: 'orders',
    title: 'Bestellingen',
    url: '/admin/orders',
    icon: ShoppingCart,
    requireRead: 'orders',
    children: [
      { id: 'orders-all', title: 'Alle bestellingen', url: '/admin/orders', requireRead: 'orders' },
      { id: 'orders-fulfillment', title: 'Fulfillment', url: '/admin/fulfillment', excludeRoles: ['marketing'], requireRead: 'orders' },
      { id: 'orders-returns', title: 'Retouren', url: '/admin/returns', excludeRoles: ['warehouse', 'marketing'], requireRead: 'returns' },
      { id: 'orders-invoices', title: 'Facturen', url: '/admin/orders/invoices', excludeRoles: ['warehouse', 'marketing'], requireRead: 'invoices' },
      { id: 'orders-quotes', title: 'Offertes', url: '/admin/orders/quotes', excludeRoles: ['warehouse', 'marketing'], requireRead: 'invoices' },
    ],
  },
  { id: 'products', title: 'Producten', url: '/admin/products', icon: Package, requireRead: 'products' },
  { id: 'customers', title: 'Klanten', url: '/admin/customers', icon: Users, excludeRoles: ['warehouse'], requireRead: 'customers' },
];

// VERKOOP - Verkoopgerelateerde functies
const salesItems: NavItem[] = [
  { id: 'pos', title: 'Kassa (POS)', url: '/admin/pos', icon: Monitor, featureKey: 'pos', excludeRoles: ['marketing'], requireRead: 'pos' },
  { id: 'storefront', title: 'Webshop', url: '/admin/storefront', icon: Globe, featureKey: 'webshop_builder', excludeRoles: ['marketing'], requireRead: 'themes' },
  { id: 'payments', title: 'Betalingen', url: '/admin/payments', icon: Banknote, excludeRoles: ['marketing'], requireRead: 'payments' },
  {
    id: 'ads',
    title: 'Ads',
    url: '/admin/ads',
    icon: MegaphoneIcon,
    featureKey: 'social_commerce',
    requireRead: 'ads',
    children: [
      { id: 'ads-overview', title: 'Overzicht', url: '/admin/ads', requireRead: 'ads' },
      { id: 'ads-bolcom', title: 'Bol.com', url: '/admin/ads/bolcom', requireRead: 'ads' },
      { id: 'ads-products', title: 'Product Mapping', url: '/admin/ads/products', requireRead: 'ads' },
      { id: 'ads-amazon', title: 'Amazon', url: '/admin/ads/amazon', disabled: true },
      { id: 'ads-google', title: 'Google', url: '/admin/ads/google', disabled: true },
      { id: 'ads-meta', title: 'Meta', url: '/admin/ads/meta', disabled: true },
      { id: 'ads-ai', title: 'AI Regels', url: '/admin/ads/ai', badge: true, requireRead: 'ads' },
    ],
  },
  {
    id: 'promotions',
    title: 'Promoties',
    url: '/admin/promotions',
    icon: Percent,
    requireRead: 'discount_codes',
    children: [
      { id: 'promo-codes', title: 'Kortingscodes', url: '/admin/promotions', requireRead: 'discount_codes' },
      { id: 'promo-bundles', title: 'Bundels', url: '/admin/promotions/bundles', featureKey: 'promo_bundles', requireRead: 'discount_codes' },
      { id: 'promo-bogo', title: 'BOGO acties', url: '/admin/promotions/bogo', featureKey: 'promo_bogo', requireRead: 'discount_codes' },
      { id: 'promo-volume', title: 'Staffelkorting', url: '/admin/promotions/volume', featureKey: 'promo_volume', requireRead: 'volume_discounts' },
      { id: 'promo-auto', title: 'Auto-kortingen', url: '/admin/promotions/auto', requireRead: 'discount_codes' },
      { id: 'promo-gifts', title: 'Cadeauacties', url: '/admin/promotions/gifts', requireRead: 'discount_codes' },
      { id: 'promo-loyalty', title: 'Loyaliteit', url: '/admin/promotions/loyalty', featureKey: 'loyalty_program', requireRead: 'loyalty' },
      { id: 'promo-groups', title: 'Klantgroepen', url: '/admin/promotions/customer-groups', requireRead: 'customers' },
      { id: 'promo-giftcards', title: 'Cadeaubonnen', url: '/admin/promotions/gift-cards', featureKey: 'promo_giftcards', requireRead: 'discount_codes' },
    ],
  },
];

// MARKETING - Campagnes en content
const marketingItems: NavItem[] = [
  { id: 'campaigns', title: 'Campagnes', url: '/admin/marketing', icon: Megaphone, requireRead: 'marketing' },
  {
    id: 'ai-tools',
    title: 'AI Tools',
    url: '/admin/marketing/ai',
    icon: Sparkles,
    featureKey: 'ai_marketing',
    requireRead: 'ai_assistant',
    children: [
      { id: 'ai-content', title: 'AI Content Hub', url: '/admin/marketing/ai', featureKey: 'ai_marketing', requireRead: 'ai_assistant' },
      { id: 'ai-actions', title: 'AI Actie Centrum', url: '/admin/marketing/ai-center', featureKey: 'ai_coach', requireRead: 'ai_coach' },
    ],
  },
  { id: 'seo', title: 'SEO', url: '/admin/marketing/seo', icon: Search, featureKey: 'ai_seo', requireRead: 'seo' },
];

// BEHEER - Administratieve functies
const managementItems: NavItem[] = [
  { id: 'categories', title: 'Categorieën', url: '/admin/categories', icon: FolderTree, excludeRoles: ['marketing'], requireRead: 'products' },
  { id: 'translations', title: 'Vertalingen', url: '/admin/marketing/translations', icon: Globe, requireRead: 'cms' },
  {
    id: 'purchasing',
    title: 'Inkoop',
    url: '/admin/suppliers',
    icon: Factory,
    excludeRoles: ['marketing'],
    requireRead: 'suppliers',
    children: [
      { id: 'suppliers', title: 'Leveranciers', url: '/admin/suppliers', requireRead: 'suppliers' },
      { id: 'purchase-orders', title: 'Inkooporders', url: '/admin/purchase-orders', requireRead: 'suppliers' },
      { id: 'supplier-docs', title: 'Documenten', url: '/admin/supplier-documents', requireRead: 'suppliers' },
    ],
  },
  {
    id: 'reports',
    title: 'Rapporten',
    url: '/admin/reports',
    icon: FileSpreadsheet,
    requireRead: 'reports',
    children: [
      { id: 'reports-overview', title: 'Overzicht', url: '/admin/reports', requireRead: 'reports' },
      { id: 'reports-analytics', title: 'Analytics', url: '/admin/analytics', requireRead: 'reports' },
    ],
  },
  { id: 'shipping', title: 'Verzending', url: '/admin/shipping', icon: Truck, excludeRoles: ['marketing'] },
];

// SYSTEEM - Instellingen en integraties
const systemItems: NavItem[] = [
  { id: 'notifications', title: 'Notificaties', url: '/admin/notifications', icon: BellRing, excludeRoles: ['marketing'], requireRead: 'settings_general' },
  {
    id: 'integrations',
    title: 'SellQo Connect',
    url: '/admin/connect',
    icon: Cable,
    featureKey: 'apiAccess',
    excludeRoles: ['marketing'],
    requireRead: 'integrations',
    children: [
      { id: 'integrations-connect', title: 'SellQo Connect', url: '/admin/connect', requireRead: 'integrations' },
      { id: 'integrations-import', title: 'Importeren', url: '/admin/import', requireRead: 'integrations' },
    ],
  },
  { id: 'billing', title: 'Abonnement', url: '/admin/billing', icon: Receipt, excludeRoles: ['marketing'], requireRead: 'platform_billing' },
  { id: 'settings', title: 'Instellingen', url: '/admin/settings', icon: Settings, excludeRoles: ['marketing'], requireRead: 'settings_general' },
  { id: 'help', title: 'Help', url: '/admin/help', icon: HelpCircle },
];

// PLATFORM - Platform admin only
const platformItems: NavItem[] = [
  { id: 'platform-dashboard', title: 'Dashboard', url: '/admin/platform/dashboard', icon: PlatformDashboardIcon },
  { id: 'platform-tenants', title: 'Tenants', url: '/admin/platform', icon: Building2 },
  { id: 'platform-billing', title: 'Platform Billing', url: '/admin/platform/billing', icon: Receipt },
  { id: 'platform-coupons', title: 'Coupons', url: '/admin/platform/coupons', icon: Gift },
  { id: 'platform-feedback', title: 'Feedback', url: '/admin/platform/feedback', icon: MessageCircle },
  { id: 'platform-support', title: 'Support', url: '/admin/platform/support', icon: MessageSquare },
  { id: 'platform-changelog', title: 'Changelog', url: '/admin/platform/changelog', icon: ChangelogIcon },
  { id: 'platform-health', title: 'Health Monitor', url: '/admin/platform/health', icon: Activity },
  { id: 'platform-legal', title: 'Juridisch', url: '/admin/platform/legal', icon: LegalIcon },
  { id: 'platform-docs', title: 'Documentatie', url: '/admin/platform/docs', icon: BookOpen },
];

export const sidebarGroups: NavGroup[] = [
  { id: 'daily', title: 'Dagelijks', items: dailyItems },
  { id: 'sales', title: 'Verkoop', items: salesItems },
  { id: 'marketing', title: 'Marketing', items: marketingItems },
  { id: 'management', title: 'Beheer', items: managementItems },
  { id: 'system', title: 'Systeem', items: systemItems },
];

export const platformGroup: NavGroup = { id: 'platform', title: 'Platform', items: platformItems };

// Flatten all items for the customize dialog
export function getAllMenuItems(): { id: string; title: string; group: string }[] {
  const items: { id: string; title: string; group: string }[] = [];
  
  for (const group of sidebarGroups) {
    for (const item of group.items) {
      items.push({ id: item.id, title: item.title, group: group.title });
      if (item.children) {
        for (const child of item.children) {
          items.push({ id: child.id, title: child.title, group: group.title });
        }
      }
    }
  }
  
  return items;
}
