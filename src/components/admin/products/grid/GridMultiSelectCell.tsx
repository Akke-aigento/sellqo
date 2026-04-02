import { useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface GridMultiSelectCellProps {
  value: string[];
  options: SelectOption[];
  isEditing: boolean;
  isSelected: boolean;
  hasChange: boolean;
  placeholder?: string;
  onStartEdit: () => void;
  onChange: (value: string[]) => void;
  onStopEdit: () => void;
}

export function GridMultiSelectCell({
  value,
  options,
  isEditing,
  isSelected,
  hasChange,
  placeholder = 'Selecteer...',
  onStartEdit,
  onChange,
  onStopEdit,
}: GridMultiSelectCellProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setOpen(true);
    }
  }, [isEditing]);

  const selectedLabels = value
    .map(v => options.find(o => o.value === v)?.label)
    .filter(Boolean);

  const handleToggle = (optionValue: string, checked: boolean) => {
    const newValue = checked
      ? [...value, optionValue]
      : value.filter(v => v !== optionValue);
    onChange(newValue);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      onStopEdit();
    }
  };

  const displayText = selectedLabels.length > 0
    ? selectedLabels.length <= 2
      ? selectedLabels.join(', ')
      : `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`
    : null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'h-8 px-2 flex items-center cursor-pointer rounded-sm text-sm truncate',
            isSelected && 'ring-2 ring-primary ring-offset-1',
            hasChange && 'bg-amber-100 dark:bg-amber-900/30'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
        >
          {displayText ? (
            <span className="truncate">{displayText}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 max-h-64 overflow-y-auto z-50" align="start">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer text-sm"
          >
            <Checkbox
              checked={value.includes(option.value)}
              onCheckedChange={(checked) => handleToggle(option.value, !!checked)}
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
        {options.length === 0 && (
          <div className="text-sm text-muted-foreground px-2 py-1.5">Geen opties</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
