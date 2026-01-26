import { useState } from 'react';
import { format, addWeeks, subWeeks, addMonths, subMonths, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Mail, Instagram, Facebook, Linkedin, Twitter, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContentCalendar, CalendarContentItem } from '@/hooks/useContentCalendar';
import { cn } from '@/lib/utils';

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-3 w-3" />,
  facebook: <Facebook className="h-3 w-3" />,
  linkedin: <Linkedin className="h-3 w-3" />,
  twitter: <Twitter className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
};

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  sent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function ContentItemCard({ item }: { item: CalendarContentItem }) {
  const icon = item.platform ? platformIcons[item.platform.toLowerCase()] : <Sparkles className="h-3 w-3" />;
  
  return (
    <div className="p-2 rounded-md bg-card border text-xs hover:shadow-md transition-shadow cursor-pointer group">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium truncate flex-1">{item.title}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{format(new Date(item.scheduled_at), 'HH:mm')}</span>
        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', statusColors[item.status])}>
          {item.status}
        </Badge>
      </div>
    </div>
  );
}

function DayColumn({ date, items }: { date: Date; items: CalendarContentItem[] }) {
  const dayItems = items.filter(item => isSameDay(new Date(item.scheduled_at), date));
  const isCurrentDay = isToday(date);
  
  return (
    <div className={cn(
      'flex-1 min-w-[120px] border-r last:border-r-0 p-2',
      isCurrentDay && 'bg-primary/5'
    )}>
      <div className={cn(
        'text-center mb-2 pb-2 border-b',
        isCurrentDay && 'font-bold'
      )}>
        <div className="text-xs text-muted-foreground uppercase">
          {format(date, 'EEE', { locale: nl })}
        </div>
        <div className={cn(
          'text-lg',
          isCurrentDay && 'text-primary'
        )}>
          {format(date, 'd')}
        </div>
      </div>
      <div className="space-y-2">
        {dayItems.map(item => (
          <ContentItemCard key={item.id} item={item} />
        ))}
        {dayItems.length === 0 && (
          <div className="h-16 flex items-center justify-center text-xs text-muted-foreground">
            Geen content
          </div>
        )}
      </div>
    </div>
  );
}

export function ContentCalendar() {
  const [view, setView] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { calendarItems, isLoading, dateRange } = useContentCalendar(view, currentDate);

  const navigatePrevious = () => {
    setCurrentDate(view === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  };

  const navigateNext = () => {
    setCurrentDate(view === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Content Agenda
            </CardTitle>
            <Tabs value={view} onValueChange={(v) => setView(v as 'week' | 'month')}>
              <TabsList className="h-8">
                <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-3">Maand</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Vandaag
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {view === 'week' 
                  ? `Week ${format(currentDate, 'w')} - ${format(currentDate, 'MMMM yyyy', { locale: nl })}`
                  : format(currentDate, 'MMMM yyyy', { locale: nl })
                }
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="flex overflow-x-auto border-t">
            {days.slice(0, view === 'week' ? 7 : 7).map(day => (
              <DayColumn key={day.toISOString()} date={day} items={calendarItems} />
            ))}
          </div>
        )}
        {!isLoading && calendarItems.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Geen geplande content voor deze periode</p>
            <p className="text-sm mt-1">Plan content in om je kalender te vullen</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
