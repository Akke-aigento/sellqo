import { Package, Check } from 'lucide-react';
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
    <div className="border rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-base">In deze bundel</h3>
      </div>

      <div className="space-y-3 mb-4">
        {items.map((item) => (
          <div key={item.product_id} className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
              {item.product.images?.[0] ? (
                <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Package className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                to={`/shop/${tenantSlug}/product/${item.product.slug}`}
                className="text-sm font-medium hover:text-primary transition-colors truncate block"
              >
                {item.quantity > 1 && <span className="text-muted-foreground">{item.quantity}× </span>}
                {item.product.name}
              </Link>
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(item.product.price * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {savings > 0 && (
        <div className="flex items-center gap-2 pt-3 border-t">
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-600">
            Je bespaart {formatPrice(savings)} ({savingsPercent}%) met deze bundel
          </span>
        </div>
      )}
    </div>
  );
}
