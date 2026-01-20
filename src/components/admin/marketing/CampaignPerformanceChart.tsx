import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface HourlyStats {
  hour: string;
  opens: number;
  clicks: number;
}

interface CampaignPerformanceChartProps {
  data: HourlyStats[];
  isLoading?: boolean;
}

export function CampaignPerformanceChart({ data, isLoading }: CampaignPerformanceChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[250px] w-full" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        <p>Nog geen activiteit geregistreerd</p>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map(item => ({
    ...item,
    time: format(new Date(item.hour), 'HH:mm', { locale: nl }),
    date: format(new Date(item.hour), 'd MMM', { locale: nl }),
  }));

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
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
            labelFormatter={(value, payload) => {
              if (payload?.[0]?.payload?.date) {
                return `${payload[0].payload.date} ${value}`;
              }
              return value;
            }}
          />
          <Legend 
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span className="text-sm text-muted-foreground">{value === 'opens' ? 'Opens' : 'Clicks'}</span>
            )}
          />
          <Area
            type="monotone"
            dataKey="opens"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorOpens)"
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorClicks)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
