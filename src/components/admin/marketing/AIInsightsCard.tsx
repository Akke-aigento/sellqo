import { useState } from 'react';
import { Lightbulb, RefreshCw, TrendingUp, AlertTriangle, Users, Package, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIMarketing } from '@/hooks/useAIMarketing';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
            {t('admin.marketing.aIInsightsCard.ai_inzichten')}
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
          <p className="text-muted-foreground">{t('admin.marketing.aIInsightsCard.geen_data_beschikbaar')}</p>
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
      title: t('admin.marketing.aIInsightsCard.lage_voorraad_alert'),
      description: t('admin.marketing.aiInsightsCard.bijna_uitverkocht', { count: context.products.lowStock.length }),
      action: 'Campagne starten',
      type: 'low_stock',
    });
  }

  // Win-back opportunity
  if (context.insights.winBackOpportunity > 10) {
    insights.push({
      icon: Users,
      color: 'text-blue-500 bg-blue-500/10',
      title: t('admin.marketing.aIInsightsCard.win_back_mogelijkheid'),
      description: t('admin.marketing.aiInsightsCard.win_back', { count: context.insights.winBackOpportunity }),
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
      description: t('admin.marketing.aiInsightsCard.feestdag_nadert', { days: holiday.daysUntil, holiday: holiday.name }),
      action: 'Campagne plannen',
      type: 'seasonal',
    });
  }

  // New arrivals
  if (context.products.newArrivals.length > 0) {
    insights.push({
      icon: Package,
      color: 'text-purple-500 bg-purple-500/10',
      title: t('admin.marketing.aIInsightsCard.nieuwe_producten'),
      description: t('admin.marketing.aiInsightsCard.nieuwe_producten', { count: context.products.newArrivals.length }),
      action: 'Aankondigen',
      type: 'new_product',
    });
  }

  // High engagement segment
  if (context.insights.highEngagementSegment) {
    insights.push({
      icon: Lightbulb,
      color: 'text-yellow-500 bg-yellow-500/10',
      title: t('admin.marketing.aIInsightsCard.actief_segment'),
      description: t('admin.marketing.aiInsightsCard.actief_segment', { segment: context.insights.highEngagementSegment }),
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
          {t('admin.marketing.aIInsightsCard.ai_inzichten_van_vandaag')}
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
            <p>{t('admin.marketing.aIInsightsCard.geen_specifieke_inzichten_op_dit_moment')}</p>
            <p className="text-xs">{t('admin.marketing.aIInsightsCard.voeg_meer_data_toe_voor_betere')}</p>
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
            <p className="text-xs text-muted-foreground">{t('admin.marketing.aIInsightsCard.abonnees')}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{context.campaigns.avgOpenRate}%</p>
            <p className="text-xs text-muted-foreground">{t('admin.marketing.aIInsightsCard.gem_open_rate')}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">€{context.orders.avgOrderValue}</p>
            <p className="text-xs text-muted-foreground">{t('admin.marketing.aIInsightsCard.gem_order')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
