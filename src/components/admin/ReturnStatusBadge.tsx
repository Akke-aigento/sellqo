import { Badge } from '@/components/ui/badge';
import type { ReturnStatus, RefundStatus } from '@/hooks/useReturns';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  registered: { label: 'Geregistreerd', variant: 'outline' },
  in_transit: { label: 'In transit', variant: 'secondary' },
  received: { label: 'Ontvangen', variant: 'default' },
  approved: { label: 'Goedgekeurd', variant: 'default' },
  rejected: { label: 'Geweigerd', variant: 'destructive' },
  exchanged: { label: 'Omgeruild', variant: 'secondary' },
  repaired: { label: 'Hersteld', variant: 'secondary' },
  refunded: { label: 'Terugbetaald', variant: 'default' },
};

const refundStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'In afwachting', variant: 'outline' },
  completed: { label: 'Voltooid', variant: 'default' },
  failed: { label: 'Mislukt', variant: 'destructive' },
  not_applicable: { label: 'N.v.t.', variant: 'secondary' },
};

export function ReturnStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function RefundStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const config = refundStatusConfig[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ReturnSourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const labels: Record<string, string> = {
    manual: 'Manueel',
    bolcom: 'Bol.com',
    amazon: 'Amazon',
  };
  return <Badge variant="outline">{labels[source] || source}</Badge>;
}
