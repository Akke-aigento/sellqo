import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { useCart } from '@/context/CartContext';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export default function ShopCart() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, themeSettings } = usePublicStorefront(tenantSlug || '');
  const { items: cartItems, updateQuantity, removeItem, setTenantSlug, getSubtotal } = useCart();
  
  const [discountCode, setDiscountCode] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);

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

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemoveItem(productId);
      return;
    }
    updateQuantity(productId, newQuantity);
  };

  const handleRemoveItem = (productId: string) => {
    removeItem(productId);
    toast.success('Product verwijderd uit winkelwagen');
  };

  const applyDiscount = async () => {
    if (!discountCode.trim()) return;
    
    setApplyingDiscount(true);
    // Here you would validate the discount code via API
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.error('Ongeldige kortingscode');
    setApplyingDiscount(false);
  };

  const subtotal = getSubtotal();
  const shipping = subtotal > 0 ? 5.95 : 0; // Example shipping cost
  const total = subtotal + shipping;

  return (
    <ShopLayout>
      <Helmet>
        <title>Winkelwagen | {tenant?.name || 'Shop'}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        {(themeSettings as any)?.show_breadcrumbs && (
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/shop/${tenantSlug}`}>Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Winkelwagen</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}

        <h1 
          className="text-3xl font-bold mb-8"
          style={{ fontFamily: themeSettings?.heading_font ? `"${themeSettings.heading_font}", serif` : undefined }}
        >
          Winkelwagen
        </h1>

        {cartItems.length === 0 ? (
          // Empty Cart State
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Je winkelwagen is leeg</h2>
            <p className="text-muted-foreground mb-6">
              Ontdek onze producten en voeg ze toe aan je winkelwagen
            </p>
            <Button asChild>
              <Link to={`/shop/${tenantSlug}/products`}>
                Bekijk Producten
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {cartItems.map(item => (
                  <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                    {/* Image */}
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/shop/${tenantSlug}/product/${item.productId}`}
                        className="font-medium hover:text-primary line-clamp-2"
                      >
                        {item.name}
                      </Link>
                      {item.variantTitle && (
                        <p className="text-sm text-muted-foreground">{item.variantTitle}</p>
                      )}
                      <p className="text-lg font-semibold mt-1">{formatPrice(item.price)}</p>
                    </div>

                    {/* Quantity */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border rounded-lg">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveItem(item.productId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Continue Shopping */}
              <div className="mt-6">
                <Link 
                  to={`/shop/${tenantSlug}/products`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Verder winkelen
                </Link>
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <div className="border rounded-lg p-6 sticky top-24">
                <h2 className="font-semibold text-lg mb-4">Overzicht</h2>

                {/* Discount Code */}
                <div className="flex gap-2 mb-4">
                  <Input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="Kortingscode"
                    className="flex-1"
                  />
                  <Button 
                    variant="outline"
                    onClick={applyDiscount}
                    disabled={applyingDiscount}
                  >
                    {applyingDiscount ? '...' : 'Toepassen'}
                  </Button>
                </div>

                <Separator className="my-4" />

                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotaal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verzending</span>
                    <span>{shipping > 0 ? formatPrice(shipping) : 'Gratis'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between font-semibold text-lg mb-6">
                  <span>Totaal</span>
                  <span>{formatPrice(total)}</span>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  style={{
                    backgroundColor: themeSettings?.primary_color || undefined,
                  }}
                  asChild
                >
                  <Link to={`/shop/${tenantSlug}/checkout`}>
                    Afrekenen
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Veilig betalen met iDEAL, Bancontact, creditcard en meer
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
