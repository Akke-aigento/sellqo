import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OnboardingTooltipProps {
  title: string;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function OnboardingTooltip({ 
  title, 
  content, 
  side = 'right',
  className 
}: OnboardingTooltipProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-5 w-5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10',
              className
            )}
          >
            <Info className="h-3.5 w-3.5" />
            <span className="sr-only">Info over {title}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-sm">{title}</p>
            <div className="text-xs text-muted-foreground">{content}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Extended tooltip with popover for more detailed content
interface OnboardingInfoPopoverProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function OnboardingInfoPopover({ 
  title, 
  children,
  className 
}: OnboardingInfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-5 w-5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10',
            className
          )}
        >
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">Info over {title}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            {title}
          </h4>
          <div className="text-sm text-muted-foreground">
            {children}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
