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
} from 'lucide-react';

import type { AppRole } from '@/hooks/useAuth';

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
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

// Items that warehouse users are allowed to see
export const WAREHOUSE_ALLOWED_ITEMS = [
  'dashboard',
  'fulfillment',
  'orders',
  'orders-all',
  'products',
  'integrations-shipping',
];

// DAGELIJKS - Meest gebruikte functies
const dailyItems: NavItem[] = [
  { id: 'dashboard', title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { id: 'inbox', title: 'Gesprekken', url: '/admin/messages', icon: MessageSquare, badge: true },
  { id: 'fulfillment', title: 'Fulfillment', url: '/admin/fulfillment', icon: PackageCheck },
  {
    id: 'orders',
    title: 'Bestellingen',
    url: '/admin/orders',
    icon: ShoppingCart,
    children: [
      { id: 'orders-all', title: 'Alle bestellingen', url: '/admin/orders' },
      { id: 'orders-quotes', title: 'Offertes', url: '/admin/orders/quotes', excludeRoles: ['warehouse'] },
      { id: 'orders-invoices', title: 'Facturen', url: '/admin/orders/invoices', excludeRoles: ['warehouse'] },
      { id: 'orders-creditnotes', title: "Creditnota's", url: '/admin/orders/creditnotes', excludeRoles: ['warehouse'] },
      { id: 'orders-subscriptions', title: 'Abonnementen', url: '/admin/orders/subscriptions', excludeRoles: ['warehouse'] },
    ],
  },
  { id: 'products', title: 'Producten', url: '/admin/products', icon: Package },
  { id: 'customers', title: 'Klanten', url: '/admin/customers', icon: Users, excludeRoles: ['warehouse'] },
];

// VERKOOP - Verkoopgerelateerde functies
const salesItems: NavItem[] = [
  { id: 'pos', title: 'Kassa (POS)', url: '/admin/pos', icon: Monitor, featureKey: 'pos' },
  { id: 'storefront', title: 'Webshop', url: '/admin/storefront', icon: Globe, featureKey: 'webshop_builder' },
  { id: 'ads', title: 'Advertenties', url: '/admin/ads', icon: MegaphoneIcon, featureKey: 'social_commerce' },
  {
    id: 'promotions',
    title: 'Promoties',
    url: '/admin/promotions',
    icon: Percent,
    children: [
      { id: 'promo-codes', title: 'Kortingscodes', url: '/admin/promotions' },
      { id: 'promo-bundles', title: 'Bundels', url: '/admin/promotions/bundles', featureKey: 'promo_bundles' },
      { id: 'promo-bogo', title: 'BOGO acties', url: '/admin/promotions/bogo', featureKey: 'promo_bogo' },
      { id: 'promo-volume', title: 'Staffelkorting', url: '/admin/promotions/volume', featureKey: 'promo_volume' },
      { id: 'promo-auto', title: 'Auto-kortingen', url: '/admin/promotions/auto' },
      { id: 'promo-gifts', title: 'Cadeauacties', url: '/admin/promotions/gifts' },
      { id: 'promo-loyalty', title: 'Loyaliteit', url: '/admin/promotions/loyalty', featureKey: 'loyalty_program' },
      { id: 'promo-groups', title: 'Klantgroepen', url: '/admin/promotions/customer-groups' },
      { id: 'promo-giftcards', title: 'Cadeaubonnen', url: '/admin/promotions/gift-cards', featureKey: 'promo_giftcards' },
    ],
  },
];

// MARKETING - Campagnes en content
const marketingItems: NavItem[] = [
  { id: 'campaigns', title: 'Campagnes', url: '/admin/marketing', icon: Megaphone },
  {
    id: 'ai-tools',
    title: 'AI Tools',
    url: '/admin/marketing/ai',
    icon: Sparkles,
    featureKey: 'ai_marketing',
    children: [
      { id: 'ai-content', title: 'AI Content Hub', url: '/admin/marketing/ai', featureKey: 'ai_marketing' },
      { id: 'ai-actions', title: 'AI Actie Centrum', url: '/admin/marketing/ai-center', featureKey: 'ai_coach' },
    ],
  },
  { id: 'seo', title: 'SEO', url: '/admin/marketing/seo', icon: Search, featureKey: 'ai_seo' },
  { id: 'translations', title: 'Vertalingen', url: '/admin/marketing/translations', icon: Globe },
];

// BEHEER - Administratieve functies
const managementItems: NavItem[] = [
  { id: 'categories', title: 'Categorieën', url: '/admin/categories', icon: FolderTree },
  {
    id: 'purchasing',
    title: 'Inkoop',
    url: '/admin/suppliers',
    icon: Factory,
    children: [
      { id: 'suppliers', title: 'Leveranciers', url: '/admin/suppliers' },
      { id: 'purchase-orders', title: 'Inkooporders', url: '/admin/purchase-orders' },
      { id: 'supplier-docs', title: 'Documenten', url: '/admin/supplier-documents' },
    ],
  },
  {
    id: 'reports',
    title: 'Rapporten',
    url: '/admin/reports',
    icon: FileSpreadsheet,
    children: [
      { id: 'reports-overview', title: 'Overzicht', url: '/admin/reports' },
      { id: 'reports-analytics', title: 'Analytics', url: '/admin/analytics' },
    ],
  },
];

// SYSTEEM - Instellingen en integraties
const systemItems: NavItem[] = [
  { id: 'notifications', title: 'Notificaties', url: '/admin/notifications', icon: BellRing },
  {
    id: 'integrations',
    title: 'Integraties',
    url: '/admin/connect',
    icon: Cable,
    children: [
      { id: 'integrations-connect', title: 'SellQo Connect', url: '/admin/connect' },
      { id: 'integrations-import', title: 'Importeren', url: '/admin/import' },
      { id: 'integrations-shipping', title: 'Verzending', url: '/admin/shipping' },
    ],
  },
  { id: 'billing', title: 'Facturatie', url: '/admin/billing', icon: Receipt },
  { id: 'settings', title: 'Instellingen', url: '/admin/settings', icon: Settings },
];

// PLATFORM - Platform admin only
const platformItems: NavItem[] = [
  { id: 'platform-dashboard', title: 'Dashboard', url: '/admin/platform/dashboard', icon: PlatformDashboardIcon },
  { id: 'platform-tenants', title: 'Tenants', url: '/admin/platform', icon: Building2 },
  { id: 'platform-billing', title: 'Platform Billing', url: '/admin/platform/billing', icon: Receipt },
  { id: 'platform-feedback', title: 'Feedback', url: '/admin/platform/feedback', icon: MessageCircle },
  { id: 'platform-support', title: 'Support', url: '/admin/platform/support', icon: MessageSquare },
  { id: 'platform-changelog', title: 'Changelog', url: '/admin/platform/changelog', icon: ChangelogIcon },
  { id: 'platform-health', title: 'Health Monitor', url: '/admin/platform/health', icon: Activity },
  { id: 'platform-legal', title: 'Juridisch', url: '/admin/platform/legal', icon: LegalIcon },
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
