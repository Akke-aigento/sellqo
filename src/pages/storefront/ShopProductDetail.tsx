import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Minus, Plus, ShoppingCart, Heart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicStorefront, usePublicProduct } from '@/hooks/usePublicStorefront';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { useCart } from '@/context/CartContext';

export default function ShopProductDetail() {
  const { tenantSlug, productSlug } = useParams<{ tenantSlug: string; productSlug: string }>();
  const { tenant, themeSettings } = usePublicStorefront(tenantSlug || '');
  const { data: product, isLoading, error } = usePublicProduct(tenant?.id, productSlug || '');
  const { addToCart, setTenantSlug, getCartCount } = useCart();
  
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Set tenant slug for cart context
  useEffect(() => {
    if (tenantSlug) {
      setTenantSlug(tenantSlug);
    }
  }, [tenantSlug, setTenantSlug]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: tenant?.currency || 'EUR',
    }).format(price);
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.images?.[0],
      sku: product.sku,
    });
    
    toast.success(`${quantity}x ${product.name} toegevoegd aan winkelwagen`, {
      action: {
        label: 'Bekijk winkelwagen',
        onClick: () => window.location.href = `/shop/${tenantSlug}/cart`,
      },
    });
  };

  if (isLoading) {
    return (
      <ShopLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="animate-pulse bg-muted aspect-square rounded-lg" />
            <div className="space-y-4">
              <div className="animate-pulse bg-muted h-8 rounded w-3/4" />
              <div className="animate-pulse bg-muted h-6 rounded w-1/4" />
              <div className="animate-pulse bg-muted h-24 rounded" />
            </div>
          </div>
        </div>
      </ShopLayout>
    );
  }

  if (error || !product) {
    return (
      <ShopLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Product niet gevonden</h1>
          <Button asChild>
            <Link to={`/shop/${tenantSlug}/products`}>Terug naar producten</Link>
          </Button>
        </div>
      </ShopLayout>
    );
  }

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercentage = hasDiscount 
    ? Math.round((1 - product.price / product.compare_at_price!) * 100)
    : 0;

  const cartCount = getCartCount();

  return (
    <ShopLayout>
      <Helmet>
        <title>{product.meta_title || product.name} | {tenant?.name || 'Shop'}</title>
        {product.meta_description && <meta name="description" content={product.meta_description} />}
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        {themeSettings?.show_breadcrumbs !== false && (
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link to={`/shop/${tenantSlug}`} className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <Link to={`/shop/${tenantSlug}/products`} className="hover:text-foreground">Producten</Link>
            {product.category && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link 
                  to={`/shop/${tenantSlug}/products?category=${product.category.slug}`}
                  className="hover:text-foreground"
                >
                  {product.category.name}
                </Link>
              </>
            )}
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{product.name}</span>
          </nav>
        )}

        <div className="grid md:grid-cols-2 gap-12">
          {/* Images */}
          <div>
            {/* Main Image */}
            <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-4">
              {product.images[selectedImage] ? (
                <img 
                  src={product.images[selectedImage]} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <svg className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === index ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {product.category && (
              <Link 
                to={`/shop/${tenantSlug}/products?category=${product.category.slug}`}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                {product.category.name}
              </Link>
            )}

            <h1 
              className="text-3xl font-bold mt-2 mb-4"
              style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}
            >
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl font-bold">{formatPrice(product.price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.compare_at_price!)}
                  </span>
                  <span className="bg-destructive text-destructive-foreground text-sm font-medium px-2 py-1 rounded">
                    -{discountPercentage}%
                  </span>
                </>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2 mb-6">
              {product.in_stock ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-green-600 font-medium">Op voorraad</span>
                </>
              ) : (
                <span className="text-destructive font-medium">Uitverkocht</span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div 
                className="prose prose-sm max-w-none mb-8"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            )}

            {/* Add to Cart */}
            {product.in_stock && (
              <div className="flex items-center gap-4 mb-8">
                {/* Quantity Selector */}
                <div className="flex items-center border rounded-lg">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Add to Cart Button */}
                <Button 
                  size="lg" 
                  className="flex-1"
                  onClick={handleAddToCart}
                  style={{
                    backgroundColor: themeSettings?.primary_color || undefined,
                  }}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Toevoegen aan winkelwagen
                  {cartCount > 0 && (
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {cartCount}
                    </span>
                  )}
                </Button>

                {/* Wishlist */}
                {themeSettings?.show_wishlist && (
                  <Button variant="outline" size="icon">
                    <Heart className="h-5 w-5" />
                  </Button>
                )}
              </div>
            )}

            {/* Product Details */}
            {product.sku && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">SKU:</span> {product.sku}
              </p>
            )}
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
