import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Settings, Check, X } from 'lucide-react';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import { DashboardWidgetWrapper } from './DashboardWidgetWrapper';
import { DashboardLayoutSwitcher } from './DashboardLayoutSwitcher';
import { DashboardCustomizeDialog } from './DashboardCustomizeDialog';
import { getWidgetById } from '@/config/dashboardWidgets';

// Widget components (lazy imports would be better for production)
import { StatsGridWidget } from './widgets/StatsGridWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { RecentOrdersWidget } from './widgets/RecentOrdersWidget';
import { AIMarketingWidget } from './widgets/AIMarketingWidget';
import { POSOverviewWidget } from './widgets/POSOverviewWidget';
import { MarketplaceWidget } from './widgets/MarketplaceWidget';
import { LowStockWidget } from './widgets/LowStockWidget';

// Widget component mapping
const widgetComponents: Record<string, React.ComponentType> = {
  'stats-grid': StatsGridWidget,
  'quick-actions': QuickActionsWidget,
  'recent-orders': RecentOrdersWidget,
  'ai-marketing': AIMarketingWidget,
  'pos-overview': POSOverviewWidget,
  'marketplace': MarketplaceWidget,
  'low-stock': LowStockWidget,
};

export function DashboardGrid() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const {
    widgetOrder,
    hiddenWidgets,
    isWidgetVisible,
    updateWidgetOrder,
    isUpdating,
  } = useDashboardPreferences();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter visible widgets
  const visibleWidgets = widgetOrder.filter((id) => isWidgetVisible(id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgetOrder.indexOf(active.id as string);
      const newIndex = widgetOrder.indexOf(over.id as string);
      const newOrder = arrayMove(widgetOrder, oldIndex, newIndex);
      updateWidgetOrder(newOrder);
    }
  };

  const renderWidget = (widgetId: string) => {
    const Widget = widgetComponents[widgetId];
    const widgetDef = getWidgetById(widgetId);
    
    if (!Widget || !widgetDef) return null;

    return (
      <DashboardWidgetWrapper
        key={widgetId}
        id={widgetId}
        size={widgetDef.defaultSize}
        isEditMode={isEditMode}
      >
        <Widget />
      </DashboardWidgetWrapper>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overzicht van je winkel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DashboardLayoutSwitcher />
          
          {isEditMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Annuleren
              </Button>
              <Button
                size="sm"
                onClick={() => setIsEditMode(false)}
                disabled={isUpdating}
              >
                <Check className="h-4 w-4 mr-2" />
                Klaar
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomizeOpen(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Personaliseren
            </Button>
          )}
        </div>
      </div>

      {/* Widget Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleWidgets} strategy={rectSortingStrategy}>
          <div className="grid gap-6 lg:grid-cols-3">
            {visibleWidgets.map(renderWidget)}
          </div>
        </SortableContext>
      </DndContext>

      {/* Customize Dialog */}
      <DashboardCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
      />
    </div>
  );
}
