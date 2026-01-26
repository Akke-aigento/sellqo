import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useTodayLiveFeed } from '@/hooks/useTodayLiveFeed';
import { 
  LiveFeedHeader, 
  LiveFeedList, 
  TodayStatsGrid 
} from '@/components/today-widget';
import { Separator } from '@/components/ui/separator';

export function TodayWidget() {
  const { feedItems, todayStats, isConnected, isLoading } = useTodayLiveFeed();

  return (
    <Card className="h-full">
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
            📊 Vandaag
          </p>
          <TodayStatsGrid stats={todayStats} />
        </div>
      </CardContent>
    </Card>
  );
}
