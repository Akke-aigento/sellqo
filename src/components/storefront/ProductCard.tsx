import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Heart, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    has_variants?: boolean;
  };
  basePath: string;
  showPrice?: boolean;
  currency?: string;
  onQuickView?: (product: any) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: any) => void;
}

export function ProductCard({ product, basePath, showPrice = true, currency = 'EUR', onQuickView, isWishlisted, onToggleWishlist }: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercentage = hasDiscount 
    ? Math.round((1 - product.price / product.compare_at_price!) * 100)
    : 0;
  const hasSecondImage = product.images.length > 1;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency,
    }).format(price);
  };

  return (
    <div 
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wishlist heart */}
      {onToggleWishlist && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleWishlist(product); }}
          className="absolute top-2 right-2 z-10 p-2 bg-background/80 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
        >
          <Heart className={cn("h-4 w-4 transition-colors", isWishlisted ? "fill-red-500 text-red-500" : "text-foreground")} />
        </button>
      )}

      <Link to={`${basePath}/product/${product.slug}`} className="block">
        {/* Image */}
        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-3">
          {product.images[0] ? (
            <>
              <img 
                src={product.images[0]} 
                alt={product.name}
                className={cn(
                  "w-full h-full object-cover transition-all duration-500 absolute inset-0",
                  hasSecondImage && hovered ? "opacity-0" : "opacity-100"
                )}
              />
              {hasSecondImage && (
                <img 
                  src={product.images[1]} 
                  alt={product.name}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-500 absolute inset-0",
                    hovered ? "opacity-100 scale-105" : "opacity-0"
                  )}
                />
              )}
              {!hasSecondImage && (
                <div className={cn(
                  "absolute inset-0 bg-transparent transition-transform duration-300",
                  hovered && "scale-105"
                )}>
                  <img 
                    src={product.images[0]} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                    style={{ opacity: hasSecondImage ? 0 : undefined }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Discount Badge */}
          {hasDiscount && (
            <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs font-medium px-2 py-1 rounded z-[1]">
              -{discountPercentage}%
            </div>
          )}

          {/* Out of Stock Badge */}
          {!product.in_stock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[1]">
              <span className="bg-background text-foreground text-sm font-medium px-3 py-1 rounded">
                Uitverkocht
              </span>
            </div>
          )}

          {/* Hover overlay with actions */}
          {product.in_stock && (
            <div className={cn(
              "absolute bottom-0 left-0 right-0 p-3 flex gap-2 transition-all duration-300 z-[2]",
              hovered ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
            )}>
              {onQuickView && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(product); }}
                  className="flex-1 bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium py-2.5 px-3 rounded-lg hover:bg-background transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Quick View
                </button>
              )}
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView?.(product); }}
                className={cn(
                  "bg-primary text-primary-foreground text-xs font-medium py-2.5 px-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5",
                  onQuickView ? "" : "flex-1"
                )}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {product.has_variants ? 'Opties' : 'Toevoegen'}
              </button>
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
    </div>
  );
}
