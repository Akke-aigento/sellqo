import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Building2, LogIn, Search, User, CheckCircle, AlertCircle, Tag, X, Truck, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { PaymentMethodSelector, type PaymentMethod } from '@/components/storefront/PaymentMethodSelector';
import { BankTransferPayment } from '@/components/storefront/BankTransferPayment';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { useCart } from '@/context/CartContext';
import { useAddressValidation } from '@/hooks/useAddressValidation';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useStorefrontShipping } from '@/hooks/useStorefrontShipping';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type CheckoutStep = 'details' | 'payment' | 'confirmation';

// EU VAT rates by country
const EU_VAT_RATES: Record<string, number> = {
  'AT': 20, 'BE': 21, 'BG': 20, 'HR': 25, 'CY': 19, 'CZ': 21,
  'DK': 25, 'EE': 22, 'FI': 25.5, 'FR': 20, 'DE': 19, 'GR': 24,
  'HU': 27, 'IE': 23, 'IT': 22, 'LV': 21, 'LT': 21, 'LU': 17,
  'MT': 18, 'NL': 21, 'PL': 23, 'PT': 23, 'RO': 19, 'SK': 20,
  'SI': 22, 'ES': 21, 'SE': 25,
};

const EU_COUNTRY_CODES = Object.keys(EU_VAT_RATES);

const COUNTRIES = [
  { code: 'BE', name: 'België' },
  { code: 'NL', name: 'Nederland' },
  { code: 'DE', name: 'Duitsland' },
  { code: 'FR', name: 'Frankrijk' },
  { code: 'LU', name: 'Luxemburg' },
  { code: 'AT', name: 'Oostenrijk' },
  { code: 'ES', name: 'Spanje' },
  { code: 'IT', name: 'Italië' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IE', name: 'Ierland' },
  { code: 'GB', name: 'Verenigd Koninkrijk' },
  { code: 'CH', name: 'Zwitserland' },
  { code: 'PL', name: 'Polen' },
  { code: 'CZ', name: 'Tsjechië' },
  { code: 'DK', name: 'Denemarken' },
  { code: 'SE', name: 'Zweden' },
  { code: 'FI', name: 'Finland' },
  { code: 'NO', name: 'Noorwegen' },
];

interface CustomerData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  vatNumber: string;
  customerType: 'b2c' | 'b2b';
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
}

export default function ShopCheckout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { tenant, themeSettings } = usePublicStorefront(tenantSlug || '');
  const { 
    items: cartItems, setTenantSlug, getSubtotal, clearCart, addToCart,
    appliedDiscount, applyDiscountCode, removeDiscountCode,
  } = useCart();
  const { searchAddress, suggestions, isSearching } = useAddressValidation();

  // Read query params for headless cart and cancel URL
  const searchParams = new URLSearchParams(window.location.search);
  const cancelUrl = searchParams.get('cancel_url');
  const cartId = searchParams.get('cart_id');
  
  const [serverCartLoading, setServerCartLoading] = useState(false);
  const serverCartLoadedRef = useRef(false);
  const { t } = useTranslation();
  
  const [step, setStep] = useState<CheckoutStep>('details');
  const [customerData, setCustomerData] = useState<CustomerData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    vatNumber: '',
    customerType: 'b2c',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
    country: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>(['stripe']);
  const [isProcessing, setIsProcessing] = useState(false);
  const submittingRef = useRef(false);
  const [bankTransferOrder, setBankTransferOrder] = useState<{
    orderId: string;
    orderNumber: string;
    ogmReference: string;
    amount: number;
  } | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authProcessing, setAuthProcessing] = useState(false);

  // VAT validation state
  const [vatValidation, setVatValidation] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    companyName?: string;
  }>({ status: 'idle' });

  // Discount code state for checkout (ref-based to prevent focus loss)
  const discountInputRef = useRef<HTMLInputElement>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  // Read checkout config settings
  const ts = themeSettings as any;
  const phoneRequired = ts?.checkout_phone_required || false;
  const companyField = ts?.checkout_company_field || 'hidden';
  const addressAutocomplete = ts?.checkout_address_autocomplete || false;
  const guestEnabled = ts?.checkout_guest_enabled !== false;

  // Tenant BTW settings
  const enableB2bCheckout = tenant?.enable_b2b_checkout ?? false;
  const requireViesValidation = tenant?.require_vies_validation ?? true;
  const blockInvalidVatOrders = tenant?.block_invalid_vat_orders ?? false;
  const tenantCountry = (tenant?.country || 'BE').toUpperCase();
  const tenantVatRate = tenant?.tax_percentage || 21;
  const ossEnabled = tenant?.oss_enabled ?? false;
  const ossThresholdReached = tenant?.oss_threshold_reached ?? false;
  const defaultVatHandling = tenant?.default_vat_handling || 'exclusive';

  // Check auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
      if (session?.user) {
        setCustomerData(prev => ({
          ...prev,
          email: prev.email || session.user.email || '',
        }));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load server-side cart when cart_id is present (headless/custom frontend)
  useEffect(() => {
    if (!cartId || !tenant?.id || serverCartLoadedRef.current) return;
    serverCartLoadedRef.current = true;
    setServerCartLoading(true);

    supabase.functions.invoke('storefront-api', {
      body: { action: 'cart_get', tenant_id: tenant.id, params: { cart_id: cartId } },
    }).then(({ data, error }) => {
      if (error) {
        console.error('Failed to load server cart:', error);
        setServerCartLoading(false);
        return;
      }
      const result = data?.data || data;
      const serverItems = result?.items || [];
      if (serverItems.length > 0) {
        clearCart();
        for (const item of serverItems) {
          const unitPrice = item.unit_price || (item.gift_card_metadata as any)?.amount || item.products?.price || 0;
          addToCart({
            productId: item.product_id,
            name: item.products?.name || item.product?.name || 'Product',
            price: unitPrice,
            quantity: item.quantity || 1,
            image: item.product?.image || (Array.isArray(item.products?.images) ? item.products.images[0] : item.products?.images) || undefined,
            variantId: item.variant_id || undefined,
            variantTitle: item.variant?.title || item.product_variants?.name || undefined,
            sku: item.product_variants?.sku || undefined,
            giftCard: item.gift_card_metadata ? {
              recipientName: (item.gift_card_metadata as any).recipientName || '',
              recipientEmail: (item.gift_card_metadata as any).recipientEmail || '',
              personalMessage: (item.gift_card_metadata as any).personalMessage,
              sendDate: (item.gift_card_metadata as any).sendDate,
              designId: (item.gift_card_metadata as any).designId,
            } : undefined,
          });
        }
      }
      // Restore discount code from server cart
      if (result.discount_code && result.discount_amount > 0 && result.discount_info) {
        applyDiscountCode({
          code: result.discount_code,
          discount_type: result.discount_info.discount_type,
          discount_value: result.discount_info.discount_value,
          applies_to: result.discount_info.applies_to,
          description: result.discount_info.description,
          calculated_amount: result.discount_amount,
        });
      }
      setServerCartLoading(false);
    });
  }, [cartId, tenant?.id]);

  useEffect(() => {
    if (tenantSlug) setTenantSlug(tenantSlug);
  }, [tenantSlug, setTenantSlug]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('cancelled') === 'true') {
      toast.info('Je betaling is geannuleerd. Probeer het opnieuw.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (tenant?.payment_methods_enabled) {
      const methods = tenant.payment_methods_enabled as PaymentMethod[];
      setEnabledPaymentMethods(methods.length > 0 ? methods : ['stripe']);
      // Prefer bank_transfer as default when available
      if (methods.includes('bank_transfer')) {
        setPaymentMethod('bank_transfer');
      } else if (methods.length > 0) {
        setPaymentMethod(methods[0]);
      }
    }
  }, [tenant?.payment_methods_enabled]);

  useEffect(() => {
    if (tenant?.country && !customerData.country) {
      setCustomerData(prev => ({ ...prev, country: tenant.country || 'BE' }));
    }
  }, [tenant]);

  useEffect(() => {
    if (!addressAutocomplete || !addressQuery || addressQuery.length < 3) {
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(() => {
      searchAddress(addressQuery, customerData.country);
      setShowSuggestions(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [addressQuery, addressAutocomplete, customerData.country]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: tenant?.currency || 'EUR',
    }).format(price);
  };

  const { methods: shippingMethods, selectedMethod, selectedMethodId, setSelectedMethodId, getShippingCost } = useStorefrontShipping(tenant?.id);
  const subtotal = getSubtotal();
  const discountAmount = appliedDiscount?.calculated_amount || 0;

  // Gift card detection
  const allGiftCards = cartItems.length > 0 && cartItems.every(item => !!item.giftCard);

  const shipping = allGiftCards ? 0 : getShippingCost(subtotal);
  const subtotalAfterDiscount = subtotal - discountAmount;

  // VAT calculation
  const calculateVat = () => {
    if (defaultVatHandling === 'inclusive') {
      return { amount: 0, rate: 0, text: null, type: 'inclusive' as const };
    }

    const customerCountry = customerData.country.toUpperCase();
    const isEu = EU_COUNTRY_CODES.includes(customerCountry);
    const isSameCountry = tenantCountry === customerCountry;
    const taxableAmount = subtotalAfterDiscount + shipping;

    if (isSameCountry) {
      return { amount: Math.round(taxableAmount * (tenantVatRate / 100) * 100) / 100, rate: tenantVatRate, text: null, type: 'standard' as const };
    }
    if (!isEu) {
      return { amount: 0, rate: 0, text: 'Export - vrijgesteld van BTW', type: 'export' as const };
    }
    if (customerData.customerType === 'b2b' && vatValidation.status === 'valid') {
      return { amount: 0, rate: 0, text: 'BTW verlegd (reverse charge)', type: 'reverse_charge' as const };
    }
    if (ossEnabled && ossThresholdReached) {
      const rate = EU_VAT_RATES[customerCountry] || tenantVatRate;
      return { amount: Math.round(taxableAmount * (rate / 100) * 100) / 100, rate, text: `BTW ${customerCountry} ${rate}%`, type: 'oss' as const };
    }
    return { amount: Math.round(taxableAmount * (tenantVatRate / 100) * 100) / 100, rate: tenantVatRate, text: null, type: 'standard' as const };
  };

  const vatInfo = calculateVat();
  const total = subtotalAfterDiscount + shipping + vatInfo.amount;

  const handleInputChange = (field: keyof CustomerData, value: string) => {
    setCustomerData(prev => ({ ...prev, [field]: value }));
  };

  const handleSearchQueryChange = (value: string) => {
    setAddressQuery(value);
    if (value.length < 3) setShowSuggestions(false);
  };

  const handleSelectSuggestion = (suggestion: any) => {
    const streetParts = suggestion.street || '';
    const streetMatch = streetParts.match(/^(.+?)\s+(\d+\S*)$/);
    setCustomerData(prev => ({
      ...prev,
      street: streetMatch ? streetMatch[1] : streetParts,
      houseNumber: streetMatch ? streetMatch[2] : prev.houseNumber,
      city: suggestion.city,
      postalCode: suggestion.postal_code,
      country: suggestion.country || prev.country,
    }));
    setShowSuggestions(false);
    setAddressQuery('');
  };

  // VIES VAT validation
  const handleVatValidation = async () => {
    const vat = customerData.vatNumber.trim();
    if (!vat || vat.length < 5) {
      setVatValidation({ status: 'idle' });
      return;
    }
    setVatValidation({ status: 'validating' });
    try {
      const { data, error } = await supabase.functions.invoke('validate-vat', {
        body: { vat_number: vat },
      });
      if (error) throw error;
      if (data?.valid) {
        setVatValidation({ status: 'valid', companyName: data.company_name });
        if (!customerData.companyName && data.company_name) {
          setCustomerData(prev => ({ ...prev, companyName: data.company_name }));
        }
        toast.success('BTW-nummer geverifieerd');
      } else {
        setVatValidation({ status: 'invalid' });
        toast.error(data?.error || 'BTW-nummer niet geldig');
      }
    } catch {
      setVatValidation({ status: 'invalid' });
      toast.error('Fout bij valideren BTW-nummer');
    }
  };

  // Discount code in checkout
  const handleApplyDiscount = async () => {
    const code = (discountInputRef.current?.value || '').trim();
    if (!code || !tenant) return;
    setApplyingDiscount(true);
    try {
      const { data, error } = await supabase.functions.invoke('storefront-api', {
        body: {
          action: 'validate_discount_code',
          tenant_id: tenant.id,
          params: { code, subtotal },
        },
      });
      if (error) throw error;
      const result = data?.data || data;
      if (result?.valid) {
        let calcAmount = 0;
        if (result.discount_type === 'percentage') {
          calcAmount = Math.round(subtotal * (result.discount_value / 100) * 100) / 100;
        } else {
          calcAmount = Math.min(result.discount_value, subtotal);
        }
        applyDiscountCode({
          code,
          discount_type: result.discount_type,
          discount_value: result.discount_value,
          applies_to: result.applies_to,
          description: result.description,
          calculated_amount: calcAmount,
        });
        if (discountInputRef.current) discountInputRef.current.value = '';
        toast.success('Kortingscode toegepast!');
      } else {
        toast.error(result?.error || 'Ongeldige kortingscode');
      }
    } catch {
      toast.error('Er ging iets mis bij het valideren van de kortingscode');
    } finally {
      setApplyingDiscount(false);
    }
  };

  const validateForm = (): boolean => {
    if (!customerData.email || !customerData.firstName || !customerData.lastName) {
      toast.error('Vul alle verplichte velden in');
      return false;
    }
    if (phoneRequired && !customerData.phone.trim()) {
      toast.error('Telefoonnummer is verplicht');
      return false;
    }
    if (customerData.customerType === 'b2b' && !customerData.companyName.trim()) {
      toast.error('Bedrijfsnaam is verplicht voor zakelijke bestellingen');
      return false;
    }
    if (companyField === 'required' && customerData.customerType === 'b2c' && !customerData.companyName.trim()) {
      toast.error('Bedrijfsnaam is verplicht');
      return false;
    }
    if (!allGiftCards && (!customerData.street || !customerData.postalCode || !customerData.city)) {
      toast.error('Vul je adresgegevens in');
      return false;
    }
    // Block if B2B + VIES required + invalid
    if (customerData.customerType === 'b2b' && requireViesValidation && blockInvalidVatOrders) {
      if (customerData.vatNumber.trim() && vatValidation.status !== 'valid') {
        toast.error('Een geldig BTW-nummer is vereist voor zakelijke bestellingen');
        return false;
      }
    }
    return true;
  };

  const handleCustomerDetailsSubmit = () => {
    if (!validateForm()) return;
    if (enabledPaymentMethods.length === 1) {
      setPaymentMethod(enabledPaymentMethods[0]);
      handlePayment(enabledPaymentMethods[0]);
    } else {
      setStep('payment');
    }
  };

  const handlePayment = async (method: PaymentMethod) => {
    if (!tenant) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsProcessing(true);
    
    try {
      const formattedItems = cartItems.map(item => ({
        product_id: item.productId,
        product_name: item.name,
        product_sku: item.sku,
        product_image: item.image,
        quantity: item.quantity,
        unit_price: item.price,
        gift_card_metadata: item.giftCard ? {
          recipientName: item.giftCard.recipientName,
          recipientEmail: item.giftCard.recipientEmail,
          personalMessage: item.giftCard.personalMessage,
          sendDate: item.giftCard.sendDate,
          designId: item.giftCard.designId,
          purchaser_email: customerData.email,
        } : undefined,
      }));

      const shippingAddress = allGiftCards ? {
        street: '-',
        city: '-',
        postal_code: '-',
        country: customerData.country || 'NL',
      } : {
        street: `${customerData.street} ${customerData.houseNumber}`.trim(),
        city: customerData.city,
        postal_code: customerData.postalCode,
        country: customerData.country,
      };

      const commonBody = {
        tenant_id: tenant.id,
        items: formattedItems,
        customer_email: customerData.email,
        customer_name: `${customerData.firstName} ${customerData.lastName}`,
        customer_phone: customerData.phone,
        company_name: customerData.companyName || undefined,
        shipping_address: shippingAddress,
        billing_address: shippingAddress,
        shipping_cost: shipping,
        shipping_method_id: allGiftCards ? undefined : (selectedMethodId || undefined),
        shipping_method_name: allGiftCards ? undefined : (selectedMethod?.name || undefined),
        // BTW data
        customer_type: customerData.customerType,
        vat_number: customerData.customerType === 'b2b' ? customerData.vatNumber || undefined : undefined,
        vat_validated: customerData.customerType === 'b2b' ? vatValidation.status === 'valid' : undefined,
        vat_type: vatInfo.type,
        // Discount data
        discount_code: appliedDiscount?.code || undefined,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
      };

      if (method === 'stripe') {
        const { data: sessionData, error } = await supabase.functions.invoke('create-checkout-session', {
          body: commonBody,
        });
        if (error) {
          const body = await error.context?.json?.().catch(() => null);
          throw new Error(body?.error || error.message);
        }
        if (sessionData?.url) {
          clearCart();
          window.location.href = sessionData.url;
        }
      } else if (method === 'bank_transfer') {
        const { data: orderData, error } = await supabase.functions.invoke('create-bank-transfer-order', {
          body: commonBody,
        });
        if (error) {
          const body = await error.context?.json?.().catch(() => null);
          throw new Error(body?.error || error.message);
        }
        clearCart();
        navigate(`/shop/${tenantSlug}/order/${orderData.order.id}`);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Er ging iets mis bij het verwerken van je bestelling');
    } finally {
      submittingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handlePaymentMethodConfirm = () => {
    handlePayment(paymentMethod);
  };

  // Discount code section (rendered outside OrderSummaryContent to prevent focus loss)
  const DiscountCodeSection = () => (
    <>
      {!appliedDiscount ? (
        <div className="flex gap-2 mb-4">
          <Input
            ref={discountInputRef}
            defaultValue=""
            placeholder="Kortingscode"
            className="flex-1"
            onChange={(e) => { e.target.value = e.target.value.toUpperCase(); }}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
          />
          <Button
            variant="outline" size="sm"
            onClick={handleApplyDiscount}
            disabled={applyingDiscount}
          >
            {applyingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Toepassen'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-4 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400 truncate">
              {appliedDiscount.code}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeDiscountCode()}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </>
  );

  // Order summary component (reused in sidebar + mobile)
  const OrderSummaryContent = ({ compact = false }: { compact?: boolean }) => (
    <>
      {!compact && (
        <div className="space-y-3 mb-4">
          {cartItems.map(item => (
            <div key={item.id} className="text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground truncate mr-2">
                  {item.quantity}x {item.name}
                  {item.giftCard && <span className="text-xs ml-1">(Cadeaukaart)</span>}
                  {item.variantTitle && !item.giftCard && (
                    <span className="text-xs ml-1">— {item.variantTitle}</span>
                  )}
                </span>
                <span className="shrink-0">{formatPrice((item.price || (item.giftCard as any)?.amount || 0) * item.quantity)}</span>
              </div>
              {item.giftCard?.recipientName && (
                <p className="text-xs text-muted-foreground ml-4">
                  Voor: {item.giftCard.recipientName}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!compact && <DiscountCodeSection />}

      {!compact && <Separator className="my-4" />}

      <div className={`space-y-2 text-sm ${compact ? '' : ''}`}>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotaal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {appliedDiscount && discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Korting ({appliedDiscount.discount_type === 'percentage' ? `${appliedDiscount.discount_value}%` : formatPrice(appliedDiscount.discount_value)})</span>
            <span>-{formatPrice(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Verzending{selectedMethod && shippingMethods.length > 1 ? ` (${selectedMethod.name})` : ''}
          </span>
          <span>{shipping > 0 ? formatPrice(shipping) : 'Gratis'}</span>
        </div>
        {vatInfo.amount > 0 && defaultVatHandling !== 'inclusive' && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              BTW {vatInfo.rate}%{vatInfo.text ? ` (${vatInfo.text})` : ''}
            </span>
            <span>{formatPrice(vatInfo.amount)}</span>
          </div>
        )}
        {vatInfo.text && vatInfo.amount === 0 && defaultVatHandling !== 'inclusive' && (
          <div className="text-xs text-muted-foreground italic">{vatInfo.text}</div>
        )}
      </div>

      {!compact && <Separator className="my-4" />}

      <div className={`flex justify-between font-semibold ${compact ? 'text-lg' : 'text-lg'}`}>
        <span>Totaal</span>
        <span>{formatPrice(total)}</span>
      </div>
    </>
  );

  if (serverCartLoading) {
    return (
      <ShopLayout>
        <Helmet><title>Afrekenen | {tenant?.name || 'Shop'}</title></Helmet>
        <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Winkelwagen laden...</p>
        </div>
      </ShopLayout>
    );
  }

  if (cartItems.length === 0 && step === 'details' && !bankTransferOrder) {
    return (
      <ShopLayout>
        <Helmet><title>Afrekenen | {tenant?.name || 'Shop'}</title></Helmet>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Je winkelwagen is leeg</h1>
          <p className="text-muted-foreground mb-6">Voeg eerst producten toe aan je winkelwagen.</p>
          <Button asChild>
            <Link to={`/shop/${tenantSlug}/products`}>Bekijk Producten</Link>
          </Button>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <Helmet><title>Afrekenen | {tenant?.name || 'Shop'}</title></Helmet>

      <div className="container mx-auto px-4 py-8 pb-28 lg:pb-8">
        {/* Guest checkout gate */}
        {!guestEnabled && !currentUser && !authLoading && step === 'details' ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                Inloggen om te bestellen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Je moet ingelogd zijn om een bestelling te plaatsen.
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>E-mailadres</Label>
                  <Input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="je@email.com" />
                </div>
                <div className="space-y-2">
                  <Label>Wachtwoord</Label>
                  <Input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <Button
                  className="w-full"
                  disabled={authProcessing}
                  onClick={async () => {
                    setAuthProcessing(true);
                    try {
                      if (authMode === 'login') {
                        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
                        if (error) throw error;
                        toast.success('Ingelogd!');
                      } else {
                        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
                        if (error) throw error;
                        toast.success('Account aangemaakt! Controleer je e-mail.');
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'Er ging iets mis');
                    } finally {
                      setAuthProcessing(false);
                    }
                  }}
                >
                  {authProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {authMode === 'login' ? 'Inloggen' : 'Account aanmaken'}
                </Button>
                <Button variant="ghost" className="w-full text-sm" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                  {authMode === 'login' ? 'Nog geen account? Registreer' : 'Al een account? Log in'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
        <>
        {step !== 'confirmation' && (
          <Button
            variant="ghost" className="mb-6"
            onClick={() => {
              if (step === 'payment') {
                setStep('details');
              } else if (cancelUrl) {
                window.location.href = cancelUrl;
              } else {
                navigate(`/shop/${tenantSlug}/cart`);
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 'payment' ? 'Terug naar gegevens' : 'Terug naar winkelwagen'}
          </Button>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {step === 'details' && (
              <Card>
                <CardHeader>
                  <CardTitle>Je gegevens</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* B2B/B2C Toggle */}
                  {enableB2bCheckout && (
                    <>
                      <div className="space-y-3">
                        <h3 className="font-medium">Klanttype</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            type="button"
                            variant={customerData.customerType === 'b2c' ? 'default' : 'outline'}
                            onClick={() => {
                              handleInputChange('customerType', 'b2c');
                              setVatValidation({ status: 'idle' });
                            }}
                            className="flex-1"
                          >
                            <User className="h-4 w-4 mr-2" />
                            Particulier
                          </Button>
                          <Button
                            type="button"
                            variant={customerData.customerType === 'b2b' ? 'default' : 'outline'}
                            onClick={() => handleInputChange('customerType', 'b2b')}
                            className="flex-1"
                          >
                            <Building2 className="h-4 w-4 mr-2" />
                            Zakelijk
                          </Button>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* B2B: Company + VAT */}
                  {customerData.customerType === 'b2b' && (
                    <>
                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Bedrijfsgegevens
                        </h3>
                        <div className="space-y-2">
                          <Label htmlFor="companyName">Bedrijfsnaam *</Label>
                          <Input
                            id="companyName"
                            value={customerData.companyName}
                            onChange={(e) => handleInputChange('companyName', e.target.value)}
                            placeholder="Naam van je bedrijf"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vatNumber">BTW-nummer</Label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              id="vatNumber"
                              value={customerData.vatNumber}
                              onChange={(e) => {
                                handleInputChange('vatNumber', e.target.value.toUpperCase());
                                setVatValidation({ status: 'idle' });
                              }}
                              placeholder="BE0123456789"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleVatValidation}
                              disabled={vatValidation.status === 'validating' || !customerData.vatNumber.trim()}
                            >
                              {vatValidation.status === 'validating' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Valideer'
                              )}
                            </Button>
                          </div>
                          {vatValidation.status === 'valid' && (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span>BTW-nummer geverifieerd{vatValidation.companyName ? `: ${vatValidation.companyName}` : ''}</span>
                            </div>
                          )}
                          {vatValidation.status === 'invalid' && (
                            <div className="flex items-center gap-2 text-sm text-destructive">
                              <AlertCircle className="h-4 w-4" />
                              <span>BTW-nummer niet geldig of niet gevonden</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* B2C company field (if configured) */}
                  {customerData.customerType === 'b2c' && companyField !== 'hidden' && (
                    <>
                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Bedrijfsgegevens
                        </h3>
                        <div className="space-y-2">
                          <Label htmlFor="companyName">
                            Bedrijfsnaam {companyField === 'required' ? '*' : '(optioneel)'}
                          </Label>
                          <Input
                            id="companyName"
                            value={customerData.companyName}
                            onChange={(e) => handleInputChange('companyName', e.target.value)}
                            placeholder="Naam van je bedrijf"
                            required={companyField === 'required'}
                          />
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Contactgegevens</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mailadres *</Label>
                        <Input id="email" type="email" value={customerData.email} onChange={(e) => handleInputChange('email', e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefoonnummer {phoneRequired ? '*' : ''}</Label>
                        <Input id="phone" type="tel" value={customerData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} required={phoneRequired} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Voornaam *</Label>
                        <Input id="firstName" value={customerData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Achternaam *</Label>
                        <Input id="lastName" value={customerData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} required />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Address — hidden for gift-card-only orders */}
                  {!allGiftCards && (
                  <div className="space-y-4">
                    <h3 className="font-medium">{t('checkout.shippingAddress')}</h3>
                    
                    {addressAutocomplete && (
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={addressQuery}
                            onChange={(e) => handleSearchQueryChange(e.target.value)}
                            placeholder={t('checkout.searchAddress')}
                            className="pl-9"
                            autoComplete="off"
                          />
                        </div>
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {suggestions.map((s, i) => (
                              <button key={i} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors" onClick={() => handleSelectSuggestion(s)}>
                                {s.full_address}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="street">Straat *</Label>
                        <Input id="street" value={customerData.street} onChange={(e) => handleInputChange('street', e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="houseNumber">Huisnummer</Label>
                        <Input id="houseNumber" value={customerData.houseNumber} onChange={(e) => handleInputChange('houseNumber', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postcode *</Label>
                        <Input id="postalCode" value={customerData.postalCode} onChange={(e) => handleInputChange('postalCode', e.target.value)} required />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="city">Stad *</Label>
                        <Input id="city" value={customerData.city} onChange={(e) => handleInputChange('city', e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('checkout.country')} *</Label>
                      <Select value={customerData.country} onValueChange={(value) => handleInputChange('country', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map(c => (
                            <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  )}

                  {/* Shipping method selector */}
                  {!allGiftCards && shippingMethods.length > 1 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h3 className="font-medium flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Verzendmethode
                        </h3>
                        <RadioGroup
                          value={selectedMethodId || ''}
                          onValueChange={setSelectedMethodId}
                        >
                          {shippingMethods.map(method => {
                            const isFree = method.free_above && subtotal >= method.free_above;
                            return (
                              <div key={method.id} className="flex items-center space-x-3 border rounded-lg p-3">
                                <RadioGroupItem value={method.id} id={`shipping-${method.id}`} />
                                <Label htmlFor={`shipping-${method.id}`} className="flex-1 cursor-pointer">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <span className="font-medium">{method.name}</span>
                                      {method.estimated_days_min && method.estimated_days_max && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                          ({method.estimated_days_min}-{method.estimated_days_max} werkdagen)
                                        </span>
                                      )}
                                      {method.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{method.description}</p>
                                      )}
                                    </div>
                                    <span className="font-medium shrink-0 ml-4">
                                      {isFree ? 'Gratis' : formatPrice(method.price)}
                                    </span>
                                  </div>
                                  {method.free_above && !isFree && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Gratis vanaf {formatPrice(method.free_above)}
                                    </p>
                                  )}
                                </Label>
                              </div>
                            );
                          })}
                        </RadioGroup>
                      </div>
                    </>
                  )}
                  <Button
                    className="w-full" size="lg"
                    onClick={handleCustomerDetailsSubmit}
                    disabled={isProcessing}
                    style={{ backgroundColor: themeSettings?.primary_color || undefined }}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Bezig...</>
                    ) : enabledPaymentMethods.length === 1 ? 'Doorgaan naar betaling' : 'Kies betaalmethode'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === 'payment' && (
              <div className="space-y-6">
                <PaymentMethodSelector
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  enabledMethods={enabledPaymentMethods}
                  showTransactionFee={tenant?.pass_transaction_fee_to_customer || false}
                  transactionFeeLabel={tenant?.transaction_fee_label || 'Transactiekosten'}
                />
                <Button
                  className="w-full" size="lg"
                  onClick={handlePaymentMethodConfirm}
                  disabled={isProcessing}
                  style={{ backgroundColor: themeSettings?.primary_color || undefined }}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Bezig...</>
                  ) : paymentMethod === 'stripe' ? 'Afrekenen met iDEAL / Card' : 'Bestelling plaatsen'}
                </Button>
              </div>
            )}

            {step === 'confirmation' && bankTransferOrder && tenant && (
              <BankTransferPayment
                orderNumber={bankTransferOrder.orderNumber}
                amount={bankTransferOrder.amount}
                iban={tenant.iban || ''}
                bic={tenant.bic || undefined}
                beneficiaryName={tenant.name}
                ogmReference={bankTransferOrder.ogmReference}
                currency={tenant.currency || 'EUR'}
              />
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="hidden lg:block">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Besteloverzicht</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderSummaryContent />
              </CardContent>
            </Card>
          </div>

          {/* Mobile sticky order summary */}
          <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background border-t shadow-[0_-4px_12px_rgba(0,0,0,0.1)] p-4">
            <div className="container mx-auto flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{cartItems.length} artikel(en)</p>
                <p className="text-lg font-bold">{formatPrice(total)}</p>
                {appliedDiscount && discountAmount > 0 && (
                  <p className="text-xs text-green-600">-{formatPrice(discountAmount)} korting</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  Incl. {shipping > 0 ? formatPrice(shipping) : 'gratis'} verzending
                </p>
                {vatInfo.text && vatInfo.amount === 0 && defaultVatHandling !== 'inclusive' && (
                  <p className="text-xs text-muted-foreground">{vatInfo.text}</p>
                )}
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </ShopLayout>
  );
}
