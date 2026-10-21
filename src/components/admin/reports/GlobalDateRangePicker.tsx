import { useState } from 'react';
import { format, isSameDay } from 'date-fns';
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
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import {
  getReportPresetRange,
  REPORT_PRESET_KEYS,
  type ReportDateRange,
  type ReportPresetKey,
} from '@/lib/reportDateRanges';

export type DateRange = ReportDateRange;

interface GlobalDateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

type PresetKey = ReportPresetKey | 'custom';

// NIGHT-QF-3: berekening zit in src/lib/reportDateRanges.ts (met unit tests).
const presets: { key: ReportPresetKey; labelKey: string; getRange: () => DateRange }[] =
  REPORT_PRESET_KEYS.map((key) => ({
    key,
    labelKey: `admin.reports.globalDateRangePicker.presets.${key}`,
    getRange: () => getReportPresetRange(key),
  }));

export const GlobalDateRangePicker = ({ dateRange, onDateRangeChange }: GlobalDateRangePickerProps) => {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Label altijd afleiden uit de echte periode: de pagina kan de range ook zelf
  // zetten (standaard dit kwartaal, snelknoppen). Een losse state toonde dan
  // "Deze maand" bij 1 okt – 31 dec.
  const selectedPreset: PresetKey = (() => {
    if (!dateRange?.from || !dateRange?.to) return 'custom';
    const match = presets.find((p) => {
      const r = p.getRange();
      return isSameDay(r.from, dateRange.from) && isSameDay(r.to, dateRange.to);
    });
    return match?.key ?? 'custom';
  })();

  const handlePresetSelect = (preset: typeof presets[0]) => {
    onDateRangeChange(preset.getRange());
  };

  const handleCustomDateChange = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      onDateRangeChange({ from: range.from, to: range.to, type: 'custom' });
      setIsCalendarOpen(false);
    }
  };

  const currentPresetLabel = selectedPreset === 'custom'
    ? t('admin.reports.globalDateRangePicker.aangepaste_periode')
    : (() => { const pr = presets.find((x) => x.key === selectedPreset); return pr ? t(pr.labelKey) : t('admin.reports.globalDateRangePicker.selecteer_periode'); })();

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
              {t(preset.labelKey)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsCalendarOpen(true)}
            className={cn(selectedPreset === 'custom' && 'bg-accent')}
          >
            {t('admin.reports.globalDateRangePicker.aangepaste_periode')}
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
                  {format(dateRange.from, 'd MMM yyyy', { locale: dateLocale })} -{' '}
                  {format(dateRange.to, 'd MMM yyyy', { locale: dateLocale })}
                </>
              ) : (
                format(dateRange.from, 'd MMM yyyy', { locale: dateLocale })
              )
            ) : (
              <span>{t('admin.reports.globalDateRangePicker.selecteer_periode')}</span>
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
            locale={dateLocale}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
