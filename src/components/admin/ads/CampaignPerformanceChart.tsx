import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { subDays, format, eachDayOfInterval } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { AdCampaign } from '@/types/ads';

interface CampaignPerformanceChartProps {
  campaign: AdCampaign;
}

type MetricKey = 'impressions' | 'clicks' | 'spend' | 'conversions';

const METRICS: Record<MetricKey, { label: string; color: string; format: (v: number) => string }> = {
  impressions: { label: 'Bereik', color: 'hsl(var(--primary))', format: (v) => v.toLocaleString() },
  clicks: { label: 'Clicks', color: 'hsl(var(--chart-2, 200 80% 50%))', format: (v) => v.toLocaleString() },
  spend: { label: 'Uitgaven', color: 'hsl(var(--chart-3, 30 80% 55%))', format: (v) => `€${v.toFixed(2)}` },
  conversions: { label: 'Conversies', color: 'hsl(var(--chart-4, 140 70% 45%))', format: (v) => v.toLocaleString() },
};

export function CampaignPerformanceChart({ campaign }: CampaignPerformanceChartProps) {
  const [period, setPeriod] = useState<'7d' | '14d' | '30d'>('14d');
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['impressions', 'clicks']);

  // Generate simulated daily data based on campaign totals
  const chartData = useMemo(() => {
    const days = period === '7d' ? 7 : period === '14d' ? 14 : 30;
    const endDate = campaign.end_date ? new Date(campaign.end_date) : new Date();
    const startDate = campaign.start_date
      ? new Date(Math.max(new Date(campaign.start_date).getTime(), subDays(endDate, days).getTime()))
      : subDays(endDate, days);

    const interval = eachDayOfInterval({ start: startDate, end: endDate });
    const totalDays = interval.length || 1;

    // Distribute totals across days with some variance
    return interval.map((date, i) => {
      const progress = (i + 1) / totalDays;
      const variance = 0.7 + Math.random() * 0.6; // 0.7-1.3x

      return {
        date: format(date, 'dd MMM', { locale: nl }),
        impressions: Math.round((campaign.impressions / totalDays) * variance),
        clicks: Math.round((campaign.clicks / totalDays) * variance),
        spend: Number(((campaign.spend / totalDays) * variance).toFixed(2)),
        conversions: Math.round((campaign.conversions / totalDays) * variance),
      };
    });
  }, [campaign, period]);

  const toggleMetric = (metric: MetricKey) => {
    setSelectedMetrics(prev =>
      prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Performance Over Tijd</CardTitle>
          <CardDescription>Dagelijkse metrics voor deze campagne</CardDescription>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 dagen</SelectItem>
            <SelectItem value="14d">14 dagen</SelectItem>
            <SelectItem value="30d">30 dagen</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {/* Metric toggle pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.entries(METRICS) as [MetricKey, typeof METRICS[MetricKey]][]).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => toggleMetric(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedMetrics.includes(key)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-transparent hover:border-border'
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>

        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => {
                  const metric = METRICS[name as MetricKey];
                  return [metric?.format(value) || value, metric?.label || name];
                }}
              />
              {selectedMetrics.map(metric => (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={METRICS[metric].color}
                  fill={METRICS[metric].color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
