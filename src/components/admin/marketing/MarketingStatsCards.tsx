import { Mail, Send, MousePointerClick, Users, TrendingUp, TrendingDown, Sparkles, UserMinus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedCounter } from './AnimatedCounter';
import type { MarketingStats } from '@/types/marketing';
import { cn } from '@/lib/utils';

interface MarketingStatsCardsProps {
  stats: MarketingStats;
  isLoading?: boolean;
}

export function MarketingStatsCards({ stats, isLoading }: MarketingStatsCardsProps) {
  const cards = [
    {
      title: 'Verzonden',
      value: stats.totalSent,
      description: `${stats.totalCampaigns} campagnes`,
      icon: Send,
      color: 'blue',
      gradient: 'from-blue-500/10 to-blue-600/5',
      borderColor: 'border-blue-200/50',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-700',
    },
    {
      title: 'Open Rate',
      value: stats.avgOpenRate,
      isPercentage: true,
      description: `${stats.totalOpened.toLocaleString('nl-NL')} geopend`,
      icon: Mail,
      trend: stats.avgOpenRate > 20 ? 'up' : stats.avgOpenRate < 15 ? 'down' : null,
      color: 'purple',
      gradient: 'from-purple-500/10 to-purple-600/5',
      borderColor: 'border-purple-200/50',
      iconColor: 'text-purple-600',
      valueColor: 'text-purple-700',
    },
    {
      title: 'Click Rate',
      value: stats.avgClickRate,
      isPercentage: true,
      description: `${stats.totalClicked.toLocaleString('nl-NL')} clicks`,
      icon: MousePointerClick,
      trend: stats.avgClickRate > 5 ? 'up' : stats.avgClickRate < 2 ? 'down' : null,
      color: 'orange',
      gradient: 'from-orange-500/10 to-orange-600/5',
      borderColor: 'border-orange-200/50',
      iconColor: 'text-orange-600',
      valueColor: 'text-orange-700',
    },
    {
      title: 'Subscribers',
      value: stats.subscriberCount,
      description: stats.subscriberGrowth > 0 
        ? `+${stats.subscriberGrowth} deze maand` 
        : 'actieve ontvangers',
      icon: Users,
      trend: stats.subscriberGrowth > 0 ? 'up' : null,
      color: 'green',
      gradient: 'from-green-500/10 to-green-600/5',
      borderColor: 'border-green-200/50',
      iconColor: 'text-green-600',
      valueColor: 'text-green-700',
    },
    {
      title: 'Uitschrijvingen',
      value: stats.unsubscribeCount,
      description: 'totaal',
      icon: UserMinus,
      color: 'red',
      gradient: 'from-red-500/10 to-red-600/5',
      borderColor: 'border-red-200/50',
      iconColor: 'text-red-600',
      valueColor: 'text-red-700',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="bg-gradient-to-br from-muted/50 to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const TrendIcon = card.trend === 'up' ? TrendingUp : card.trend === 'down' ? TrendingDown : null;
        
        return (
          <Card 
            key={card.title} 
            className={cn(
              "bg-gradient-to-br transition-all hover:shadow-md hover:scale-[1.02]",
              card.gradient,
              card.borderColor
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center",
                `bg-${card.color}-100`
              )}>
                <Icon className={cn("h-4 w-4", card.iconColor)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {card.isPercentage ? (
                  <span className={cn("text-2xl font-bold tabular-nums", card.valueColor)}>
                    {card.value.toFixed(1)}%
                  </span>
                ) : (
                  <AnimatedCounter 
                    value={card.value} 
                    className={cn("text-2xl font-bold", card.valueColor)} 
                  />
                )}
                {TrendIcon && (
                  <TrendIcon className={cn(
                    "h-4 w-4",
                    card.trend === 'up' ? 'text-green-500' : 'text-red-500'
                  )} />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
