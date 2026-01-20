import { 
  BarChart3, Eye, MousePointer, Heart, Share2,
  TrendingUp, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useContentAnalytics, useContentTrends } from '@/hooks/useContentAnalytics';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function ContentEngagementStats() {
  const { stats, isLoading } = useContentAnalytics();
  const { data: trends = [] } = useContentTrends(30);

  // Transform data for chart
  const chartData = trends.slice(-10).map((trend) => ({
    date: format(new Date(trend.date), 'dd MMM', { locale: nl }),
    generated: trend.count,
    used: trend.used,
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Engagement Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    {
      label: 'Totaal Content',
      value: stats.totalContent.toLocaleString(),
      icon: Eye,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      change: 12.5,
    },
    {
      label: 'Gebruikt',
      value: stats.usedContent.toLocaleString(),
      icon: MousePointer,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      change: 8.3,
    },
    {
      label: 'Gepubliceerd',
      value: stats.publishedContent.toLocaleString(),
      icon: Share2,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      change: -2.1,
    },
    {
      label: 'Gem. Engagement',
      value: `${stats.avgEngagementRate.toFixed(1)}%`,
      icon: Heart,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
      change: 5.7,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          Content Engagement Analytics
        </CardTitle>
        <CardDescription>
          Performance van je AI-gegenereerde content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-lg border bg-card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <stat.icon className={cn('h-4 w-4', stat.color)} />
                </div>
                <div className={cn(
                  'flex items-center text-xs font-medium',
                  stat.change >= 0 ? 'text-green-500' : 'text-red-500'
                )}>
                  {stat.change >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(stat.change)}%
                </div>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGenerated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUsed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="generated"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorGenerated)"
                  name="Gegenereerd"
                />
                <Area
                  type="monotone"
                  dataKey="used"
                  stroke="hsl(142, 76%, 36%)"
                  fillOpacity={1}
                  fill="url(#colorUsed)"
                  name="Gebruikt"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nog geen engagement data</p>
              <p className="text-sm">Publiceer content om statistieken te zien</p>
            </div>
          </div>
        )}

        {/* Top Performing Content */}
        {stats.topPerformingContent.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Best presterende content
            </h4>
            <div className="space-y-2">
              {stats.topPerformingContent.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {item.title || 'Geen titel'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {item.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="h-3 w-3" />
                        {item.shares}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {item.content_type}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
