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

// Widget components
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { AIMarketingWidget } from './widgets/AIMarketingWidget';
import { POSOverviewWidget } from './widgets/POSOverviewWidget';
import { MarketplaceWidget } from './widgets/MarketplaceWidget';
import { TodayWidget } from './widgets/TodayWidget';
import { BadgesWidget } from './widgets/BadgesWidget';
import { HealthBannerWidget } from './widgets/HealthBannerWidget';
import { HealthCategoriesWidget } from './widgets/HealthCategoriesWidget';
import { HealthActionsWidget } from './widgets/HealthActionsWidget';

// Widget component mapping
const widgetComponents: Record<string, React.ComponentType> = {
  'health-banner': HealthBannerWidget,
  'health-categories': HealthCategoriesWidget,
  'health-actions': HealthActionsWidget,
  'today-widget': TodayWidget,
  'quick-actions': QuickActionsWidget,
  'ai-marketing': AIMarketingWidget,
  'pos-overview': POSOverviewWidget,
  'marketplace': MarketplaceWidget,
  'badges': BadgesWidget,
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

  // Split into full-width and column widgets
  const fullWidgetIds = visibleWidgets.filter((id) => {
    const def = getWidgetById(id);
    return def?.defaultSize === 'full';
  });

  // Find leading full widgets, column widgets, and trailing full widgets
  const leadingFull: string[] = [];
  const trailingFull: string[] = [];
  const columnWidgets: string[] = [];

  let foundNonFull = false;
  let lastNonFullIndex = -1;

  // Find the last non-full widget index
  for (let i = visibleWidgets.length - 1; i >= 0; i--) {
    const def = getWidgetById(visibleWidgets[i]);
    if (def?.defaultSize !== 'full') {
      lastNonFullIndex = i;
      break;
    }
  }

  for (let i = 0; i < visibleWidgets.length; i++) {
    const id = visibleWidgets[i];
    const def = getWidgetById(id);
    const isFull = def?.defaultSize === 'full';

    if (!foundNonFull && isFull) {
      leadingFull.push(id);
    } else if (i > lastNonFullIndex && isFull) {
      trailingFull.push(id);
    } else {
      foundNonFull = true;
      columnWidgets.push(id);
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgetOrder.indexOf(active.id as string);
      const newIndex = widgetOrder.indexOf(over.id as string);
      const newOrder = arrayMove(widgetOrder, oldIndex, newIndex);
      updateWidgetOrder(newOrder);
    }
  };

  const renderWidget = (widgetId: string, isLastInColumn = false) => {
    const Widget = widgetComponents[widgetId];
    const widgetDef = getWidgetById(widgetId);
    
    if (!Widget || !widgetDef) return null;

    return (
      <DashboardWidgetWrapper
        key={widgetId}
        id={widgetId}
        isEditMode={isEditMode}
        isLastInColumn={isLastInColumn}
      >
        <Widget />
      </DashboardWidgetWrapper>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

      {/* Widget Layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleWidgets} strategy={rectSortingStrategy}>
          {/* Leading full-width widgets */}
          {leadingFull.map((id) => renderWidget(id))}

          {/* Flexbox columns for regular widgets */}
          {columnWidgets.length > 0 && (
            <>
              {/* Mobile: 1 column */}
              <div className="flex flex-col gap-4 md:hidden">
                {columnWidgets.map((id, i) => renderWidget(id, i === columnWidgets.length - 1))}
              </div>
              {/* Tablet: 2 columns */}
              <div className="hidden md:flex lg:hidden gap-4">
                {Array.from({ length: 2 }, (_, colIdx) => {
                  const col = columnWidgets.filter((_, i) => i % 2 === colIdx);
                  return (
                    <div key={colIdx} className="flex-1 flex flex-col gap-4">
                      {col.map((id, i) => renderWidget(id, i === col.length - 1))}
                    </div>
                  );
                })}
              </div>
              {/* Desktop: 3 columns */}
              <div className="hidden lg:flex gap-4">
                {Array.from({ length: 3 }, (_, colIdx) => {
                  const col = columnWidgets.filter((_, i) => i % 3 === colIdx);
                  return (
                    <div key={colIdx} className="flex-1 flex flex-col gap-4">
                      {col.map((id, i) => renderWidget(id, i === col.length - 1))}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Trailing full-width widgets */}
          {trailingFull.map((id) => renderWidget(id))}
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
