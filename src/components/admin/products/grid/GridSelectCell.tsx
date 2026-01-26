import { useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface GridSelectCellProps {
  value: string | null;
  options: SelectOption[];
  isEditing: boolean;
  isSelected: boolean;
  hasChange: boolean;
  placeholder?: string;
  onStartEdit: () => void;
  onChange: (value: string | null) => void;
  onStopEdit: () => void;
}

export function GridSelectCell({
  value,
  options,
  isEditing,
  isSelected,
  hasChange,
  placeholder = 'Selecteer...',
  onStartEdit,
  onChange,
  onStopEdit,
}: GridSelectCellProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isEditing) {
      setOpen(true);
    }
  }, [isEditing]);

  const displayValue = options.find(o => o.value === value)?.label ?? '-';

  const handleValueChange = (newValue: string) => {
    onChange(newValue === '__none__' ? null : newValue);
    setOpen(false);
    onStopEdit();
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      onStopEdit();
    }
  };

  if (isEditing) {
    return (
      <Select
        value={value ?? '__none__'}
        onValueChange={handleValueChange}
        open={open}
        onOpenChange={handleOpenChange}
      >
        <SelectTrigger ref={triggerRef} className="h-8 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="z-50 bg-popover">
          <SelectItem value="__none__">
            <span className="text-muted-foreground">Geen</span>
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div
      className={cn(
        'h-8 px-2 flex items-center cursor-pointer rounded-sm text-sm truncate',
        isSelected && 'ring-2 ring-primary ring-offset-1',
        hasChange && 'bg-amber-100 dark:bg-amber-900/30'
      )}
      onClick={onStartEdit}
    >
      {value ? displayValue : <span className="text-muted-foreground">-</span>}
    </div>
  );
}
