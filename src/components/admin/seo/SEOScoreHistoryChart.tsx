import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

interface HistoryEntry {
  id: string;
  overall_score: number | null;
  analyzed_at: string;
}

interface SEOScoreHistoryChartProps {
  history: HistoryEntry[];
  isLoading?: boolean;
}

export function SEOScoreHistoryChart({ history, isLoading }: SEOScoreHistoryChartProps) {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Sort and format data for chart
  const chartData = history
    .filter((h) => h.overall_score !== null)
    .sort((a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime())
    .map((entry) => ({
      date: format(parseISO(entry.analyzed_at), 'd MMM', { locale: dateLocale }),
      fullDate: format(parseISO(entry.analyzed_at), 'PPP', { locale: dateLocale }),
      score: entry.overall_score,
    }));

  // Calculate trend
  const firstScore = chartData[0]?.score ?? 0;
  const lastScore = chartData[chartData.length - 1]?.score ?? 0;
  const scoreDiff = lastScore - firstScore;

  const chartConfig = {
    score: {
      label: t('admin.seo.sEOScoreCard.seo_score'),
      color: 'hsl(var(--primary))',
    },
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('admin.seo.sEOScoreHistoryChart.score_trend')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              {t('admin.seo.sEOScoreHistoryChart.nog_geen_analyse_geschiedenis_beschikbaar')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('admin.seo.sEOScoreHistoryChart.start_een_seo_analyse_om_je')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('admin.seo.sEOScoreHistoryChart.score_trend')}
          </CardTitle>
          {chartData.length > 1 && (
            <div className="flex items-center gap-2">
              {scoreDiff > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">+{scoreDiff} punten</span>
                </>
              ) : scoreDiff < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-500">{scoreDiff} punten</span>
                </>
              ) : (
                <>
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{t('admin.seo.sEOScoreHistoryChart.geen_verandering')}</span>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fontSize: 12 }} 
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  labelFormatter={(_, payload) => {
                    const data = payload?.[0]?.payload;
                    return data?.fullDate || '';
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--color-score)"
              strokeWidth={2}
              dot={{ fill: 'var(--color-score)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
        
        {chartData.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{firstScore}</p>
                <p className="text-xs text-muted-foreground">{t('admin.seo.sEOScoreHistoryChart.eerste_meting')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{lastScore}</p>
                <p className="text-xs text-muted-foreground">{t('admin.seo.sEOScoreHistoryChart.huidige_score')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{chartData.length}</p>
                <p className="text-xs text-muted-foreground">{t('admin.seo.sEOScoreHistoryChart.analyses')}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
