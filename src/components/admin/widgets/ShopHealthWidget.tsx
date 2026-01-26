import { useShopHealth } from '@/hooks/useShopHealth';
import { Skeleton } from '@/components/ui/skeleton';
import {
  HealthPulseBanner,
  HealthCategoryCardCompact,
  HealthActionList,
  HealthAchievements,
  HealthTrendChart,
} from '@/components/shop-health';

export function ShopHealthWidget() {
  const {
    overallScore,
    overallStatus,
    emotionalMessage,
    dailyPulse,
    categories,
    actionItems,
    achievements,
    trends,
    todayStats,
    isLoading,
  } = useShopHealth();
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Main Pulse Banner */}
      <HealthPulseBanner
        score={overallScore}
        status={overallStatus}
        emotionalMessage={emotionalMessage}
        dailyPulse={dailyPulse}
        todayStats={todayStats}
      />
      
      {/* Category Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((category) => (
          <HealthCategoryCardCompact key={category.id} category={category} />
        ))}
      </div>
      
      {/* Bottom Section: Actions, Achievements, Trends */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Action Items - Takes more space */}
        <div className="lg:col-span-1">
          <HealthActionList actionItems={actionItems} />
        </div>
        
        {/* Achievements */}
        <div className="lg:col-span-1">
          <HealthAchievements achievements={achievements} />
        </div>
        
        {/* Trend Chart */}
        <div className="lg:col-span-1">
          <HealthTrendChart trends={trends} />
        </div>
      </div>
    </div>
  );
}
