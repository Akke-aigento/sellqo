import { ComponentType } from 'react';
import {
  LayoutDashboard,
  Zap,
  BarChart3,
  Store,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';

// Widget size types
export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

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

// All available widgets
export const dashboardWidgets: DashboardWidgetDefinition[] = [
  {
    id: 'shop-health',
    title: 'Shop Health',
    description: 'Live overzicht van je winkel gezondheid',
    defaultSize: 'full',
    minSize: 'full',
    category: 'stats',
    icon: BarChart3,
  },
  {
    id: 'stats-grid',
    title: 'Statistieken',
    description: 'Omzet, bestellingen, producten en alerts',
    defaultSize: 'full',
    minSize: 'lg',
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
    id: 'recent-orders',
    title: 'Recente bestellingen',
    description: 'Laatste 5 bestellingen',
    defaultSize: 'md',
    minSize: 'sm',
    category: 'orders',
    icon: ShoppingCart,
  },
  {
    id: 'ai-marketing',
    title: 'AI Marketing',
    description: 'AI credits en marketing suggesties',
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
    defaultSize: 'full',
    minSize: 'lg',
    category: 'orders',
    requiredFeature: 'marketplaces',
    icon: ShoppingCart,
  },
  {
    id: 'low-stock',
    title: 'Lage voorraad',
    description: 'Producten met lage voorraad',
    defaultSize: 'full',
    minSize: 'lg',
    category: 'products',
    icon: BarChart3,
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
      'shop-health',
      'stats-grid',
      'quick-actions',
      'recent-orders',
      'ai-marketing',
      'pos-overview',
      'marketplace',
      'low-stock',
    ],
    hiddenWidgets: [],
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Alleen de essentiële informatie',
    icon: Zap,
    widgetOrder: ['stats-grid', 'quick-actions', 'recent-orders'],
    hiddenWidgets: ['ai-marketing', 'pos-overview', 'marketplace', 'low-stock'],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Focus op data en statistieken',
    icon: BarChart3,
    widgetOrder: ['stats-grid', 'marketplace', 'low-stock', 'recent-orders'],
    hiddenWidgets: ['quick-actions', 'ai-marketing', 'pos-overview'],
  },
  {
    id: 'pos',
    name: 'POS Focus',
    description: 'Optimaal voor winkelverkoop',
    icon: Store,
    widgetOrder: ['stats-grid', 'pos-overview', 'quick-actions', 'low-stock'],
    hiddenWidgets: ['recent-orders', 'ai-marketing', 'marketplace'],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Focus op online verkoop',
    icon: ShoppingCart,
    widgetOrder: [
      'stats-grid',
      'recent-orders',
      'marketplace',
      'ai-marketing',
      'low-stock',
    ],
    hiddenWidgets: ['quick-actions', 'pos-overview'],
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

// Widget size to grid classes mapping
export const widgetSizeClasses: Record<WidgetSize, string> = {
  sm: 'lg:col-span-1',
  md: 'lg:col-span-1',
  lg: 'lg:col-span-2',
  xl: 'lg:col-span-2',
  full: 'lg:col-span-3',
};
