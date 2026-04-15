import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderStatus, PaymentStatus } from '@/types/order';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: { 
    label: 'In afwachting', 
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200' 
  },
  processing: { 
    label: 'In behandeling', 
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' 
  },
  shipped: { 
    label: 'Verzonden', 
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200' 
  },
  delivered: { 
    label: 'Afgeleverd', 
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200' 
  },
  cancelled: { 
    label: 'Geannuleerd', 
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200' 
  },
  returned: { 
    label: 'Geretourneerd', 
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' 
  },
  partially_returned: { 
    label: 'Deels geretourneerd', 
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' 
  },
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

const paymentConfig: Record<PaymentStatus, { label: string; className: string }> = {
  pending: { 
    label: 'Onbetaald', 
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' 
  },
  paid: { 
    label: 'Betaald', 
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200' 
  },
  refunded: { 
    label: 'Terugbetaald', 
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200' 
  },
  failed: { 
    label: 'Mislukt', 
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200' 
  },
  partially_refunded: { 
    label: 'Deels terugbetaald', 
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' 
  },
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const config = paymentConfig[status];
  
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
