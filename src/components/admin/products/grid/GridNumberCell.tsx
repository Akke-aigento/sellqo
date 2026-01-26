import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface GridNumberCellProps {
  value: number | null;
  isEditing: boolean;
  isSelected: boolean;
  hasChange: boolean;
  isCurrency?: boolean;
  currency?: string;
  decimals?: number;
  onStartEdit: () => void;
  onChange: (value: number | null) => void;
  onStopEdit: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export function GridNumberCell({
  value,
  isEditing,
  isSelected,
  hasChange,
  isCurrency = false,
  currency = 'EUR',
  decimals = isCurrency ? 2 : 0,
  onStartEdit,
  onChange,
  onStopEdit,
  onNavigate,
}: GridNumberCellProps) {
  const [localValue, setLocalValue] = useState(value?.toString() ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value?.toString() ?? '');
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const formatDisplay = (val: number | null) => {
    if (val === null || val === undefined) return '-';
    
    if (isCurrency) {
      return new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency,
      }).format(val);
    }
    
    return new Intl.NumberFormat('nl-NL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(val);
  };

  const parseValue = (input: string): number | null => {
    if (!input.trim()) return null;
    
    // Replace comma with dot for parsing
    const normalized = input.replace(',', '.');
    const parsed = parseFloat(normalized);
    
    if (isNaN(parsed)) return null;
    return parsed;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        onChange(parseValue(localValue));
        onNavigate('down');
        break;
      case 'Tab':
        e.preventDefault();
        onChange(parseValue(localValue));
        onNavigate(e.shiftKey ? 'left' : 'right');
        break;
      case 'Escape':
        e.preventDefault();
        setLocalValue(value?.toString() ?? '');
        onStopEdit();
        break;
      case 'ArrowUp':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onChange(parseValue(localValue));
          onNavigate('up');
        }
        break;
      case 'ArrowDown':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onChange(parseValue(localValue));
          onNavigate('down');
        }
        break;
    }
  };

  const handleBlur = () => {
    const parsed = parseValue(localValue);
    if (parsed !== value) {
      onChange(parsed);
    }
    onStopEdit();
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-8 text-sm text-right"
      />
    );
  }

  return (
    <div
      className={cn(
        'h-8 px-2 flex items-center justify-end cursor-pointer rounded-sm text-sm font-mono',
        isSelected && 'ring-2 ring-primary ring-offset-1',
        hasChange && 'bg-amber-100 dark:bg-amber-900/30'
      )}
      onClick={onStartEdit}
    >
      {formatDisplay(value)}
    </div>
  );
}
