import { cn } from '@/lib/utils';

interface TodayStatCardProps {
  icon: string;
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  changeIsAbsolute?: boolean;
  hideChange?: boolean;
}

export function TodayStatCard({
  icon,
  label,
  value,
  change,
  changeLabel = 'vs gisteren',
  changeIsAbsolute = false,
  hideChange = false,
}: TodayStatCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  const formatChange = () => {
    if (change === undefined || hideChange) return null;
    if (changeIsAbsolute) {
      return isPositive ? `+${change}` : change.toString();
    }
    return isPositive ? `+${change}%` : `${change}%`;
  };

  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-1.5">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="font-bold text-lg leading-tight">{value}</div>
      <div className="text-xs text-muted-foreground">
        {!hideChange && change !== undefined && (
          <span
            className={cn(
              'font-medium mr-1',
              isPositive && 'text-emerald-600 dark:text-emerald-400',
              isNegative && 'text-red-600 dark:text-red-400',
              isNeutral && 'text-muted-foreground'
            )}
          >
            {formatChange()}
          </span>
        )}
        <span>{changeLabel}</span>
      </div>
    </div>
  );
}
