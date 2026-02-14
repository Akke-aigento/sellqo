import { useParams } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useWishlist } from '@/context/WishlistContext';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { Helmet } from 'react-helmet-async';

export default function ShopWishlist() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = usePublicStorefront(tenantSlug || '');
  const { items, removeFromWishlist } = useWishlist();
  const basePath = `/shop/${tenantSlug}`;

  // Convert wishlist items to product card format
  const products = items.map(item => ({
    id: item.productId,
    name: item.name,
    slug: item.slug,
    price: item.price,
    compare_at_price: null,
    images: item.image ? [item.image] : [],
    in_stock: true,
  }));

  return (
    <ShopLayout>
      <Helmet>
        <title>Verlanglijst | {tenant?.name || 'Shop'}</title>
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <Heart className="h-7 w-7" />
          Verlanglijst ({items.length})
        </h1>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">Je verlanglijst is leeg</p>
            <Button asChild>
              <Link to={`${basePath}/products`}>Bekijk producten</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(product => (
              <div key={product.id} className="relative">
                <ProductCard product={product} basePath={basePath} currency={tenant?.currency || 'EUR'} />
                <button
                  onClick={() => removeFromWishlist(product.id)}
                  className="absolute top-2 right-2 z-10 p-2 bg-background/80 backdrop-blur rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  title="Verwijderen van verlanglijst"
                >
                  <Heart className="h-4 w-4 fill-current" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
