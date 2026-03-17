import { Component, ReactNode, ErrorInfo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

// Error Boundary class component
class WidgetErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[WidgetErrorBoundary] Widget crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium">Widget kon niet geladen worden</p>
              <p className="text-xs text-muted-foreground">Probeer de pagina te vernieuwen</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

interface DashboardWidgetWrapperProps {
  id: string;
  children: ReactNode;
  isEditMode?: boolean;
  isLastInColumn?: boolean;
}

export function DashboardWidgetWrapper({
  id,
  children,
  isEditMode = false,
  isLastInColumn = false,
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
        isDragging && 'z-50 opacity-75',
        isEditMode && 'relative',
        isLastInColumn && 'flex-grow [&>div]:h-full [&>div>*]:h-full'
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
        <WidgetErrorBoundary>
          {children}
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
