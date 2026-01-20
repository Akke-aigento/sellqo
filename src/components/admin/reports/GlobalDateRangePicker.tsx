import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subQuarters, subYears } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface DateRange {
  from: Date;
  to: Date;
}

interface GlobalDateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

type PresetKey = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom';

const presets: { key: PresetKey; label: string; getRange: () => DateRange }[] = [
  {
    key: 'this_month',
    label: 'Deze maand',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    key: 'last_month',
    label: 'Vorige maand',
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    key: 'this_quarter',
    label: 'Dit kwartaal',
    getRange: () => ({
      from: startOfQuarter(new Date()),
      to: endOfQuarter(new Date()),
    }),
  },
  {
    key: 'last_quarter',
    label: 'Vorig kwartaal',
    getRange: () => ({
      from: startOfQuarter(subQuarters(new Date(), 1)),
      to: endOfQuarter(subQuarters(new Date(), 1)),
    }),
  },
  {
    key: 'this_year',
    label: 'Dit jaar',
    getRange: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
  {
    key: 'last_year',
    label: 'Vorig jaar',
    getRange: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: endOfYear(subYears(new Date(), 1)),
    }),
  },
];

export const GlobalDateRangePicker = ({ dateRange, onDateRangeChange }: GlobalDateRangePickerProps) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('this_month');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handlePresetSelect = (preset: typeof presets[0]) => {
    setSelectedPreset(preset.key);
    onDateRangeChange(preset.getRange());
  };

  const handleCustomDateChange = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setSelectedPreset('custom');
      onDateRangeChange({ from: range.from, to: range.to });
      setIsCalendarOpen(false);
    }
  };

  const currentPresetLabel = selectedPreset === 'custom' 
    ? 'Aangepaste periode'
    : presets.find(p => p.key === selectedPreset)?.label || 'Selecteer periode';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Quick presets dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[160px] justify-between">
            {currentPresetLabel}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.key}
              onClick={() => handlePresetSelect(preset)}
              className={cn(selectedPreset === preset.key && 'bg-accent')}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsCalendarOpen(true)}
            className={cn(selectedPreset === 'custom' && 'bg-accent')}
          >
            Aangepaste periode...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Date range display / custom picker */}
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'min-w-[280px] justify-start text-left font-normal',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'd MMM yyyy', { locale: nl })} -{' '}
                  {format(dateRange.to, 'd MMM yyyy', { locale: nl })}
                </>
              ) : (
                format(dateRange.from, 'd MMM yyyy', { locale: nl })
              )
            ) : (
              <span>Selecteer periode</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={{ from: dateRange?.from, to: dateRange?.to }}
            onSelect={handleCustomDateChange}
            numberOfMonths={2}
            locale={nl}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
