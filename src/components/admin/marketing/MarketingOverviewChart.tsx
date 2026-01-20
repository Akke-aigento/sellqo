import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { subDays, format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface OverviewChartProps {
  period?: '7d' | '30d' | '90d';
}

export function MarketingOverviewChart({ period = '30d' }: OverviewChartProps) {
  const { currentTenant } = useTenant();

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startDate = subDays(new Date(), days).toISOString();

  const { data: chartData = [], isLoading } = useQuery({
    queryKey: ['marketing-overview-chart', currentTenant?.id, period],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data: sends } = await supabase
        .from('campaign_sends')
        .select('sent_at, opened_at, clicked_at')
        .gte('sent_at', startDate);

      if (!sends) return [];

      // Group by date
      const dailyData = new Map<string, { sent: number; opened: number; clicked: number }>();

      sends.forEach((send: { sent_at: string | null; opened_at: string | null; clicked_at: string | null }) => {
        if (send.sent_at) {
          const date = format(new Date(send.sent_at), 'yyyy-MM-dd');
          const existing = dailyData.get(date) || { sent: 0, opened: 0, clicked: 0 };
          existing.sent++;
          if (send.opened_at) existing.opened++;
          if (send.clicked_at) existing.clicked++;
          dailyData.set(date, existing);
        }
      });

      // Fill in missing dates
      const result = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const data = dailyData.get(date) || { sent: 0, opened: 0, clicked: 0 };
        result.push({
          date,
          label: format(new Date(date), 'd MMM', { locale: nl }),
          ...data,
        });
      }

      return result;
    },
    enabled: !!currentTenant?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorClicked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            interval={period === '7d' ? 0 : period === '30d' ? 4 : 10}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span className="text-sm text-muted-foreground capitalize">{value}</span>
            )}
          />
          <Area
            type="monotone"
            dataKey="sent"
            name="Verzonden"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorSent)"
          />
          <Area
            type="monotone"
            dataKey="opened"
            name="Geopend"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorOpened)"
          />
          <Area
            type="monotone"
            dataKey="clicked"
            name="Geklikt"
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorClicked)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
