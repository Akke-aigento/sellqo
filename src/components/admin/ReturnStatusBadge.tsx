import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Store, Globe } from 'lucide-react';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  registered: { label: 'Geregistreerd', variant: 'outline' },
  requested: { label: 'Aangevraagd', variant: 'outline' },
  approved: { label: 'Goedgekeurd', variant: 'default' },
  shipped_by_customer: { label: 'Verzonden door klant', variant: 'secondary' },
  in_transit: { label: 'In transit', variant: 'secondary' },
  received: { label: 'Ontvangen', variant: 'default' },
  inspecting: { label: 'In inspectie', variant: 'secondary' },
  awaiting_refund: { label: 'Wacht op refund', variant: 'outline' },
  completed: { label: 'Afgerond', variant: 'default' },
  rejected: { label: 'Geweigerd', variant: 'destructive' },
  exchanged: { label: 'Omgeruild', variant: 'secondary' },
  repaired: { label: 'Hersteld', variant: 'secondary' },
  refunded: { label: 'Terugbetaald', variant: 'default' },
  cancelled: { label: 'Geannuleerd', variant: 'destructive' },
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
  const config: Record<string, { label: string; icon?: React.ReactNode }> = {
    manual: { label: 'SellQo', icon: <Store className="h-3 w-3" /> },
    bolcom: { label: 'Bol.com', icon: <ShoppingBag className="h-3 w-3" /> },
    amazon: { label: 'Amazon', icon: <Globe className="h-3 w-3" /> },
    shopify: { label: 'Shopify', icon: <ShoppingBag className="h-3 w-3" /> },
    woocommerce: { label: 'WooCommerce', icon: <Globe className="h-3 w-3" /> },
  };
  const c = config[source] || { label: source };
  return (
    <Badge variant="outline" className="gap-1">
      {c.icon}
      {c.label}
    </Badge>
  );
}
