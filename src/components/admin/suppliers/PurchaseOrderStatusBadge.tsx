import { Badge } from "@/components/ui/badge";
import type { PurchaseOrderStatus } from "@/types/supplier";
import { purchaseOrderStatusInfo } from "@/types/supplier";

interface PurchaseOrderStatusBadgeProps {
  status: PurchaseOrderStatus;
}

export function PurchaseOrderStatusBadge({ status }: PurchaseOrderStatusBadgeProps) {
  const info = purchaseOrderStatusInfo[status];

  return (
    <Badge className={info.color} variant="secondary">
      {info.label}
    </Badge>
  );
}
