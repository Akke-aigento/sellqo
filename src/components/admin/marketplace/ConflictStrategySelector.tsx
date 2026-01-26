import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Swords, Clock, Server, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConflictStrategy } from '@/types/syncRules';

interface ConflictStrategySelectorProps {
  value?: ConflictStrategy;
  onChange: (strategy: ConflictStrategy) => void;
  disabled?: boolean;
  platformName: string;
}

const STRATEGIES: Array<{
  value: ConflictStrategy;
  label: string;
  description: string;
  icon: typeof Swords;
}> = [
  {
    value: 'newest_wins',
    label: 'Meest recente wint',
    description: 'De laatst gewijzigde versie wordt behouden',
    icon: Clock,
  },
  {
    value: 'sellqo_wins',
    label: 'SellQo wint altijd',
    description: 'SellQo data heeft altijd voorrang',
    icon: Server,
  },
  {
    value: 'platform_wins',
    label: 'Platform wint altijd',
    description: 'Externe platform data heeft voorrang',
    icon: Server,
  },
  {
    value: 'manual',
    label: 'Handmatig beoordelen',
    description: 'Conflicten worden ter review gemarkeerd',
    icon: User,
  },
];

export function ConflictStrategySelector({
  value,
  onChange,
  disabled,
  platformName,
}: ConflictStrategySelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Swords className="w-4 h-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Conflict Strategie</Label>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Bij bidirectionele sync kan er conflict ontstaan wanneer dezelfde data in 
        zowel SellQo als {platformName} is gewijzigd.
      </p>

      <RadioGroup
        value={value || 'newest_wins'}
        onValueChange={(v) => onChange(v as ConflictStrategy)}
        disabled={disabled}
        className="grid gap-2"
      >
        {STRATEGIES.map((strategy) => {
          const Icon = strategy.icon;
          const isSelected = value === strategy.value || (!value && strategy.value === 'newest_wins');
          
          return (
            <label
              key={strategy.value}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <RadioGroupItem value={strategy.value} id={strategy.value} />
              <Icon className={cn(
                "w-4 h-4",
                isSelected ? "text-primary" : "text-muted-foreground"
              )} />
              <div className="flex-1">
                <div className="text-sm font-medium">{strategy.label}</div>
                <div className="text-xs text-muted-foreground">
                  {strategy.description}
                </div>
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
