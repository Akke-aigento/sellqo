import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type LockReason = 'live_listing' | 'pending_review' | 'manual' | null;

interface ListingProtectionBadgeProps {
  platform: 'bol_com' | 'amazon' | 'ebay' | 'shopify' | 'woocommerce';
  isLocked: boolean;
  lockReason?: LockReason;
  className?: string;
}

const PLATFORM_NAMES: Record<string, string> = {
  bol_com: 'Bol.com',
  amazon: 'Amazon',
  ebay: 'eBay',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
};

const REASON_LABELS: Record<string, string> = {
  live_listing: 'Live listing actief',
  pending_review: 'In afwachting van review',
  manual: 'Handmatig vergrendeld',
};

export function ListingProtectionBadge({
  platform,
  isLocked,
  lockReason,
  className,
}: ListingProtectionBadgeProps) {
  const platformName = PLATFORM_NAMES[platform] || platform;
  const reasonLabel = lockReason ? REASON_LABELS[lockReason] : null;

  if (!isLocked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "text-muted-foreground border-muted cursor-help",
                className
              )}
            >
              <Unlock className="w-3 h-3 mr-1" />
              Niet vergrendeld
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">
              Wijzigingen worden direct naar {platformName} gesynchroniseerd
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "text-amber-600 border-amber-300 bg-amber-50 cursor-help",
              className
            )}
          >
            <Lock className="w-3 h-3 mr-1" />
            Beschermd
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="text-sm font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              {platformName} Listing Beschermd
            </p>
            <p className="text-xs text-muted-foreground">
              {reasonLabel || 'Deze listing is vergrendeld.'}
              {' '}Wijzigingen vereisen bevestiging voordat ze naar de live listing worden gestuurd.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
