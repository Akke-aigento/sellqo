import { Mail, Send, MousePointerClick, Users, TrendingUp, TrendingDown, UserMinus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedCounter } from './AnimatedCounter';
import type { MarketingStats } from '@/types/marketing';
import type { ContactStatus } from '@/hooks/useMarketingContacts';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface MarketingStatsCardsProps {
  stats: MarketingStats;
  /**
   * MAIL-UX-1: aantallen uit marketing_contact_counts — dezelfde bron als het tabblad Abonnees en
   * dezelfde regels als de verzending (uitgeschreven, bounce of klacht telt nooit als abonnee).
   */
  contacts?: Record<ContactStatus, number>;
  /** De RPC toont uitschrijvingen enkel aan beheerder, medewerker en marketing; anders geen tegel. */
  canSeeUnsubscribes: boolean;
  isLoading?: boolean;
}

interface StatCard {
  key: string;
  title: string;
  value: number;
  description: string;
  icon: typeof Send;
  isPercentage?: boolean;
  trend?: 'up' | 'down' | null;
  color: string;
  gradient: string;
  borderColor: string;
  iconColor: string;
  valueColor: string;
}

export function MarketingStatsCards({ stats, contacts, canSeeUnsubscribes, isLoading }: MarketingStatsCardsProps) {
  const { t, i18n } = useTranslation();
  const fmt = (n: number) => n.toLocaleString(i18n.language);
  const base = 'admin.marketing.marketingStatsCards';
  const cards: StatCard[] = [
    {
      key: 'sent',
      title: t('admin.marketing.contentHistoryList.verzonden'),
      value: stats.totalSent,
      description: t(`${base}.campaigns_count`, { value: fmt(stats.totalCampaigns) }),
      icon: Send,
      color: 'blue',
      gradient: 'from-blue-500/10 to-blue-600/5',
      borderColor: 'border-blue-200/50',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-700',
    },
    {
      key: 'open',
      title: t(`${base}.open_rate`),
      value: stats.avgOpenRate,
      isPercentage: true,
      description: t(`${base}.opened_count`, { value: fmt(stats.totalOpened) }),
      icon: Mail,
      trend: stats.avgOpenRate > 20 ? 'up' : stats.avgOpenRate < 15 ? 'down' : null,
      color: 'purple',
      gradient: 'from-purple-500/10 to-purple-600/5',
      borderColor: 'border-purple-200/50',
      iconColor: 'text-purple-600',
      valueColor: 'text-purple-700',
    },
    {
      key: 'click',
      title: t(`${base}.click_rate`),
      value: stats.avgClickRate,
      isPercentage: true,
      description: t(`${base}.clicked_count`, { value: fmt(stats.totalClicked) }),
      icon: MousePointerClick,
      trend: stats.avgClickRate > 5 ? 'up' : stats.avgClickRate < 2 ? 'down' : null,
      color: 'orange',
      gradient: 'from-orange-500/10 to-orange-600/5',
      borderColor: 'border-orange-200/50',
      iconColor: 'text-orange-600',
      valueColor: 'text-orange-700',
    },
    {
      key: 'subscribers',
      title: t(`${base}.subscribers`),
      value: contacts?.subscribed ?? 0,
      description: t(`${base}.subscribers_hint`),
      icon: Users,
      color: 'green',
      gradient: 'from-green-500/10 to-green-600/5',
      borderColor: 'border-green-200/50',
      iconColor: 'text-green-600',
      valueColor: 'text-green-700',
    },
    ...(canSeeUnsubscribes ? [{
      key: 'unsubscribes',
      title: t(`${base}.uitschrijvingen`),
      value: (contacts?.unsubscribed ?? 0) + (contacts?.bounced ?? 0) + (contacts?.complaint ?? 0),
      description: t(`${base}.unsubscribes_hint`),
      icon: UserMinus,
      color: 'red',
      gradient: 'from-red-500/10 to-red-600/5',
      borderColor: 'border-red-200/50',
      iconColor: 'text-red-600',
      valueColor: 'text-red-700',
    } satisfies StatCard] : []),
  ];
  // 2 kolommen op mobiel; op groot scherm alle tegels naast elkaar.
  // Oneven aantal: de laatste tegel op mobiel over de volle breedte, geen gat ernaast.
  const wide = (i: number) => (cards.length % 2 === 1 && i === cards.length - 1 ? 'col-span-2 lg:col-span-1' : undefined);
  const grid = cn('grid grid-cols-2 gap-3 sm:gap-4', cards.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4');

  if (isLoading) {
    return (
      <div className={grid}>
        {cards.map((card, i) => (
          <Card key={card.key} className={cn('bg-gradient-to-br from-muted/50 to-muted/20', wide(i))}>
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
    <div className={grid}>
      {cards.map((card, i) => {
        const Icon = card.icon;
        const TrendIcon = card.trend === 'up' ? TrendingUp : card.trend === 'down' ? TrendingDown : null;
        
        return (
          <Card 
            key={card.key}
            className={cn(
              "min-w-0 bg-gradient-to-br transition-all hover:shadow-md",
              wide(i),
              card.gradient,
              card.borderColor
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground truncate">
                {card.title}
              </CardTitle>
              <div className={cn(
                "h-8 w-8 shrink-0 rounded-full flex items-center justify-center",
                `bg-${card.color}-100`
              )}>
                <Icon className={cn("h-4 w-4", card.iconColor)} />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="flex items-center gap-2">
                {card.isPercentage ? (
                  <span className={cn("text-2xl font-bold tabular-nums", card.valueColor)}>
                    {card.value.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </span>
                ) : (
                  <AnimatedCounter
                    value={card.value}
                    locale={i18n.language}
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
