import { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { widgetSizeClasses, type WidgetSize } from '@/config/dashboardWidgets';

interface DashboardWidgetWrapperProps {
  id: string;
  size?: WidgetSize;
  children: ReactNode;
  isEditMode?: boolean;
}

export function DashboardWidgetWrapper({
  id,
  size = 'md',
  children,
  isEditMode = false,
}: DashboardWidgetWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        widgetSizeClasses[size],
        isDragging && 'z-50 opacity-75',
        isEditMode && 'relative'
      )}
    >
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-2 -left-2 z-10 p-1.5 bg-primary text-primary-foreground rounded-md cursor-grab active:cursor-grabbing shadow-md"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          isEditMode && 'ring-2 ring-primary/20 ring-offset-2 rounded-lg'
        )}
      >
        {children}
      </div>
    </div>
  );
}
