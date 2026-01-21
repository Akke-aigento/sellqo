import { Link } from 'react-router-dom';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price: number | null;
    images: string[];
    in_stock: boolean;
    category?: { id: string; name: string; slug: string } | null;
  };
  basePath: string;
  showPrice?: boolean;
}

export function ProductCard({ product, basePath, showPrice = true }: ProductCardProps) {
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercentage = hasDiscount 
    ? Math.round((1 - product.price / product.compare_at_price!) * 100)
    : 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  return (
    <Link 
      to={`${basePath}/product/${product.slug}`}
      className="group block"
    >
      {/* Image */}
      <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-3">
        {product.images[0] ? (
          <img 
            src={product.images[0]} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs font-medium px-2 py-1 rounded">
            -{discountPercentage}%
          </div>
        )}

        {/* Out of Stock Badge */}
        {!product.in_stock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-background text-foreground text-sm font-medium px-3 py-1 rounded">
              Uitverkocht
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        {product.category && (
          <p className="text-xs text-muted-foreground mb-1">{product.category.name}</p>
        )}
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        {showPrice && (
          <div className="mt-1 flex items-center gap-2">
            <span className="font-semibold">{formatPrice(product.price)}</span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compare_at_price!)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
