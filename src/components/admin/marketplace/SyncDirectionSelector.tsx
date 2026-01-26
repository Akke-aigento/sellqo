import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowDown, ArrowUp, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyncDirection, SupportedDirections } from '@/types/syncRules';

interface SyncDirectionSelectorProps {
  value: SyncDirection;
  onChange: (direction: SyncDirection) => void;
  capabilities: SupportedDirections | null;
  disabled?: boolean;
}

export function SyncDirectionSelector({
  value,
  onChange,
  capabilities,
  disabled = false,
}: SyncDirectionSelectorProps) {
  if (!capabilities) return null;

  const directions: { value: SyncDirection; label: string; icon: typeof ArrowDown; description: string }[] = [
    { 
      value: 'import', 
      label: 'Import', 
      icon: ArrowDown,
      description: 'Van platform naar SellQo',
    },
    { 
      value: 'bidirectional', 
      label: 'Beide', 
      icon: ArrowLeftRight,
      description: 'Tweerichtingsverkeer',
    },
    { 
      value: 'export', 
      label: 'Export', 
      icon: ArrowUp,
      description: 'Van SellQo naar platform',
    },
  ];

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Richting</Label>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as SyncDirection)}
        disabled={disabled}
        className="flex gap-2"
      >
        {directions.map((direction) => {
          const isSupported = capabilities[direction.value];
          const Icon = direction.icon;
          
          return (
            <div key={direction.value} className="flex-1">
              <RadioGroupItem
                value={direction.value}
                id={`direction-${direction.value}`}
                disabled={disabled || !isSupported}
                className="sr-only"
              />
              <Label
                htmlFor={`direction-${direction.value}`}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all",
                  value === direction.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                  (disabled || !isSupported) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5",
                  value === direction.value ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  value === direction.value ? "text-primary" : "text-foreground"
                )}>
                  {direction.label}
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  {direction.description}
                </span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
