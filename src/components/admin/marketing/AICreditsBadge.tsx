import { Sparkles, Zap, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAICredits } from '@/hooks/useAICredits';
import { cn } from '@/lib/utils';

interface AICreditsBadgeProps {
  variant?: 'compact' | 'full';
  onUpgrade?: () => void;
}

export function AICreditsBadge({ variant = 'compact', onUpgrade }: AICreditsBadgeProps) {
  const { credits, isLoading } = useAICredits();

  if (isLoading) {
    return (
      <Badge variant="secondary" className="animate-pulse">
        <Sparkles className="h-3 w-3 mr-1" />
        ...
      </Badge>
    );
  }

  const available = credits?.available || 0;
  const total = (credits?.credits_total || 0) + (credits?.credits_purchased || 0);
  const percentage = total > 0 ? (available / total) * 100 : 0;
  const isLow = available < 5;
  const isEmpty = available === 0;

  if (variant === 'compact') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isEmpty ? 'destructive' : isLow ? 'secondary' : 'outline'}
            className={cn(
              'cursor-pointer transition-colors',
              !isEmpty && !isLow && 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30'
            )}
            onClick={onUpgrade}
          >
            <Sparkles className={cn('h-3 w-3 mr-1', !isEmpty && !isLow && 'text-purple-500')} />
            {available} AI
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{available} AI credits beschikbaar</p>
          {isLow && <p className="text-amber-400 text-xs">Bijna op - klik om bij te kopen</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'p-2 rounded-full',
            isEmpty ? 'bg-destructive/10' : isLow ? 'bg-amber-500/10' : 'bg-purple-500/10'
          )}>
            {isEmpty ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Sparkles className={cn('h-4 w-4', isLow ? 'text-amber-500' : 'text-purple-500')} />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">AI Credits</p>
            <p className="text-xs text-muted-foreground">
              {available} van {total} beschikbaar
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={isEmpty ? 'default' : 'outline'}
          onClick={onUpgrade}
          className={cn(
            isEmpty && 'bg-gradient-to-r from-purple-600 to-blue-600'
          )}
        >
          <Zap className="h-3 w-3 mr-1" />
          Bijkopen
        </Button>
      </div>

      <Progress
        value={percentage}
        className={cn(
          'h-2',
          isEmpty && '[&>div]:bg-destructive',
          isLow && !isEmpty && '[&>div]:bg-amber-500',
          !isEmpty && !isLow && '[&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-blue-500'
        )}
      />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Kosten per actie:</span>
        <div className="space-x-2">
          <span>Inzichten: 1</span>
          <span>•</span>
          <span>Post: 2</span>
          <span>•</span>
          <span>Email: 3</span>
        </div>
      </div>
    </div>
  );
}
