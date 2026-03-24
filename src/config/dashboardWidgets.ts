import {
  LayoutDashboard,
  Zap,
  BarChart3,
  Store,
  ShoppingCart,
  Trophy,
  Heart,
  Grid3X3,
  Users,
  type LucideIcon,
} from 'lucide-react';

// Widget size types
export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

// Widget category types
export type WidgetCategory = 'stats' | 'orders' | 'products' | 'marketing' | 'pos' | 'system';

// Widget definition interface
export interface DashboardWidgetDefinition {
  id: string;
  title: string;
  description: string;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  category: WidgetCategory;
  requiredFeature?: string;
  icon: LucideIcon;
}

// Layout preset interface
export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  widgetOrder: string[];
  hiddenWidgets: string[];
}

// All available widgets - restructured for clean layout
export const dashboardWidgets: DashboardWidgetDefinition[] = [
  {
    id: 'health-banner',
    title: 'Shop Health',
    description: 'Live score en dagelijkse status',
    defaultSize: 'full',
    minSize: 'full',
    category: 'stats',
    icon: Heart,
  },
  {
    id: 'health-categories',
    title: 'Health Categorieën',
    description: '6 health pilaren in een grid',
    defaultSize: 'full',
    minSize: 'full',
    category: 'stats',
    icon: Grid3X3,
  },
  {
    id: 'today-widget',
    title: 'Vandaag',
    description: 'Live sales feed en dagelijkse statistieken',
    defaultSize: 'md',
    minSize: 'md',
    category: 'stats',
    icon: Zap,
  },
  {
    id: 'health-actions',
    title: 'Actie-items',
    description: 'Urgente taken die aandacht nodig hebben',
    defaultSize: 'full',
    minSize: 'full',
    category: 'stats',
    icon: BarChart3,
  },
  {
    id: 'quick-actions',
    title: 'Snelle acties',
    description: 'Veelgebruikte taken snel bereiken',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'system',
    icon: Zap,
  },
  {
    id: 'ai-marketing',
    title: 'AI Coach',
    description: 'AI suggesties en marketing tips',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'marketing',
    requiredFeature: 'ai_marketing',
    icon: Zap,
  },
  {
    id: 'pos-overview',
    title: 'POS Overzicht',
    description: 'Kassa statistieken en sessies',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'pos',
    requiredFeature: 'pos',
    icon: Store,
  },
  {
    id: 'marketplace',
    title: 'Marktplaatsen',
    description: 'Status van gekoppelde verkoopkanalen',
    defaultSize: 'md',
    minSize: 'md',
    category: 'orders',
    requiredFeature: 'marketplaces',
    icon: ShoppingCart,
  },
  {
    id: 'badges',
    title: 'Badges & Milestones',
    description: 'Jouw verdiende badges en voortgang',
    defaultSize: 'full',
    minSize: 'lg',
    category: 'stats',
    icon: Trophy,
  },
  {
    id: 'customer-health',
    title: 'Klant Gezondheid',
    description: 'Klanten met dalende scores die aandacht nodig hebben',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'stats',
    icon: Users,
  },
];

// Predefined layout presets
export const layoutPresets: LayoutPreset[] = [
  {
    id: 'default',
    name: 'Standaard',
    description: 'Compleet overzicht met alle widgets',
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
    name: 'Compact',
    description: 'Alleen de essentiële informatie',
    icon: Zap,
    widgetOrder: ['health-banner', 'today-widget', 'quick-actions', 'badges'],
    hiddenWidgets: ['health-categories', 'health-actions', 'ai-marketing', 'pos-overview', 'marketplace'],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Focus op data en statistieken',
    icon: BarChart3,
    widgetOrder: ['health-banner', 'health-categories', 'today-widget', 'marketplace', 'badges'],
    hiddenWidgets: ['health-actions', 'quick-actions', 'ai-marketing', 'pos-overview'],
  },
  {
    id: 'pos',
    name: 'POS Focus',
    description: 'Optimaal voor winkelverkoop',
    icon: Store,
    widgetOrder: ['health-banner', 'today-widget', 'pos-overview', 'quick-actions', 'badges'],
    hiddenWidgets: ['health-categories', 'health-actions', 'ai-marketing', 'marketplace'],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Focus op online verkoop',
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

