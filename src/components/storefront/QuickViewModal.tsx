import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { VariantSelector } from '@/components/storefront/VariantSelector';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface QuickViewProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price?: number | null;
  images: string[];
  description?: string;
  in_stock: boolean;
  has_variants?: boolean;
  options?: any[];
  variants?: any[];
  sku?: string;
  stock?: number | null;
}

interface QuickViewModalProps {
  product: QuickViewProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath: string;
  currency?: string;
  onCartOpen?: () => void;
}

export function QuickViewModal({ product, open, onOpenChange, basePath, currency = 'EUR', onCartOpen }: QuickViewModalProps) {
  const { addToCart } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [justAdded, setJustAdded] = useState(false);

  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length || !Object.keys(selectedAttributes).length) return null;
    return product.variants.find((v: any) => {
      const attrs = v.attribute_values || {};
      const keys = Object.keys(selectedAttributes);
      if (keys.length !== Object.keys(attrs).length) return false;
      return keys.every(k => attrs[k] === selectedAttributes[k]);
    }) || null;
  }, [product?.variants, selectedAttributes]);

  const displayPrice = selectedVariant?.price ?? product?.price ?? 0;
  const displayComparePrice = selectedVariant?.compare_at_price ?? product?.compare_at_price;
  const hasDiscount = displayComparePrice && displayComparePrice > displayPrice;
  const inStock = selectedVariant ? selectedVariant.in_stock : product?.in_stock;

  const handleAttributeChange = useCallback((name: string, value: string) => {
    setSelectedAttributes(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleAdd = () => {
    if (!product) return;
    if (product.has_variants && !selectedVariant) {
      toast.error('Selecteer alle opties');
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
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
    onOpenChange(false);
    onCartOpen?.();
  };

  if (!product) return null;

  const allOptionsSelected = product.options?.length
    ? product.options.every((opt: any) => selectedAttributes[opt.name])
    : true;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSelectedAttributes({}); setQuantity(1); setSelectedImage(0); } }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Images */}
          <div className="bg-muted">
            <div className="aspect-[4/3] md:aspect-square overflow-hidden">
              {product.images?.[selectedImage] ? (
                <img src={product.images[selectedImage]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ShoppingCart className="h-16 w-16 opacity-20" />
                </div>
              )}
            </div>
            {product.images?.length > 1 && (
              <div className="flex gap-1.5 p-3 overflow-x-auto">
                {product.images.slice(0, 5).map((img: string, i: number) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className={`w-14 h-14 rounded overflow-hidden border-2 flex-shrink-0 transition-colors ${i === selectedImage ? 'border-primary' : 'border-transparent'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-6 flex flex-col">
            <h2 className="text-xl font-bold mb-2">{product.name}</h2>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl font-bold">{formatCurrency(displayPrice, currency)}</span>
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">{formatCurrency(displayComparePrice!, currency)}</span>
              )}
            </div>

            {product.description && (
              <div className="text-sm text-muted-foreground line-clamp-3 mb-4" dangerouslySetInnerHTML={{ __html: product.description }} />
            )}

            {/* Variants */}
            {product.has_variants && product.options?.length > 0 && (
              <div className="mb-4">
                <VariantSelector options={product.options} selectedAttributes={selectedAttributes} onAttributeChange={handleAttributeChange} />
              </div>
            )}

            <div className="mt-auto space-y-3">
              {/* Quantity + Add */}
              {inStock !== false && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center border rounded-lg">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center font-medium">{quantity}</span>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setQuantity(q => q + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button className="flex-1" onClick={handleAdd} disabled={product.has_variants && !allOptionsSelected}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {justAdded ? 'Toegevoegd!' : 'Toevoegen'}
                  </Button>
                </div>
              )}

              {inStock === false && (
                <p className="text-destructive font-medium text-center py-2">Uitverkocht</p>
              )}

              <Button variant="outline" asChild className="w-full" onClick={() => onOpenChange(false)}>
                <Link to={`${basePath}/product/${product.slug}`}>
                  Bekijk volledige details <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
