import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useTodayLiveFeed } from '@/hooks/useTodayLiveFeed';
import { 
  LiveFeedHeader, 
  LiveFeedList, 
  TodayStatsGrid 
} from '@/components/today-widget';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';

export function TodayWidget() {
  const { t } = useTranslation();
  const { feedItems, todayStats, isConnected, isLoading } = useTodayLiveFeed();

  return (
    <Card>
      <CardHeader className="pb-3">
        <LiveFeedHeader isConnected={isConnected} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live Feed */}
        <div className="max-h-[280px] overflow-y-auto scrollbar-thin">
          <LiveFeedList items={feedItems} isLoading={isLoading} />
        </div>

        <Separator />

        {/* Today Stats */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
            {t('admin.widgets.todayWidget.vandaag')}
          </p>
          <TodayStatsGrid stats={todayStats} />
        </div>
      </CardContent>
    </Card>
  );
}
