import {
  LayoutDashboard,
  CalendarCheck,
  Package,
  ShoppingCart,
  Users,
  Truck,
  Settings,
  Building2,
  Receipt,
  Cable,
  Mail,
  Images,
  HelpCircle,
  BookOpen,
  Percent,
  FileSpreadsheet,
  Factory,
  Monitor,
  ChefHat,
  UtensilsCrossed,
  CalendarDays,
  Globe,
  Search,
  Gift,
  LucideIcon,
  MessageSquare,
  Megaphone as MegaphoneIcon,
  LayoutDashboard as PlatformDashboardIcon,
  MessageCircle,
  Bell as ChangelogIcon,
  Activity,
  FileText as LegalIcon,
  Banknote,
  Languages,
  Wallet,
  Library,
} from 'lucide-react';

import type { AppRole } from '@/hooks/useAuth';
import type { Resource } from '@/hooks/useCan';
import type { Track } from '@/lib/tracks';

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
  /**
   * SIDEBAR-CLEAN-1 — landingskind: de pagina van de parent zelf (bv. "Alle
   * bestellingen"). Staat niet in het submenu; de parent linkt ernaartoe als
   * de gebruiker hem mag zien, anders naar het eerste zichtbare kind. Het id
   * blijft bestaan voor de rol-whitelists en verbergregels.
   */
  landing?: boolean;
  /**
   * TRACKS-1 — sporen waarin dit item bestaat. Leeg = kern (iedereen). Een kind
   * zonder eigen sporen erft die van zijn parent. Bewaakt menu én pagina's
   * (TrackGate); binnen een spoor blijven featureKey en requireRead gelden.
   */
  tracks?: Track[];
  /**
   * TRACKS-1 — bewaak alleen de lijstpagina zelf, niet de subroutes. Voor
   * Producten: eventwinkels bewerken combitickets en munten via /admin/products/:id/edit.
   */
  trackGateExact?: boolean;
  /**
   * INKOOP-6 — routes buiten het menu die bij dit item horen (licht op, zelfde sporen),
   * bv. Leveranciersdocumenten onder Inkoop.
   */
  activeAlso?: string[];
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
  'ads', 'ads-overview', 'ads-bolcom', 'ads-products', 'ads-ai',
  'promotions', 'promo-codes', 'promo-bundles', 'promo-bogo', 'promo-volume', 'promo-auto', 'promo-gifts', 'promo-loyalty', 'promo-groups', 'promo-giftcards',
  'social-planner', 'campaigns', 'media', 'seo',
  'translations',
  'reports', 'reports-overview', 'reports-analytics', 'reports-stock',
  'help',
];

// DAGELIJKS - Meest gebruikte functies
const dailyItems: NavItem[] = [
  { id: 'dashboard', titleKey: 'navigation.dashboard', url: '/admin', icon: LayoutDashboard },
  { id: 'inbox', tracks: ['webshop', 'events'], titleKey: 'navigation.items.inbox', url: '/admin/messages', icon: MessageSquare, badge: true, requireRead: 'inbox' },
  {
    id: 'orders',
    titleKey: 'navigation.orders',
    url: '/admin/orders',
    icon: ShoppingCart,
    requireRead: 'orders',
    children: [
      { id: 'orders-all', titleKey: 'navigation.items.orders_all', url: '/admin/orders', requireRead: 'orders', landing: true },
      { id: 'orders-fulfillment', tracks: ['webshop'], titleKey: 'navigation.items.orders_fulfillment', url: '/admin/fulfillment', excludeRoles: ['marketing'], requireRead: 'orders' },
      { id: 'orders-returns', tracks: ['webshop'], titleKey: 'navigation.items.orders_returns', url: '/admin/returns', excludeRoles: ['warehouse', 'marketing'], requireRead: 'returns' },
      { id: 'orders-invoices', titleKey: 'navigation.items.orders_invoices', url: '/admin/orders/invoices', excludeRoles: ['warehouse', 'marketing'], requireRead: 'invoices' },
      { id: 'orders-quotes', tracks: ['webshop'], titleKey: 'navigation.items.orders_quotes', url: '/admin/orders/quotes', excludeRoles: ['warehouse', 'marketing'], requireRead: 'invoices' },
      { id: 'orders-subscriptions', tracks: ['webshop'], titleKey: 'navigation.items.orders_subscriptions', url: '/admin/orders/subscriptions', excludeRoles: ['warehouse', 'marketing'], requireRead: 'invoices' },
    ],
  },
  {
    id: 'products',
    tracks: ['webshop', 'horeca'],
    trackGateExact: true,
    titleKey: 'navigation.products',
    url: '/admin/products',
    icon: Package,
    requireRead: 'products',
    // SIDEBAR-CLEAN-1: Categorieën stond los in Beheer.
    children: [
      { id: 'categories', titleKey: 'navigation.categories', url: '/admin/categories', excludeRoles: ['marketing'], requireRead: 'products' },
    ],
  },
  {
    id: 'customers',
    // WERKPLEK-1: horeca-only winkels hebben geen klantenbestand nodig (gasten bestellen anoniem).
    tracks: ['webshop', 'events'],
    titleKey: 'navigation.customers',
    url: '/admin/customers',
    icon: Users,
    excludeRoles: ['warehouse'],
    requireRead: 'customers',
    // SIDEBAR-CLEAN-1: Klantgroepen stond onder Promoties. URL ongewijzigd.
    children: [
      { id: 'promo-groups', titleKey: 'navigation.items.promo_groups', url: '/admin/promotions/customer-groups', requireRead: 'customers' },
    ],
  },
];

// VERKOOP - Verkoopgerelateerde functies
const salesItems: NavItem[] = [
  { id: 'pos', tracks: ['webshop', 'horeca'], titleKey: 'navigation.items.pos', url: '/admin/pos', icon: Monitor, featureKey: 'pos', excludeRoles: ['marketing'], requireRead: 'pos' },
  // HORECA-1 / TRACKS-1 — horeca-spoor: alleen voor winkels die het hebben.
  { id: 'ordering', tracks: ['horeca'], titleKey: 'navigation.items.ordering', url: '/admin/bestellen', icon: UtensilsCrossed, excludeRoles: ['marketing', 'accountant', 'warehouse'], requireRead: 'orders' },
  { id: 'kitchen', tracks: ['horeca'], titleKey: 'navigation.items.kitchen', url: '/admin/keuken', icon: ChefHat, excludeRoles: ['marketing', 'accountant'], requireRead: 'orders' },
  {
    id: 'event-dashboard',
    tracks: ['events'],
    titleKey: 'navigation.items.event_dashboard',
    url: '/admin/events',
    icon: CalendarDays,
    // TRACKS-1 — events-spoor (vroeger featureKey 'events').
    allowedRoles: ['platform_admin', 'tenant_admin', 'staff'],
    children: [
      { id: 'events-all', titleKey: 'navigation.items.events_all', url: '/admin/events', allowedRoles: ['platform_admin', 'tenant_admin', 'staff'], landing: true },
      { id: 'event-venues', titleKey: 'navigation.items.event_venues', url: '/admin/events/venues', featureKey: 'event_seating', allowedRoles: ['platform_admin', 'tenant_admin', 'staff'] },
      // BLOG-FIX-1: stonden enkel als knop op het eventsoverzicht; zelfde gating als de zusteritems.
      { id: 'event-bundles', titleKey: 'navigation.items.event_bundles', url: '/admin/events/bundles', allowedRoles: ['platform_admin', 'tenant_admin', 'staff'] },
      { id: 'event-tokens', titleKey: 'navigation.items.event_tokens', url: '/admin/events/tokens', allowedRoles: ['platform_admin', 'tenant_admin', 'staff'] },
      { id: 'ticket-checkin', titleKey: 'navigation.items.ticket_checkin', url: '/admin/checkin', allowedRoles: ['platform_admin', 'tenant_admin', 'staff'] },
    ],
  },
  { id: 'storefront', titleKey: 'navigation.items.storefront', url: '/admin/storefront', icon: Globe, featureKey: 'webshop_builder', excludeRoles: ['marketing'], requireRead: 'themes' },
  { id: 'payments', titleKey: 'navigation.items.payments', url: '/admin/payments', icon: Banknote, excludeRoles: ['marketing'], requireRead: 'payments' },
  {
    id: 'promotions',
    // WERKPLEK-1: kortingen horen bij webshop en events; horeca krijgt ze via een webshop-add-on.
    tracks: ['webshop', 'events'],
    titleKey: 'navigation.items.promotions',
    url: '/admin/promotions',
    icon: Percent,
    requireRead: 'discount_codes',
    children: [
      { id: 'promo-codes', titleKey: 'navigation.items.promo_codes', url: '/admin/promotions', requireRead: 'discount_codes', landing: true },
      { id: 'promo-bundles', tracks: ['webshop'], titleKey: 'navigation.items.promo_bundles', url: '/admin/promotions/bundles', featureKey: 'promo_bundles', requireRead: 'discount_codes' },
      { id: 'promo-bogo', tracks: ['webshop'], titleKey: 'navigation.items.promo_bogo', url: '/admin/promotions/bogo', featureKey: 'promo_bogo', requireRead: 'discount_codes' },
      { id: 'promo-volume', tracks: ['webshop'], titleKey: 'navigation.items.promo_volume', url: '/admin/promotions/volume', featureKey: 'promo_volume', requireRead: 'volume_discounts' },
      { id: 'promo-auto', tracks: ['webshop'], titleKey: 'navigation.items.promo_auto', url: '/admin/promotions/auto', requireRead: 'discount_codes' },
      { id: 'promo-gifts', tracks: ['webshop'], titleKey: 'navigation.items.promo_gifts', url: '/admin/promotions/gifts', requireRead: 'discount_codes' },
      { id: 'promo-loyalty', tracks: ['webshop'], titleKey: 'navigation.items.promo_loyalty', url: '/admin/promotions/loyalty', featureKey: 'loyalty_program', requireRead: 'loyalty' },
      { id: 'promo-giftcards', tracks: ['webshop'], titleKey: 'navigation.items.promo_giftcards', url: '/admin/promotions/gift-cards', featureKey: 'promo_giftcards', requireRead: 'discount_codes' },
    ],
  },
];

// MARKETING - Campagnes en content
// WERKPLEK-1 (28-10): marketing hoort bij webshop en events. Een horecawinkel zonder
// add-on ziet hier niets; neemt ze een webshop-add-on, dan komt alles terug.
const marketingItems: NavItem[] = [
  // MARKETING-2/3: één geheel. AI is geen aparte plek meer maar een knop in Social ("Post met AI")
  // en E-mail ("Maak met AI"); de AI Content Hub-route stuurt door (AIHubRedirect).
  // SOCIAL-GATE-1: enkel voor ontgrendelde winkels (granted_features 'social_planner', slotje in
  // beheerweergave). Geen plan bevat deze key; zie useSocialAccess.
  { id: 'social-planner', tracks: ['webshop', 'events'], titleKey: 'navigation.items.social', url: '/admin/marketing/social', icon: CalendarCheck, requireRead: 'marketing', featureKey: 'social_planner' },
  { id: 'campaigns', tracks: ['webshop', 'events'], titleKey: 'navigation.items.email', url: '/admin/marketing', icon: Mail, requireRead: 'marketing' },
  // MAIL-UX-1: Automatiseringen (MAIL-2a) is een tabblad van E-mail (?tab=automations), geen eigen item meer.
  { id: 'media', tracks: ['webshop', 'events'], titleKey: 'navigation.items.media', url: '/admin/marketing/media', icon: Images, requireRead: 'marketing' },
  { id: 'seo', tracks: ['webshop', 'events'], titleKey: 'navigation.items.seo', url: '/admin/marketing/seo', icon: Search, featureKey: 'ai_seo', requireRead: 'seo' },
  // MARKETING-2: Ads verhuisd uit Verkoop naar Marketing.
  {
    id: 'ads',
    tracks: ['webshop'],
    titleKey: 'navigation.items.ads',
    url: '/admin/ads',
    icon: MegaphoneIcon,
    featureKey: 'social_commerce',
    requireRead: 'ads',
    children: [
      { id: 'ads-overview', titleKey: 'navigation.items.ads_overview', url: '/admin/ads', requireRead: 'ads', landing: true },
      { id: 'ads-bolcom', titleKey: 'navigation.items.ads_bolcom', url: '/admin/ads/bolcom', requireRead: 'ads' },
      { id: 'ads-products', titleKey: 'navigation.items.ads_products', url: '/admin/ads/products', requireRead: 'ads' },
      // APP-CLEAN-5: Amazon/Google/Meta-ads verborgen tot ze bestaan (stonden als uitgeschakelde items in het menu).
      { id: 'ads-ai', titleKey: 'navigation.items.ads_ai', url: '/admin/ads/ai', badge: true, requireRead: 'ads' },
    ],
  },
];

// BEHEER - Administratieve functies
const managementItems: NavItem[] = [
  { id: 'translations', tracks: ['webshop', 'events'], titleKey: 'navigation.items.translations', url: '/admin/marketing/translations', icon: Languages, requireRead: 'cms' },
  // SIDEBAR-CLEAN-1: één item; Documenten zit als knop op de Leveranciers-pagina.
  // Id 'purchasing' blijft (tenant_feature_overrides.hidden_pages verwijst ernaar).
  { id: 'purchasing', tracks: ['webshop', 'horeca'], titleKey: 'navigation.items.purchasing', url: '/admin/suppliers', icon: Factory, excludeRoles: ['marketing'], requireRead: 'suppliers', activeAlso: ['/admin/supplier-documents'] },
  {
    id: 'reports',
    titleKey: 'navigation.items.reports',
    url: '/admin/reports',
    icon: FileSpreadsheet,
    // PERM-2: parent staat op 'products' (ALL_ROLES) zodat warehouse het
    // voorraadrapport ziet; de kinderen zijn afzonderlijk gegated.
    requireRead: 'products',
    children: [
      { id: 'reports-overview', titleKey: 'navigation.items.reports_overview', url: '/admin/reports', requireRead: 'reports_financial', landing: true },
      { id: 'reports-analytics', titleKey: 'navigation.analytics', url: '/admin/analytics', requireRead: 'reports_analytics' },
      { id: 'reports-stock', tracks: ['webshop', 'horeca'], titleKey: 'navigation.items.reports_stock', url: '/admin/reports/stock', requireRead: 'products' },
    ],
  },
  { id: 'shipping', tracks: ['webshop'], titleKey: 'navigation.shipping', url: '/admin/shipping', icon: Truck, excludeRoles: ['marketing'] },
];

// SYSTEEM - Instellingen en integraties
const systemItems: NavItem[] = [
  // SIDEBAR-CLEAN-1: Notificaties weg — de bel in de header linkt al naar /admin/notifications.
  // SIDEBAR-CLEAN-1: één item (het kind herhaalde dezelfde URL); Importeren zit als knop op de Connect-pagina.
  { id: 'integrations', tracks: ['webshop', 'events'], titleKey: 'navigation.items.integrations', url: '/admin/connect', icon: Cable, featureKey: 'apiAccess', excludeRoles: ['marketing'], requireRead: 'integrations' },
  { id: 'billing', titleKey: 'navigation.items.billing', url: '/admin/billing', icon: Receipt, excludeRoles: ['marketing'], requireRead: 'platform_billing' },
  { id: 'settings', titleKey: 'navigation.settings', url: '/admin/settings', icon: Settings, excludeRoles: ['marketing'], requireRead: 'settings_general' },
  { id: 'help', titleKey: 'navigation.items.help', url: '/admin/help', icon: HelpCircle },
];

// PLATFORM - Platform admin only
const platformItems: NavItem[] = [
  { id: 'platform-dashboard', titleKey: 'navigation.items.platform_overview', url: '/admin/platform/dashboard', icon: PlatformDashboardIcon },
  { id: 'platform-tenants', titleKey: 'navigation.tenants', url: '/admin/platform', icon: Building2 },
  { id: 'platform-billing', titleKey: 'navigation.items.platform_billing', url: '/admin/platform/billing', icon: Wallet },
  { id: 'platform-coupons', titleKey: 'navigation.items.platform_coupons', url: '/admin/platform/coupons', icon: Gift },
  { id: 'platform-feedback', titleKey: 'navigation.items.platform_feedback', url: '/admin/platform/feedback', icon: MessageCircle },
  { id: 'platform-support', titleKey: 'navigation.items.platform_support', url: '/admin/platform/support', icon: MessageSquare },
  { id: 'platform-changelog', titleKey: 'navigation.items.platform_changelog', url: '/admin/platform/changelog', icon: ChangelogIcon },
  { id: 'platform-blog', titleKey: 'navigation.items.platform_blog', url: '/admin/platform/blog', icon: BookOpen },
  { id: 'platform-health', titleKey: 'navigation.items.platform_health', url: '/admin/platform/health', icon: Activity },
  { id: 'platform-legal', titleKey: 'navigation.items.platform_legal', url: '/admin/platform/legal', icon: LegalIcon },
  { id: 'platform-docs', titleKey: 'navigation.items.platform_docs', url: '/admin/platform/docs', icon: Library },
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
/**
 * Zoekt volledige NavItems op id, in de volgorde waarin je ze vraagt.
 *
 * Voor weergaven die een handvol vaste bestemmingen tonen — de mobiele
 * onderbalk — zonder titels, iconen of `requireRead` opnieuw op te schrijven.
 * Een tweede lijst met dezelfde items zou onvermijdelijk uit elkaar lopen met
 * deze.
 */
export function findNavItems(ids: string[]): NavItem[] {
  const byId = new Map<string, NavItem>();
  for (const group of sidebarGroups) {
    for (const item of group.items) {
      byId.set(item.id, item);
      for (const child of item.children ?? []) byId.set(child.id, child);
    }
  }
  return ids.map((id) => byId.get(id)).filter((item): item is NavItem => !!item);
}

/**
 * TRACKS-1 — het menu-item dat een route dekt (langste URL), met de sporen die
 * gelden (eigen sporen, anders die van de parent). Voor TrackGate: één bron voor
 * menu en pagina-bewaking. Platformroutes en routes buiten het menu: null.
 */
export function findTrackRule(pathname: string): { item: NavItem; tracks: Track[] } | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  let best: { item: NavItem; tracks: Track[]; len: number } | null = null;
  const consider = (item: NavItem, tracks: Track[] | undefined) => {
    const also = (item.activeAlso ?? []).some((u) => path === u || path.startsWith(u + '/'));
    const exact = path === item.url || also;
    const nested = item.url !== '/admin' && path.startsWith(item.url + '/');
    if (!exact && !nested) return;
    if (best && item.url.length <= best.len) return;
    if (!exact && item.trackGateExact) {
      best = { item, tracks: [], len: item.url.length };
      return;
    }
    best = { item, tracks: tracks ?? [], len: item.url.length };
  };
  for (const group of sidebarGroups) {
    for (const item of group.items) {
      consider(item, item.tracks);
      for (const child of item.children ?? []) consider(child, child.tracks ?? item.tracks);
    }
  }
  if (!best) return null;
  const { item, tracks } = best as { item: NavItem; tracks: Track[] };
  return { item, tracks };
}

export function getAllMenuItems(): { id: string; titleKey: string; groupKey: string }[] {
  const items: { id: string; titleKey: string; groupKey: string }[] = [];

  for (const group of sidebarGroups) {
    for (const item of group.items) {
      items.push({ id: item.id, titleKey: item.titleKey, groupKey: group.titleKey });
      if (item.children) {
        for (const child of item.children) {
          if (child.landing) continue;
          items.push({ id: child.id, titleKey: child.titleKey, groupKey: group.titleKey });
        }
      }
    }
  }

  return items;
}
