import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Minus, Plus, ShoppingCart, Heart, Check, Eye, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { usePublicStorefront, usePublicProduct } from '@/hooks/usePublicStorefront';
import { usePublicReviews } from '@/hooks/useReviewsHub';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { VariantSelector } from '@/components/storefront/VariantSelector';
import { ImageLightbox } from '@/components/storefront/ImageLightbox';
import { RelatedProducts } from '@/components/storefront/RelatedProducts';
import { ProductReviewsSection, StarRating } from '@/components/storefront/ProductReviewsSection';
import { GiftCardPurchaseForm } from '@/components/storefront/GiftCardPurchaseForm';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';


export default function ShopProductDetail() {
  const { tenantSlug, productSlug } = useParams<{ tenantSlug: string; productSlug: string }>();
  const { tenant, themeSettings } = usePublicStorefront(tenantSlug || '');
  const { data: product, isLoading, error } = usePublicProduct(tenant?.id, productSlug || '');
  const { reviews, aggregate } = usePublicReviews(tenant?.id);
  const { addToCart, setTenantSlug, getCartCount, openDrawer } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const navigate = useNavigate();
  
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [viewerCount] = useState(() => Math.floor(Math.random() * 8) + 2);

  // Read storefront config settings
  const ts = themeSettings as any;
  const imageZoom = ts?.product_image_zoom || 'none';
  const variantStyle = ts?.product_variant_style || 'buttons';
  const reviewsDisplay = ts?.product_reviews_display || 'full';
  const showStockCount = ts?.show_stock_count || false;
  const showViewersCount = ts?.show_viewers_count || false;
  const stockIndicator = ts?.product_stock_indicator !== false; // default true
  const relatedMode = ts?.product_related_mode || 'off';

  useEffect(() => {
    if (tenantSlug) setTenantSlug(tenantSlug);
  }, [tenantSlug, setTenantSlug]);

  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length || !Object.keys(selectedAttributes).length) return null;
    return product.variants.find((v: any) => {
      const attrs = v.attribute_values || {};
      const keys = Object.keys(selectedAttributes);
      if (keys.length !== Object.keys(attrs).length) return false;
      return keys.every(k => attrs[k] === selectedAttributes[k]);
    }) || null;
  }, [product?.variants, selectedAttributes]);

  useEffect(() => {
    if (selectedVariant?.image_url) setSelectedImage(0);
  }, [selectedVariant?.image_url]);

  const displayPrice = selectedVariant?.price ?? product?.price ?? 0;
  const displayComparePrice = selectedVariant?.compare_at_price ?? product?.compare_at_price;
  const hasDiscount = displayComparePrice && displayComparePrice > displayPrice;
  const discountPercentage = hasDiscount ? Math.round((1 - displayPrice / displayComparePrice!) * 100) : 0;
  const inStock = selectedVariant ? selectedVariant.in_stock : product?.in_stock;
  const stockCount = product?.track_inventory ? (selectedVariant?.stock ?? product?.stock) : undefined;

  const displayImages = useMemo(() => {
    if (!product) return [];
    if (selectedVariant?.image_url) return [selectedVariant.image_url, ...(product.images || [])];
    return product.images || [];
  }, [product, selectedVariant?.image_url]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: tenant?.currency || 'EUR' }).format(price);
  };

  useEffect(() => {
    if (product?.is_variant_product && product.selected_variant_index != null && product.variants?.length) {
      const currentVariant = product.variants[product.selected_variant_index];
      if (currentVariant?.attribute_values) {
        setSelectedAttributes(currentVariant.attribute_values as Record<string, string>);
      }
    }
  }, [product?.is_variant_product, product?.selected_variant_index, product?.variants]);

  const handleAttributeChange = useCallback((optionName: string, value: string) => {
    const newAttrs = { ...selectedAttributes, [optionName]: value };
    if (product?.variants?.length) {
      const matchingVariant = product.variants.find((v: any) => {
        const attrs = v.attribute_values || {};
        const keys = Object.keys(newAttrs);
        if (keys.length !== Object.keys(attrs).length) return false;
        return keys.every((k: string) => attrs[k] === newAttrs[k]);
      });
      if (matchingVariant?.linked_product_slug && tenantSlug) {
        navigate(`/shop/${tenantSlug}/${matchingVariant.linked_product_slug}`);
        return;
      }
    }
    setSelectedAttributes(newAttrs);
  }, [selectedAttributes, product?.variants, tenantSlug, navigate]);

  const handleAddToCart = () => {
    if (!product) return;
    if (product.has_variants && !selectedVariant) {
      toast.error('Selecteer alstublieft alle opties');
      return;
    }
    const variantTitle = selectedVariant
      ? Object.values(selectedVariant.attribute_values as Record<string, string>).join(' / ')
      : undefined;
    addToCart({
      productId: product.id, name: product.name, price: displayPrice, quantity,
      image: selectedVariant?.image_url ?? product.images?.[0],
      sku: selectedVariant?.sku ?? product.sku,
      variantId: selectedVariant?.id, variantTitle,
    });
    // Cart drawer opens automatically via CartContext
  };

  const handleImageClick = () => {
    if (imageZoom === 'lightbox') setLightboxOpen(true);
  };

  if (isLoading) {
    return (
      <ShopLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12">
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
          <Button asChild><Link to={`/shop/${tenantSlug}/products`}>Terug naar producten</Link></Button>
        </div>
      </ShopLayout>
    );
  }

  const cartCount = getCartCount();
  const allOptionsSelected = product.options?.length
    ? product.options.every((opt: any) => selectedAttributes[opt.name])
    : true;

  // Determine image interaction classes based on zoom setting
  const imageClasses = [
    "w-full h-full object-cover transition-transform duration-300",
    imageZoom === 'hover' && "group-hover:scale-150 origin-center",
    (imageZoom === 'click' || imageZoom === 'lightbox') && "cursor-zoom-in",
  ].filter(Boolean).join(' ');

  return (
    <ShopLayout>
      <Helmet>
        <title>{product.meta_title || product.name} | {tenant?.name || 'Shop'}</title>
        {product.meta_description && <meta name="description" content={product.meta_description} />}
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        {themeSettings?.show_breadcrumbs !== false && (
          <nav className="flex items-center gap-1.5 sm:gap-2 text-sm text-muted-foreground mb-6 flex-wrap">
            <Link to={`/shop/${tenantSlug}`} className="hover:text-foreground shrink-0">Home</Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <Link to={`/shop/${tenantSlug}/products`} className="hover:text-foreground shrink-0">Producten</Link>
            {product.category && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <Link to={`/shop/${tenantSlug}/products?category=${product.category.slug}`} className="hover:text-foreground shrink-0">{product.category.name}</Link>
              </>
            )}
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground truncate max-w-[150px] sm:max-w-none">{product.name}</span>
          </nav>
        )}

        <div className="grid md:grid-cols-2 gap-6 md:gap-12">
          {/* Images */}
          <div>
            <div 
              className="aspect-square rounded-lg overflow-hidden bg-muted mb-4 group"
              onClick={handleImageClick}
            >
              {displayImages[selectedImage] ? (
                <img 
                  src={displayImages[selectedImage]} 
                  alt={product.name}
                  className={imageClasses}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <svg className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {displayImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {displayImages.map((image: string, index: number) => (
                  <button key={index} onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${selectedImage === index ? 'border-primary' : 'border-transparent'}`}>
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {product.category && (
              <Link to={`/shop/${tenantSlug}/products?category=${product.category.slug}`} className="text-sm text-muted-foreground hover:text-primary">{product.category.name}</Link>
            )}

            <h1 className="text-3xl font-bold mt-2 mb-2" style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}>
              {product.name}
            </h1>

            {/* Star Rating next to title */}
            {reviewsDisplay !== 'hidden' && aggregate && aggregate.total_reviews > 0 && (
              <div className="mb-4">
                <StarRating rating={aggregate.average_rating} count={aggregate.total_reviews} />
              </div>
            )}

            {/* Price - hide for gift cards */}
            {product.product_type !== 'gift_card' && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl font-bold">{formatPrice(displayPrice)}</span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{formatPrice(displayComparePrice!)}</span>
                  <span className="bg-destructive text-destructive-foreground text-sm font-medium px-2 py-1 rounded">-{discountPercentage}%</span>
                </>
              )}
            </div>
            )}

            {/* Gift Card Purchase Form */}
            {product.product_type === 'gift_card' ? (
              <div className="mb-6">
                <GiftCardPurchaseForm
                  product={product}
                  currency={tenant?.currency || 'EUR'}
                  themeSettings={themeSettings}
                  logoUrl={(tenant as any)?.logo_url || undefined}
                />
              </div>
            ) : (
              <>
                {/* Viewers count */}
                {showViewersCount && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Eye className="h-4 w-4" />
                    <span>{viewerCount} mensen bekijken dit nu</span>
                  </div>
                )}

                {/* Variant Selection - respects variant_style setting */}
                {product.has_variants && product.options?.length > 0 && (
                  <div className="mb-6">
                    {variantStyle === 'dropdown' ? (
                      <DropdownVariantSelector options={product.options} selectedAttributes={selectedAttributes} onAttributeChange={handleAttributeChange} />
                    ) : variantStyle === 'swatches' ? (
                      <SwatchVariantSelector options={product.options} selectedAttributes={selectedAttributes} onAttributeChange={handleAttributeChange} />
                    ) : (
                      <VariantSelector options={product.options} selectedAttributes={selectedAttributes} onAttributeChange={handleAttributeChange} />
                    )}
                  </div>
                )}

                {/* Add to Cart */}
                {inStock && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6">
                    <div className="flex items-center border rounded-lg self-start">
                      <Button variant="ghost" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{quantity}</span>
                      <Button variant="ghost" size="icon" onClick={() => setQuantity(prev => { const max = stockCount ?? Infinity; return Math.min(prev + 1, max); })} disabled={stockCount != null && quantity >= stockCount}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 flex-1">
                      <Button size="lg" className="flex-1" onClick={handleAddToCart} disabled={product.has_variants && !allOptionsSelected}
                        style={{ backgroundColor: themeSettings?.primary_color || undefined }}>
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        <span className="truncate">Toevoegen</span>
                        {cartCount > 0 && <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">{cartCount}</span>}
                      </Button>

                      {themeSettings?.show_wishlist && product && (
                        <Button variant="outline" size="icon" className="shrink-0 h-11 w-11" onClick={() => toggleWishlist({
                          productId: product.id, name: product.name, price: displayPrice,
                          image: product.images?.[0], slug: product.slug,
                        })}>
                          <Heart className={`h-5 w-5 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {product.has_variants && !allOptionsSelected && (
                  <p className="text-sm text-muted-foreground mb-4">Selecteer alle opties om toe te voegen aan winkelwagen</p>
                )}

                {/* Stock Status - respects stock_indicator setting */}
                {stockIndicator && (
                  <div className="flex items-center gap-2 mb-6">
                    {inStock ? (
                      <>
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-green-600 font-medium">
                          Op voorraad
                          {showStockCount && stockCount != null && stockCount > 0 && stockCount <= 20 && (
                            <span className="ml-1">— Nog {stockCount} stuks</span>
                          )}
                        </span>
                      </>
                    ) : (
                      <span className="text-destructive font-medium">Uitverkocht</span>
                    )}
                  </div>
                )}

                {/* Low stock urgency */}
                {stockIndicator && showStockCount && inStock && stockCount != null && stockCount > 0 && stockCount <= 5 && (
                  <div className="flex items-center gap-2 text-sm text-orange-600 mb-4">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Bijna uitverkocht! Bestel snel.</span>
                  </div>
                )}
              </>
            )}

            {/* Description */}
            {product.description && (
              <div 
                className="prose prose-sm max-w-none mb-8 dark:prose-invert
                           prose-headings:font-bold prose-headings:text-foreground
                           prose-p:text-muted-foreground prose-a:text-primary prose-a:underline
                           prose-strong:text-foreground prose-li:text-muted-foreground
                           prose-ul:list-disc prose-ol:list-decimal"
                dangerouslySetInnerHTML={{ __html: product.description }} 
              />
            )}

            {product.product_type !== 'gift_card' && (selectedVariant?.sku || product.sku) && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">SKU:</span> {selectedVariant?.sku || product.sku}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      {tenant && reviewsDisplay !== 'hidden' && (
        <div className="container mx-auto px-4">
          <ProductReviewsSection
            reviews={reviews || []}
            averageRating={aggregate?.average_rating || 0}
            totalReviews={aggregate?.total_reviews || 0}
            display={reviewsDisplay}
          />
        </div>
      )}

      {/* Related Products */}
      {tenant && (
        <div className="container mx-auto px-4">
          <RelatedProducts
            tenantId={tenant.id}
            currentProductId={product.id}
            categoryId={product.category?.id}
            basePath={`/shop/${tenantSlug}`}
            currency={tenant.currency || 'EUR'}
            mode={relatedMode}
          />
        </div>
      )}

      {/* Lightbox Gallery */}
      <ImageLightbox
        images={displayImages}
        currentIndex={selectedImage}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndexChange={setSelectedImage}
        alt={product.name}
      />
    </ShopLayout>
  );
}

// Dropdown variant selector
function DropdownVariantSelector({ options, selectedAttributes, onAttributeChange }: any) {
  return (
    <div className="space-y-4">
      {options.map((option: any) => (
        <div key={option.name} className="space-y-2">
          <Label className="text-sm font-medium">{option.name}</Label>
          <Select value={selectedAttributes[option.name] || ''} onValueChange={(value) => onAttributeChange(option.name, value)}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder={`Kies ${option.name.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {option.values.map((val: string) => (
                <SelectItem key={val} value={val}>{val}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

// Swatch variant selector (color circles)
function SwatchVariantSelector({ options, selectedAttributes, onAttributeChange }: any) {
  const COLOR_MAP: Record<string, string> = {
    zwart: '#000', black: '#000', wit: '#fff', white: '#fff',
    rood: '#ef4444', red: '#ef4444', blauw: '#3b82f6', blue: '#3b82f6',
    groen: '#22c55e', green: '#22c55e', geel: '#eab308', yellow: '#eab308',
    roze: '#ec4899', pink: '#ec4899', paars: '#a855f7', purple: '#a855f7',
    oranje: '#f97316', orange: '#f97316', grijs: '#6b7280', gray: '#6b7280',
    bruin: '#92400e', brown: '#92400e', beige: '#d4c5a9',
  };

  return (
    <div className="space-y-4">
      {options.map((option: any) => {
        const isColorOption = option.name.toLowerCase().includes('kleur') || option.name.toLowerCase().includes('color');
        return (
          <div key={option.name} className="space-y-2">
            <Label className="text-sm font-medium">
              {option.name}
              {selectedAttributes[option.name] && <span className="ml-2 text-muted-foreground font-normal">— {selectedAttributes[option.name]}</span>}
            </Label>
            <div className="flex flex-wrap gap-2">
              {option.values.map((val: string) => {
                const isSelected = selectedAttributes[option.name] === val;
                const color = isColorOption ? COLOR_MAP[val.toLowerCase()] : undefined;
                return color ? (
                  <button key={val} onClick={() => onAttributeChange(option.name, val)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-muted hover:border-foreground/50'}`}
                    style={{ backgroundColor: color }} title={val}
                    aria-label={val} />
                ) : (
                  <button key={val} onClick={() => onAttributeChange(option.name, val)}
                    className={`px-4 py-2 text-sm rounded-md border transition-all ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:border-foreground/50'}`}>
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
