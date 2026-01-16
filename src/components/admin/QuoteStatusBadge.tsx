import { Badge } from '@/components/ui/badge';
import type { QuoteStatus } from '@/types/quote';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
}

const statusConfig: Record<QuoteStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Concept', variant: 'secondary' },
  sent: { label: 'Verstuurd', variant: 'default' },
  accepted: { label: 'Geaccepteerd', variant: 'default' },
  declined: { label: 'Afgewezen', variant: 'destructive' },
  expired: { label: 'Verlopen', variant: 'outline' },
  converted: { label: 'Omgezet', variant: 'default' },
};

const statusColors: Record<QuoteStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  accepted: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  declined: 'bg-destructive/10 text-destructive border-destructive/20',
  expired: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  converted: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
};

export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  const config = statusConfig[status];
  const colorClass = statusColors[status];

  return (
    <Badge variant="outline" className={colorClass}>
      {config.label}
    </Badge>
  );
}
