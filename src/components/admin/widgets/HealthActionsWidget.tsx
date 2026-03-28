import { useShopHealth } from '@/hooks/useShopHealth';
import { Skeleton } from '@/components/ui/skeleton';
import { HealthActionList } from '@/components/shop-health';

export function HealthActionsWidget() {
  const { actionItems, isLoading } = useShopHealth();
  
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }
  
  return <HealthActionList actionItems={actionItems} />;
}
