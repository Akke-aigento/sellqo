import { GripVertical, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageBlockToolbarProps {
  dragListeners?: Record<string, unknown>;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function PageBlockToolbar({
  dragListeners,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: PageBlockToolbarProps) {
  return (
    <div className={cn(
      'absolute -left-12 top-0 bottom-0 flex flex-col items-center justify-center gap-1',
      'opacity-0 group-hover:opacity-100 transition-opacity'
    )}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 cursor-grab active:cursor-grabbing"
        {...dragListeners}
      >
        <GripVertical className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onMoveUp}
        disabled={!canMoveUp}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onMoveDown}
        disabled={!canMoveDown}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
