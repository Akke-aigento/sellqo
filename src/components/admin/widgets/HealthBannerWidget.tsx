import { useShopHealth } from '@/hooks/useShopHealth';
import { Skeleton } from '@/components/ui/skeleton';
import { HealthPulseBanner } from '@/components/shop-health';

export function HealthBannerWidget() {
  const {
    overallScore,
    overallStatus,
    emotionalMessage,
    dailyPulse,
    todayStats,
    isLoading,
  } = useShopHealth();
  
  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }
  
  return (
    <HealthPulseBanner
      score={overallScore}
      status={overallStatus}
      emotionalMessage={emotionalMessage}
      dailyPulse={dailyPulse}
      todayStats={todayStats}
    />
  );
}
