import { Package, Check, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BundleItem {
  product_id: string;
  quantity: number;
  is_required: boolean;
  product: {
    id: string;
    name: string;
    price: number;
    images: string[] | null;
    slug: string;
  };
}

interface BundleContentsSectionProps {
  items: BundleItem[];
  bundlePrice: number;
  individualTotal: number;
  currency: string;
  tenantSlug: string;
}

export function BundleContentsSection({ items, bundlePrice, individualTotal, currency, tenantSlug }: BundleContentsSectionProps) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(price);

  const savings = individualTotal - bundlePrice;
  const savingsPercent = individualTotal > 0 ? Math.round((savings / individualTotal) * 100) : 0;

  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">In deze bundel</h3>
            <p className="text-xs text-muted-foreground">{items.length} product{items.length !== 1 ? 'en' : ''}</p>
          </div>
        </div>
        {savings > 0 && (
          <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-sm font-medium px-3 py-1.5 rounded-full">
            <Check className="h-3.5 w-3.5" />
            Bespaar {savingsPercent}%
          </div>
        )}
      </div>

      {/* Product cards */}
      <div className="space-y-2 mb-4">
        {items.map((item) => (
          <Link
            key={item.product_id}
            to={`/shop/${tenantSlug}/product/${item.product.slug}`}
            className="flex items-center gap-3.5 p-3 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-primary/30 hover:shadow-sm transition-all group"
          >
            {/* Image */}
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {item.product.images?.[0] ? (
                <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Package className="h-6 w-6" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {item.product.name}
                </span>
                {item.quantity > 1 && (
                  <span className="text-xs font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    ×{item.quantity}
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(item.product.price * item.quantity)}
              </span>
            </div>

            {/* Chevron */}
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Price comparison footer */}
      {savings > 0 && (
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Losse producten</span>
            <span className="line-through">{formatPrice(individualTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold text-foreground">
            <span>Bundelprijs</span>
            <span className="text-primary">{formatPrice(bundlePrice)}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-medium text-green-700 dark:text-green-400">
            <span>Jouw besparing</span>
            <span>{formatPrice(savings)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
