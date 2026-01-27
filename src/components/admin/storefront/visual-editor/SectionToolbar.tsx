import { GripVertical, Settings, Eye, EyeOff, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SectionToolbarProps {
  sectionType: string;
  isVisible: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onToggleVisibility: () => void;
  onOpenSettings: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  dragHandleProps?: Record<string, unknown>;
  className?: string;
}

export function SectionToolbar({
  sectionType,
  isVisible,
  isFirst,
  isLast,
  onToggleVisibility,
  onOpenSettings,
  onDelete,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
  className,
}: SectionToolbarProps) {
  return (
    <div 
      className={cn(
        'absolute top-2 left-2 right-2 flex items-center justify-between',
        'bg-background/95 backdrop-blur-sm rounded-lg border shadow-lg px-3 py-2 z-20',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
        className
      )}
    >
      {/* Left side: drag handle + section type */}
      <div className="flex items-center gap-2">
        <button
          className="cursor-grab hover:text-primary p-1 rounded hover:bg-muted"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-medium capitalize">
          {sectionType.replace('_', ' ')}
        </span>
      </div>

      {/* Right side: actions */}
      <div className="flex items-center gap-1">
        {/* Move up/down */}
        {onMoveUp && !isFirst && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveUp}>
                <ChevronUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Omhoog</TooltipContent>
          </Tooltip>
        )}
        {onMoveDown && !isLast && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveDown}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Omlaag</TooltipContent>
          </Tooltip>
        )}

        {/* Visibility toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={onToggleVisibility}
            >
              {isVisible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isVisible ? 'Verbergen' : 'Tonen'}</TooltipContent>
        </Tooltip>

        {/* Settings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Instellingen</TooltipContent>
        </Tooltip>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Verwijderen</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
