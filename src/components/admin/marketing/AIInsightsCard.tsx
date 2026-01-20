import { useState } from 'react';
import { Lightbulb, RefreshCw, TrendingUp, AlertTriangle, Users, Package, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIMarketing } from '@/hooks/useAIMarketing';
import { cn } from '@/lib/utils';

interface AIInsight {
  icon: any;
  color: string;
  title: string;
  description: string;
  action: string;
  type: string;
}

interface AIInsightsCardProps {
  onInsightClick?: (insight: AIInsight) => void;
}

export function AIInsightsCard({ onInsightClick }: AIInsightsCardProps) {
  const { context, contextLoading, refetchContext } = useAIMarketing();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchContext();
    setIsRefreshing(false);
  };

  const handleInsightClick = (insight: AIInsight) => {
    if (onInsightClick) {
      onInsightClick(insight);
    }
  };

  if (contextLoading) {
    return (
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Inzichten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Geen data beschikbaar</p>
        </CardContent>
      </Card>
    );
  }

  const insights: AIInsight[] = [];

  // Low stock insight
  if (context.insights.lowStockAlert) {
    insights.push({
      icon: AlertTriangle,
      color: 'text-amber-500 bg-amber-500/10',
      title: 'Lage voorraad alert',
      description: `${context.products.lowStock.length} producten zijn bijna uitverkocht. Overweeg een "Laatste Kans" campagne!`,
      action: 'Campagne starten',
      type: 'low_stock',
    });
  }

  // Win-back opportunity
  if (context.insights.winBackOpportunity > 10) {
    insights.push({
      icon: Users,
      color: 'text-blue-500 bg-blue-500/10',
      title: 'Win-back mogelijkheid',
      description: `${context.insights.winBackOpportunity} klanten zijn niet geabonneerd. Een win-back campagne kan hen terughalen.`,
      action: 'Win-back starten',
      type: 'win_back',
    });
  }

  // Seasonal opportunity
  if (context.seasonality.upcomingHolidays.length > 0) {
    const holiday = context.seasonality.upcomingHolidays[0];
    insights.push({
      icon: TrendingUp,
      color: 'text-green-500 bg-green-500/10',
      title: `${holiday.name} nadert`,
      description: `Nog ${holiday.daysUntil} dagen tot ${holiday.name}. Perfect moment voor een seizoenscampagne!`,
      action: 'Campagne plannen',
      type: 'seasonal',
    });
  }

  // New arrivals
  if (context.products.newArrivals.length > 0) {
    insights.push({
      icon: Package,
      color: 'text-purple-500 bg-purple-500/10',
      title: 'Nieuwe producten',
      description: `${context.products.newArrivals.length} nieuwe producten wachten om gepromoot te worden.`,
      action: 'Aankondigen',
      type: 'new_product',
    });
  }

  // High engagement segment
  if (context.insights.highEngagementSegment) {
    insights.push({
      icon: Lightbulb,
      color: 'text-yellow-500 bg-yellow-500/10',
      title: 'Actief segment',
      description: `Je "${context.insights.highEngagementSegment}" segment is zeer actief. Perfect voor een exclusieve aanbieding!`,
      action: 'Exclusieve deal',
      type: 'promotion',
    });
  }

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
            <Lightbulb className="h-4 w-4 text-white" />
          </div>
          AI Inzichten van Vandaag
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Geen specifieke inzichten op dit moment.</p>
            <p className="text-xs">Voeg meer data toe voor betere suggesties.</p>
          </div>
        ) : (
          insights.slice(0, 3).map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg bg-card border hover:border-purple-500/30 hover:bg-primary/5 transition-colors cursor-pointer group"
              onClick={() => handleInsightClick(insight)}
            >
              <div className={cn('p-2 rounded-lg transition-colors', insight.color)}>
                <insight.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{insight.title}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {insight.description}
                </p>
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 cursor-pointer hover:bg-purple-500/20 group-hover:bg-purple-500/20 transition-colors"
              >
                {insight.action}
              </Badge>
            </div>
          ))
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <p className="text-lg font-bold">{context.customers.subscribers}</p>
            <p className="text-xs text-muted-foreground">Abonnees</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{context.campaigns.avgOpenRate}%</p>
            <p className="text-xs text-muted-foreground">Gem. open rate</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">€{context.orders.avgOrderValue}</p>
            <p className="text-xs text-muted-foreground">Gem. order</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
