import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderStatus, PaymentStatus } from '@/types/order';
import { useTranslation } from 'react-i18next';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

const statusConfig: Record<OrderStatus, { labelKey: string; className: string }> = {
  pending: { 
    labelKey: 'admin.orderStatusBadge.status.pending', 
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200' 
  },
  processing: { 
    labelKey: 'admin.orderStatusBadge.status.processing', 
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' 
  },
  shipped: { 
    labelKey: 'admin.orderStatusBadge.status.shipped', 
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200' 
  },
  delivered: { 
    labelKey: 'admin.orderStatusBadge.status.delivered', 
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200' 
  },
  cancelled: { 
    labelKey: 'admin.orderStatusBadge.status.cancelled', 
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200' 
  },
  returned: { 
    labelKey: 'admin.orderStatusBadge.status.returned', 
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' 
  },
  partially_returned: { 
    labelKey: 'admin.orderStatusBadge.status.partially_returned', 
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' 
  },
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const { t } = useTranslation();
  const config = statusConfig[status];
  
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {t(config.labelKey)}
    </Badge>
  );
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

const paymentConfig: Record<PaymentStatus, { labelKey: string; className: string }> = {
  pending: { 
    labelKey: 'admin.orderStatusBadge.status.pending', 
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' 
  },
  paid: { 
    labelKey: 'admin.orderStatusBadge.status.paid', 
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200' 
  },
  refunded: { 
    labelKey: 'admin.orderStatusBadge.status.refunded', 
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200' 
  },
  failed: { 
    labelKey: 'admin.orderStatusBadge.status.failed', 
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200' 
  },
  partially_refunded: { 
    labelKey: 'admin.orderStatusBadge.status.partially_refunded', 
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' 
  },
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const { t } = useTranslation();
  const config = paymentConfig[status];
  
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {t(config.labelKey)}
    </Badge>
  );
}
