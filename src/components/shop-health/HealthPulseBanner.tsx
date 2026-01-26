import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { HealthScoreCircle } from './HealthScoreCircle';
import { formatCurrency } from '@/lib/utils';
import type { HealthStatus } from '@/config/healthMessages';

interface HealthPulseBannerProps {
  score: number;
  status: HealthStatus;
  emotionalMessage: string;
  dailyPulse: string;
  todayStats: {
    revenue: number;
    orders: number;
    newCustomers: number;
  };
}

const statusGradients: Record<HealthStatus, string> = {
  healthy: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
  attention: 'from-amber-500/10 via-amber-500/5 to-transparent',
  warning: 'from-orange-500/10 via-orange-500/5 to-transparent',
  critical: 'from-red-500/10 via-red-500/5 to-transparent',
};

const statusBorders: Record<HealthStatus, string> = {
  healthy: 'border-emerald-500/20',
  attention: 'border-amber-500/20',
  warning: 'border-orange-500/20',
  critical: 'border-red-500/20',
};

export function HealthPulseBanner({
  score,
  status,
  emotionalMessage,
  dailyPulse,
  todayStats,
}: HealthPulseBannerProps) {
  // Build stats line
  const statsItems: string[] = [];
  if (todayStats.revenue > 0) {
    statsItems.push(`Vandaag ${formatCurrency(todayStats.revenue)} omzet`);
  }
  if (todayStats.orders > 0) {
    statsItems.push(`${todayStats.orders} bestelling${todayStats.orders > 1 ? 'en' : ''}`);
  }
  if (todayStats.newCustomers > 0) {
    statsItems.push(`${todayStats.newCustomers} nieuwe klant${todayStats.newCustomers > 1 ? 'en' : ''}`);
  }
  
  return (
    <Card
      className={cn(
        'relative overflow-hidden border-2',
        statusBorders[status]
      )}
    >
      {/* Gradient background */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-r',
          statusGradients[status]
        )}
      />
      
      {/* Pulse animation for healthy status */}
      {status === 'healthy' && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent animate-pulse" />
      )}
      
      <div className="relative p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Score Circle */}
          <div className="flex-shrink-0">
            <HealthScoreCircle score={score} status={status} size="lg" />
          </div>
          
          {/* Content */}
          <div className="flex-1 space-y-2">
            {/* Emotional message */}
            <h2 className="text-xl md:text-2xl font-bold">
              {emotionalMessage}
            </h2>
            
            {/* Daily pulse */}
            <p className="text-muted-foreground">
              {dailyPulse}
            </p>
            
            {/* Stats line */}
            {statsItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {statsItems.map((item, index) => (
                  <span key={index} className="flex items-center">
                    {index > 0 && <span className="text-muted-foreground mx-2">•</span>}
                    <span className="font-medium">{item}</span>
                  </span>
                ))}
              </div>
            )}
            
            {/* Progress bar */}
            <div className="w-full max-w-md">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    status === 'healthy' && 'bg-emerald-500',
                    status === 'attention' && 'bg-amber-500',
                    status === 'warning' && 'bg-orange-500',
                    status === 'critical' && 'bg-red-500'
                  )}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Score badge for mobile */}
          <div className="md:hidden absolute top-4 right-4">
            <span className="text-2xl font-bold">{score}/100</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
