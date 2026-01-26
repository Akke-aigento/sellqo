import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';
import type { SyncFrequency } from '@/types/syncRules';

interface SyncFrequencySelectorProps {
  value?: SyncFrequency;
  onChange: (frequency: SyncFrequency) => void;
  disabled?: boolean;
}

const FREQUENCIES: Array<{
  value: SyncFrequency;
  label: string;
  description: string;
}> = [
  { value: '5min', label: 'Elke 5 minuten', description: 'Kritieke data' },
  { value: '15min', label: 'Elke 15 minuten', description: 'Standaard' },
  { value: '30min', label: 'Elke 30 minuten', description: 'Minder urgent' },
  { value: '1hour', label: 'Elk uur', description: '' },
  { value: '4hour', label: 'Elke 4 uur', description: '' },
  { value: 'daily', label: 'Dagelijks', description: 'Weinig veranderingen' },
  { value: 'weekly', label: 'Wekelijks', description: 'Stabiele data' },
];

export function SyncFrequencySelector({
  value,
  onChange,
  disabled,
}: SyncFrequencySelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Sync Frequentie</Label>
      </div>
      
      <Select
        value={value || '15min'}
        onValueChange={(v) => onChange(v as SyncFrequency)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecteer frequentie" />
        </SelectTrigger>
        <SelectContent className="bg-background border shadow-lg z-50">
          {FREQUENCIES.map((freq) => (
            <SelectItem key={freq.value} value={freq.value}>
              <div className="flex items-center justify-between gap-4">
                <span>{freq.label}</span>
                {freq.description && (
                  <span className="text-xs text-muted-foreground">
                    {freq.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
