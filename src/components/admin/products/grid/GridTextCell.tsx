import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface GridTextCellProps {
  value: string;
  isEditing: boolean;
  isSelected: boolean;
  hasChange: boolean;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onStopEdit: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export function GridTextCell({
  value,
  isEditing,
  isSelected,
  hasChange,
  onStartEdit,
  onChange,
  onStopEdit,
  onNavigate,
}: GridTextCellProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        onChange(localValue);
        onNavigate('down');
        break;
      case 'Tab':
        e.preventDefault();
        onChange(localValue);
        onNavigate(e.shiftKey ? 'left' : 'right');
        break;
      case 'Escape':
        e.preventDefault();
        setLocalValue(value);
        onStopEdit();
        break;
      case 'ArrowUp':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onChange(localValue);
          onNavigate('up');
        }
        break;
      case 'ArrowDown':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onChange(localValue);
          onNavigate('down');
        }
        break;
    }
  };

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
    onStopEdit();
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-8 text-sm"
      />
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
      {value || <span className="text-muted-foreground">-</span>}
    </div>
  );
}
