import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface GridToggleCellProps {
  value: boolean;
  isSelected: boolean;
  hasChange: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  onSelect: () => void;
}

export function GridToggleCell({
  value,
  isSelected,
  hasChange,
  disabled = false,
  onChange,
  onSelect,
}: GridToggleCellProps) {
  return (
    <div
      className={cn(
        'h-8 px-2 flex items-center justify-center cursor-pointer rounded-sm',
        isSelected && 'ring-2 ring-primary ring-offset-1',
        hasChange && 'bg-amber-100 dark:bg-amber-900/30'
      )}
      onClick={(e) => {
        // If clicking on the switch itself, don't trigger select
        if ((e.target as HTMLElement).closest('[role="switch"]')) {
          return;
        }
        onSelect();
      }}
    >
      <Switch
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
        className="data-[state=checked]:bg-primary"
      />
    </div>
  );
}
