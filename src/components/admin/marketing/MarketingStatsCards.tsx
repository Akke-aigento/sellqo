import { Mail, Send, MousePointerClick, Users, TrendingUp, UserMinus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MarketingStats } from '@/types/marketing';

interface MarketingStatsCardsProps {
  stats: MarketingStats;
  isLoading?: boolean;
}

export function MarketingStatsCards({ stats, isLoading }: MarketingStatsCardsProps) {
  const cards = [
    {
      title: 'Verzonden',
      value: stats.totalSent.toLocaleString('nl-NL'),
      description: `${stats.totalCampaigns} campagnes`,
      icon: Send,
    },
    {
      title: 'Open Rate',
      value: `${stats.avgOpenRate.toFixed(1)}%`,
      description: `${stats.totalOpened.toLocaleString('nl-NL')} geopend`,
      icon: Mail,
    },
    {
      title: 'Click Rate',
      value: `${stats.avgClickRate.toFixed(1)}%`,
      description: `${stats.totalClicked.toLocaleString('nl-NL')} clicks`,
      icon: MousePointerClick,
    },
    {
      title: 'Subscribers',
      value: stats.subscriberCount.toLocaleString('nl-NL'),
      description: stats.subscriberGrowth > 0 
        ? `+${stats.subscriberGrowth} deze maand` 
        : 'actieve ontvangers',
      icon: Users,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 animate-pulse bg-muted rounded" />
              <div className="h-4 w-4 animate-pulse bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 animate-pulse bg-muted rounded mb-1" />
              <div className="h-3 w-32 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
