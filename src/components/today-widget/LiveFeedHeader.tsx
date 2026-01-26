import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveFeedHeaderProps {
  isConnected: boolean;
}

export function LiveFeedHeader({ isConnected }: LiveFeedHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Zap className="h-5 w-5 text-yellow-500" />
          {isConnected && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>
        <span className="font-bold text-sm tracking-wide">LIVE NU</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            isConnected 
              ? "bg-emerald-500" 
              : "bg-muted-foreground/30"
          )}
        />
        <span className="text-xs text-muted-foreground">
          {isConnected ? 'Verbonden' : 'Verbinden...'}
        </span>
      </div>
    </div>
  );
}
