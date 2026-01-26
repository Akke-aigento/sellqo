import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrendData } from '@/lib/healthScoreCalculator';

interface HealthTrendChartProps {
  trends: TrendData;
}

export function HealthTrendChart({ trends }: HealthTrendChartProps) {
  const { labels, values, change } = trends;
  
  if (values.length === 0) {
    return null;
  }
  
  const maxValue = Math.max(...values, 1);
  const normalizedValues = values.map(v => (v / maxValue) * 100);
  
  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const trendColor = change > 0 ? 'text-emerald-500' : change < 0 ? 'text-red-500' : 'text-muted-foreground';
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            📈 Trend (7 dagen)
          </CardTitle>
          <div className={cn('flex items-center gap-1 text-sm font-medium', trendColor)}>
            <TrendIcon className="h-4 w-4" />
            {change > 0 && '+'}
            {change.toFixed(1)}%
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-24 flex items-end gap-1">
          {normalizedValues.map((height, index) => (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-1"
            >
              {/* Bar */}
              <div
                className={cn(
                  'w-full rounded-t transition-all duration-300',
                  height > 0 ? 'bg-primary' : 'bg-muted',
                  'min-h-[4px]'
                )}
                style={{ height: `${Math.max(height, 4)}%` }}
              />
              
              {/* Label */}
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                {labels[index]?.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
        
        {/* Total for the week */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Week totaal</span>
          <span className="text-sm font-medium">
            €{values.reduce((a, b) => a + b, 0).toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
