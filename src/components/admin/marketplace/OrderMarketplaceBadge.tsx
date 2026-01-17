import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Package, Store } from 'lucide-react';

type MarketplaceSource = 'bol_com' | 'amazon' | 'sellqo_webshop' | string | null;

interface OrderMarketplaceBadgeProps {
  source: MarketplaceSource;
  className?: string;
}

export function OrderMarketplaceBadge({ source, className }: OrderMarketplaceBadgeProps) {
  if (!source || source === 'sellqo_webshop') {
    return null;
  }

  const config: Record<string, { icon: typeof ShoppingBag; label: string; className: string }> = {
    bol_com: {
      icon: ShoppingBag,
      label: 'Bol.com',
      className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    },
    amazon: {
      icon: Package,
      label: 'Amazon',
      className: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    },
  };

  const { icon: Icon, label, className: badgeClass } = config[source] || {
    icon: Store,
    label: source,
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <Badge variant="outline" className={`gap-1 text-xs ${badgeClass} ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
