import { Badge } from '@/components/ui/badge';
import type { InvoiceStatus } from '@/types/invoice';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

const statusConfig: Record<InvoiceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Concept', variant: 'secondary' },
  sent: { label: 'Verstuurd', variant: 'default' },
  paid: { label: 'Betaald', variant: 'outline' },
  cancelled: { label: 'Geannuleerd', variant: 'destructive' },
  processing: { label: 'In verwerking', variant: 'secondary' },
  unpaid: { label: 'Niet betaald', variant: 'destructive' },
};

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge 
      variant={config.variant}
      className={
        status === 'paid'
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
          : status === 'processing'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
          : ''
      }
    >
      {config.label}
    </Badge>
  );
}
