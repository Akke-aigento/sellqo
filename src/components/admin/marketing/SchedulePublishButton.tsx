import { useState } from 'react';
import { Calendar, Clock, Loader2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

interface SchedulePublishButtonProps {
  onSchedule: (scheduledAt: Date) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function SchedulePublishButton({ 
  onSchedule, 
  disabled,
  className 
}: SchedulePublishButtonProps) {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [time, setTime] = useState('09:00');
  const [isScheduling, setIsScheduling] = useState(false);

  const handleSchedule = async () => {
    if (!date) return;

    const [hours, minutes] = time.split(':').map(Number);
    const scheduledAt = setMinutes(setHours(date, hours), minutes);

    if (scheduledAt <= new Date()) {
      return; // Don't allow past dates
    }

    setIsScheduling(true);
    try {
      await onSchedule(scheduledAt);
      setOpen(false);
    } finally {
      setIsScheduling(false);
    }
  };

  const quickOptions = [
    { label: t('admin.marketing.schedulePublishButton.morgen_9_00'), date: setHours(setMinutes(addDays(new Date(), 1), 0), 9) },
    { label: t('admin.marketing.schedulePublishButton.morgen_12_00'), date: setHours(setMinutes(addDays(new Date(), 1), 0), 12) },
    { label: t('admin.marketing.schedulePublishButton.over_3_dagen'), date: setHours(setMinutes(addDays(new Date(), 3), 0), 10) },
    { label: t('admin.marketing.schedulePublishButton.volgende_week'), date: setHours(setMinutes(addDays(new Date(), 7), 0), 10) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={className} disabled={disabled}>
          <CalendarClock className="h-4 w-4 mr-2" />
          {t('admin.marketing.schedulePublishButton.inplannen')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('admin.marketing.schedulePublishButton.snel_inplannen')}</Label>
            <div className="flex flex-wrap gap-2">
              {quickOptions.map((option) => (
                <Button
                  key={option.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDate(option.date);
                    setTime(format(option.date, 'HH:mm'));
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-2 block">{t('admin.marketing.schedulePublishButton.of_kies_datum_en_tijd')}</Label>
            <CalendarComponent
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={dateLocale}
              disabled={(d) => d < new Date()}
              className="rounded-md border"
            />
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-32"
            />
          </div>

          {date && (
            <div className="p-2 rounded bg-muted text-sm">
              {t('admin.marketing.schedulePublishButton.gepland_voor')} <strong>{format(date, 'EEEE d MMMM yyyy', { locale: dateLocale })}</strong> {t('admin.marketing.schedulePublishButton.om')} <strong>{time}</strong>
            </div>
          )}

          <Button 
            onClick={handleSchedule} 
            className="w-full"
            disabled={!date || isScheduling}
          >
            {isScheduling ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            Publicatie inplannen
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
