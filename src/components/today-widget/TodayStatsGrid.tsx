import { TodayStatCard } from './TodayStatCard';
import { formatCurrency } from '@/lib/utils';
import type { TodayStats } from '@/hooks/useTodayLiveFeed';

interface TodayStatsGridProps {
  stats: TodayStats;
}

export function TodayStatsGrid({ stats }: TodayStatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <TodayStatCard
        icon="💰"
        label="Omzet"
        value={formatCurrency(stats.revenue)}
        change={stats.revenueChange}
        changeLabel="vs gisteren"
      />
      <TodayStatCard
        icon="📦"
        label="Bestellingen"
        value={stats.orderCount.toString()}
        change={stats.orderCountChange}
        changeLabel="vs gisteren"
        changeIsAbsolute
      />
      <TodayStatCard
        icon="👥"
        label="Nieuwe klanten"
        value={stats.newCustomers.toString()}
        change={stats.newCustomersChange}
        changeLabel="vs gisteren"
        changeIsAbsolute
      />
      <TodayStatCard
        icon="⭐"
        label="Reviews"
        value={stats.reviewCount.toString()}
        changeLabel="nieuw vandaag"
        hideChange
      />
    </div>
  );
}
