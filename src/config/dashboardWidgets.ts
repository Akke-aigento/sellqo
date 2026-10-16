import {
  LayoutDashboard,
  Zap,
  BarChart3,
  Store,
  ShoppingCart,
  Trophy,
  Heart,
  Grid3X3,
  type LucideIcon,
} from 'lucide-react';

// Widget size types
export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

// Widget category types — label via admin.dashboardWidgets.categories.<category>
export type WidgetCategory = 'stats' | 'orders' | 'products' | 'marketing' | 'pos' | 'system';

// Widget definition interface
export interface DashboardWidgetDefinition {
  id: string;
  /** i18n-key voor de widgettitel (admin.dashboardWidgets.widgets.<id>.title). */
  titleKey: string;
  /** i18n-key voor de omschrijving. */
  descriptionKey: string;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  category: WidgetCategory;
  requiredFeature?: string;
  /**
   * Optionele koppeling naar een sidebar page-id (`sidebarConfig`).
   * Als de tenant deze page verborgen heeft via `hidden_pages`, wordt
   * de widget ook op het dashboard verborgen.
   */
  pageId?: string;
  icon: LucideIcon;
}

// Layout preset interface
export interface LayoutPreset {
  id: string;
  /** i18n-key voor de layoutnaam (admin.dashboardWidgets.presets.<id>.name). */
  nameKey: string;
  /** i18n-key voor de omschrijving. */
  descriptionKey: string;
  icon: LucideIcon;
  widgetOrder: string[];
  hiddenWidgets: string[];
}

// All available widgets - restructured for clean layout
export const dashboardWidgets: DashboardWidgetDefinition[] = [
  {
    id: 'health-banner',
    titleKey: 'admin.dashboardWidgets.widgets.health-banner.title',
    descriptionKey: 'admin.dashboardWidgets.widgets.health-banner.description',
    defaultSize: 'full',
    minSize: 'full',
    category: 'stats',
    icon: Heart,
  },
  {
    id: 'health-categories',
    titleKey: 'admin.dashboardWidgets.widgets.health-categories.title',
    descriptionKey: 'admin.dashboardWidgets.widgets.health-categories.description',
    defaultSize: 'full',
    minSize: 'full',
    category: 'stats',
    icon: Grid3X3,
  },
  {
    id: 'today-widget',
    titleKey: 'admin.dashboardWidgets.widgets.today-widget.title',
    descriptionKey: 'admin.dashboardWidgets.widgets.today-widget.description',
    defaultSize: 'md',
    minSize: 'md',
    category: 'stats',
    icon: Zap,
  },
  {
    id: 'health-actions',
    titleKey: 'admin.dashboardWidgets.widgets.health-actions.title',
    descriptionKey: 'admin.dashboardWidgets.widgets.health-actions.description',
    defaultSize: 'full',
    minSize: 'full',
    category: 'stats',
    icon: BarChart3,
  },
  {
    id: 'quick-actions',
    titleKey: 'admin.dashboardWidgets.widgets.quick-actions.title',
    descriptionKey: 'admin.dashboardWidgets.widgets.quick-actions.description',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'system',
    icon: Zap,
  },
  {
    id: 'ai-marketing',
    titleKey: 'admin.dashboardWidgets.widgets.ai-marketing.title',
    descriptionKey: 'admin.dashboardWidgets.widgets.ai-marketing.description',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'marketing',
    requiredFeature: 'ai_marketing',
    // MARKETING-2: de AI-tools zitten in Social (tab Maken); 'ai-tools' blijft de verbergsleutel.
    pageId: 'ai-tools',
    icon: Zap,
  },
  {
    id: 'pos-overview',
    titleKey: 'admin.dashboardWidgets.widgets.pos-overview.title',
    descriptionKey: 'admin.dashboardWidgets.widgets.pos-overview.description',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'pos',
    requiredFeature: 'pos',
    pageId: 'pos',
    icon: Store,
  },
  {
    id: 'marketplace',
    titleKey: 'admin.dashboardWidgets.widgets.marketplace.title',
    descriptionKey: 'admin.dashboardWidgets.widgets.marketplace.description',
    defaultSize: 'md',
    minSize: 'md',
    category: 'orders',
    requiredFeature: 'marketplaces',
    pageId: 'integrations',
    icon: ShoppingCart,
  },
  {
    id: 'badges',
    titleKey: 'admin.dashboardWidgets.widgets.badges.title',
    descriptionKey: 'admin.dashboardWidgets.widgets.badges.description',
    defaultSize: 'full',
    minSize: 'lg',
    category: 'stats',
    icon: Trophy,
  },
];

// Predefined layout presets
export const layoutPresets: LayoutPreset[] = [
  {
    id: 'default',
    nameKey: 'admin.dashboardWidgets.presets.default.name',
    descriptionKey: 'admin.dashboardWidgets.presets.default.description',
    icon: LayoutDashboard,
    widgetOrder: [
      'health-banner',
      'health-categories',
      'today-widget',
      'health-actions',
      'quick-actions',
      'ai-marketing',
      'pos-overview',
      'marketplace',
      'badges',
    ],
    hiddenWidgets: [],
  },
  {
    id: 'compact',
    nameKey: 'admin.dashboardWidgets.presets.compact.name',
    descriptionKey: 'admin.dashboardWidgets.presets.compact.description',
    icon: Zap,
    widgetOrder: ['health-banner', 'today-widget', 'quick-actions', 'badges'],
    hiddenWidgets: ['health-categories', 'health-actions', 'ai-marketing', 'pos-overview', 'marketplace'],
  },
  {
    id: 'analytics',
    nameKey: 'admin.dashboardWidgets.presets.analytics.name',
    descriptionKey: 'admin.dashboardWidgets.presets.analytics.description',
    icon: BarChart3,
    widgetOrder: ['health-banner', 'health-categories', 'today-widget', 'marketplace', 'badges'],
    hiddenWidgets: ['health-actions', 'quick-actions', 'ai-marketing', 'pos-overview'],
  },
  {
    id: 'pos',
    nameKey: 'admin.dashboardWidgets.presets.pos.name',
    descriptionKey: 'admin.dashboardWidgets.presets.pos.description',
    icon: Store,
    widgetOrder: ['health-banner', 'today-widget', 'pos-overview', 'quick-actions', 'badges'],
    hiddenWidgets: ['health-categories', 'health-actions', 'ai-marketing', 'marketplace'],
  },
  {
    id: 'ecommerce',
    nameKey: 'admin.dashboardWidgets.presets.ecommerce.name',
    descriptionKey: 'admin.dashboardWidgets.presets.ecommerce.description',
    icon: ShoppingCart,
    widgetOrder: [
      'health-banner',
      'health-categories',
      'today-widget',
      'marketplace',
      'ai-marketing',
      'badges',
    ],
    hiddenWidgets: ['health-actions', 'quick-actions', 'pos-overview'],
  },
];

// Helper to get widget by ID
export function getWidgetById(id: string): DashboardWidgetDefinition | undefined {
  return dashboardWidgets.find((w) => w.id === id);
}

// Helper to get layout preset by ID
export function getLayoutPresetById(id: string): LayoutPreset | undefined {
  return layoutPresets.find((l) => l.id === id);
}

// Helper to get widgets for a category
export function getWidgetsByCategory(category: WidgetCategory): DashboardWidgetDefinition[] {
  return dashboardWidgets.filter((w) => w.category === category);
}

// Default widget order (all widgets in default order)
export const defaultWidgetOrder = dashboardWidgets.map((w) => w.id);

