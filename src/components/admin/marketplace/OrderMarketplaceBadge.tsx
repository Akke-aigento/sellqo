import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Package, Store, ShoppingCart, FileEdit, Monitor } from 'lucide-react';

type MarketplaceSource = 'bol_com' | 'amazon' | 'sellqo_webshop' | 'woocommerce' | 'shopify' | 'manual' | string | null;

interface OrderMarketplaceBadgeProps {
  source: MarketplaceSource;
  salesChannel?: string | null;
  className?: string;
  showEmpty?: boolean;
}

const config: Record<string, { icon: typeof ShoppingBag; label: string; className: string }> = {
  pos: {
    icon: Monitor,
    label: 'POS',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  },
  sellqo_webshop: {
    icon: Store,
    label: 'SellQo',
    className: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  },
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
  woocommerce: {
    icon: ShoppingCart,
    label: 'WooCommerce',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  },
  shopify: {
    icon: ShoppingBag,
    label: 'Shopify',
    className: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  },
  manual: {
    icon: FileEdit,
    label: 'Handmatig',
    className: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
  },
};

export function OrderMarketplaceBadge({ source, salesChannel, className, showEmpty = true }: OrderMarketplaceBadgeProps) {
  // Prefer sales_channel over marketplace_source
  const effectiveSource = salesChannel === 'pos' ? 'pos' : (source || salesChannel || 'sellqo_webshop');
  
  if (!showEmpty && (!source && !salesChannel || effectiveSource === 'sellqo_webshop' || effectiveSource === 'webshop')) {
    return null;
  }

  const resolvedSource = effectiveSource === 'webshop' ? 'sellqo_webshop' : effectiveSource;

  const { icon: Icon, label, className: badgeClass } = config[resolvedSource] || {
    icon: Store,
    label: resolvedSource,
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <Badge variant="outline" className={`gap-1 text-xs ${badgeClass} ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
