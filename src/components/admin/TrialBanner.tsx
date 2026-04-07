import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Clock, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTrialStatus } from '@/hooks/useTrialStatus';

export function TrialBanner() {
  const navigate = useNavigate();
  const { 
    isLoading, 
    isTrialing, 
    isPaid, 
    daysRemaining, 
    getUrgencyLevel,
    planName 
  } = useTrialStatus();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if loading, dismissed, paid, or not trialing
  if (isLoading || isDismissed || isPaid || !isTrialing) {
    return null;
  }

  const urgencyLevel = getUrgencyLevel();
  const progressValue = Math.max(0, Math.min(100, ((14 - daysRemaining) / 14) * 100));

  const getBannerStyles = () => {
    switch (urgencyLevel) {
      case 'expired':
        return 'bg-destructive/10 border-destructive text-destructive';
      case 'critical':
        return 'bg-orange-500/10 border-orange-500 text-orange-700 dark:text-orange-400';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400';
      default:
        return 'bg-primary/5 border-primary/30 text-foreground';
    }
  };

  const getProgressColor = () => {
    switch (urgencyLevel) {
      case 'expired':
        return 'bg-destructive';
      case 'critical':
        return 'bg-orange-500';
      case 'warning':
        return 'bg-amber-500';
      default:
        return 'bg-primary';
    }
  };

  const getIcon = () => {
    switch (urgencyLevel) {
      case 'expired':
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <Clock className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getMessage = () => {
    if (urgencyLevel === 'expired') {
      return 'Je trial is verlopen. Upgrade nu om door te gaan.';
    }
    if (daysRemaining === 1) {
      return 'Nog 1 dag over in je trial!';
    }
    return `Je hebt nog ${daysRemaining} dagen gratis trial`;
  };

  return (
    <div className={cn(
      'relative border-b px-4 py-3',
      getBannerStyles()
    )}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {getMessage()}
            </p>
            {urgencyLevel !== 'expired' && (
              <div className="flex items-center gap-2 mt-1">
                <Progress 
                  value={progressValue} 
                  className="h-1.5 w-24 bg-muted"
                />
                <span className="text-xs text-muted-foreground">
                  {planName}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button 
            size="sm" 
            variant={urgencyLevel === 'expired' || urgencyLevel === 'critical' ? 'default' : 'outline'}
            onClick={() => navigate('/admin/billing')}
            className={cn(
              urgencyLevel === 'critical' && 'bg-orange-500 hover:bg-orange-600',
              urgencyLevel === 'expired' && 'bg-destructive hover:bg-destructive/90'
            )}
          >
            Upgrade nu
          </Button>
          {urgencyLevel !== 'expired' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setIsDismissed(true)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Sluiten</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
