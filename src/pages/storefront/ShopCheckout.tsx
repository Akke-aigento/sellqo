import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Building2, LogIn, Search } from 'lucide-react';
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

type CheckoutStep = 'details' | 'payment' | 'confirmation';

interface CustomerData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
}

// ── Helper: call storefront-api edge function ──
async function storefrontApi(tenantId: string, action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('storefront-api', {
    body: { action, tenant_id: tenantId, params },
  });
  if (error) {
    const body = await error.context?.json?.().catch(() => null);
    throw new Error(body?.error?.message || body?.error || error.message);
  }
  if (data?.success === false) {
    throw new Error(data.error?.message || data.error || 'Onbekende fout');
  }
  return data;
}

// Session-id for server-side cart (persists per browser tab session)
function getSessionId(): string {
  const key = 'sellqo_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function ShopCheckout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { tenant, themeSettings } = usePublicStorefront(tenantSlug || '');
  const { items: cartItems, setTenantSlug, getSubtotal, clearCart } = useCart();
  const { searchAddress, suggestions, isSearching } = useAddressValidation();
  const { t } = useTranslation();

  const [step, setStep] = useState<CheckoutStep>('details');
  const [customerData, setCustomerData] = useState<CustomerData>({
    email: '', firstName: '', lastName: '', phone: '', companyName: '',
    street: '', houseNumber: '', postalCode: '', city: '', country: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>(['card']);
  const [isProcessing, setIsProcessing] = useState(false);
  const submittingRef = useRef(false);
  const [bankTransferOrder, setBankTransferOrder] = useState<{
    orderId: string; orderNumber: string; ogmReference: string; amount: number;
  } | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authProcessing, setAuthProcessing] = useState(false);

  // Server-side cart state
  const [serverCartId, setServerCartId] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [selectedFee, setSelectedFee] = useState<{ fee_cents: number; fee_label: string } | null>(null);

  // Read checkout config settings
  const ts = themeSettings as any;
  const phoneRequired = ts?.checkout_phone_required || false;
  const companyField = ts?.checkout_company_field || 'hidden';
  const addressAutocomplete = ts?.checkout_address_autocomplete || false;
  const guestEnabled = ts?.checkout_guest_enabled !== false;

  // Check auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
      if (session?.user) {
        setCustomerData(prev => ({ ...prev, email: prev.email || session.user.email || '' }));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Set tenant slug for cart context
  useEffect(() => {
    if (tenantSlug) setTenantSlug(tenantSlug);
  }, [tenantSlug, setTenantSlug]);

  // Handle cancelled Stripe checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('cancelled') === 'true') {
      toast.info('Je betaling is geannuleerd. Probeer het opnieuw.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Build enabled payment methods from tenant config
  useEffect(() => {
    if (!tenant) return;
    const rawMethods = (tenant.payment_methods_enabled || []) as string[];
    const stripeSubMethods: PaymentMethod[] = ((tenant as any).stripe_payment_methods || ['card', 'ideal', 'bancontact']) as PaymentMethod[];
    const methods: PaymentMethod[] = [];
    if (rawMethods.includes('stripe')) methods.push(...stripeSubMethods);
    for (const m of rawMethods) {
      if (['card', 'ideal', 'bancontact', 'klarna'].includes(m) && !methods.includes(m as PaymentMethod)) {
        methods.push(m as PaymentMethod);
      }
    }
    if (rawMethods.includes('bank_transfer')) methods.push('bank_transfer');
    const final = methods.length > 0 ? methods : ['card' as PaymentMethod];
    setEnabledPaymentMethods(final);
    if (!final.includes(paymentMethod)) setPaymentMethod(final[0]);
  }, [tenant]);

  // Set default country from tenant
  useEffect(() => {
    if (tenant?.country && !customerData.country) {
      setCustomerData(prev => ({ ...prev, country: tenant.country || 'BE' }));
    }
  }, [tenant]);

  // Address autocomplete debounce
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

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: tenant?.currency || 'EUR' }).format(price);

  const subtotal = getSubtotal();

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

  const validateForm = (): boolean => {
    if (!customerData.email || !customerData.firstName || !customerData.lastName) {
      toast.error('Vul alle verplichte velden in');
      return false;
    }
    if (phoneRequired && !customerData.phone.trim()) {
      toast.error('Telefoonnummer is verplicht');
      return false;
    }
    if (companyField === 'required' && !customerData.companyName.trim()) {
      toast.error('Bedrijfsnaam is verplicht');
      return false;
    }
    if (!customerData.street || !customerData.postalCode || !customerData.city) {
      toast.error('Vul je adresgegevens in');
      return false;
    }
    return true;
  };

  // ── CANONICAL CHECKOUT FLOW ──

  // Step 1: Create server cart + sync items + start checkout + save customer + address
  const initServerCart = useCallback(async (): Promise<string> => {
    if (!tenant) throw new Error('Tenant niet geladen');

    // Create or get server-side cart
    const sessionId = getSessionId();
    const cartResult = await storefrontApi(tenant.id, 'cart_create', {
      session_id: sessionId,
      currency: tenant.currency || 'EUR',
    });
    const cartId = cartResult.cart_id;

    // Clear existing items and add current cart items
    // First get current server cart to avoid duplicates
    const existingCart = await storefrontApi(tenant.id, 'cart_get', { cart_id: cartId });
    const existingItems = existingCart?.items || [];
    
    // Remove all existing items
    for (const item of existingItems) {
      await storefrontApi(tenant.id, 'cart_remove_item', { cart_id: cartId, item_id: item.id });
    }

    // Add all current client-side items
    for (const item of cartItems) {
      await storefrontApi(tenant.id, 'cart_add_item', {
        cart_id: cartId,
        product_id: item.productId,
        variant_id: item.variantId || undefined,
        quantity: item.quantity,
      });
    }

    return cartId;
  }, [tenant, cartItems]);

  const handleCustomerDetailsSubmit = async () => {
    if (!validateForm()) return;
    if (!tenant) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsProcessing(true);

    try {
      // 1. Create/sync server cart
      const cartId = await initServerCart();
      setServerCartId(cartId);

      // 2. Start checkout
      const startData = await storefrontApi(tenant.id, 'checkout_start', { cart_id: cartId });
      setCheckoutData(startData);

      // 3. Save customer data
      await storefrontApi(tenant.id, 'checkout_customer', {
        cart_id: cartId,
        customer: {
          email: customerData.email,
          first_name: customerData.firstName,
          last_name: customerData.lastName,
          phone: customerData.phone || undefined,
        },
      });

      // 4. Save address
      const shippingAddress = {
        street: `${customerData.street} ${customerData.houseNumber}`.trim(),
        city: customerData.city,
        postal_code: customerData.postalCode,
        country: customerData.country,
      };
      await storefrontApi(tenant.id, 'checkout_address', {
        cart_id: cartId,
        shipping_address: shippingAddress,
        billing_same_as_shipping: true,
      });

      // If only 1 payment method, go straight to payment
      if (enabledPaymentMethods.length === 1) {
        setPaymentMethod(enabledPaymentMethods[0]);
        await handleSelectAndComplete(cartId, enabledPaymentMethods[0]);
      } else {
        // Show payment method selection step
        setStep('payment');
      }
    } catch (error: any) {
      console.error('Checkout init error:', error);
      toast.error(error.message || 'Er ging iets mis bij het starten van de checkout');
    } finally {
      submittingRef.current = false;
      setIsProcessing(false);
    }
  };

  // Handle payment method change — call checkout_select_payment_method to get fee info
  const handlePaymentMethodChange = async (method: PaymentMethod) => {
    setPaymentMethod(method);
    if (!serverCartId || !tenant) return;

    try {
      const result = await storefrontApi(tenant.id, 'checkout_select_payment_method', {
        cart_id: serverCartId,
        payment_method: method,
      });
      // Update full checkout data from server response (includes shipping, totals, etc.)
      setCheckoutData(result);
      setSelectedFee({ fee_cents: result.fee?.amount ? Math.round(result.fee.amount * 100) : 0, fee_label: result.fee?.label || result.fee_label || 'Transactiekosten' });
    } catch (err: any) {
      console.warn('Payment method select error:', err.message);
      // Non-blocking — user can still proceed
    }
  };

  // Select payment method + complete checkout in one go
  const handleSelectAndComplete = async (cartId: string, method: PaymentMethod) => {
    if (!tenant) return;
    setIsProcessing(true);

    try {
      // Select payment method (saves fee on cart)
      await storefrontApi(tenant.id, 'checkout_select_payment_method', {
        cart_id: cartId,
        payment_method: method,
      });

      // Build URLs
      const origin = window.location.origin;
      const successUrl = `${origin}/shop/${tenantSlug}/order/{{ORDER_ID}}?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/shop/${tenantSlug}/checkout?cancelled=true`;

      // Complete checkout
      const result = await storefrontApi(tenant.id, 'checkout_complete', {
        cart_id: cartId,
        payment_method: method,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      clearCart();

      if (result.payment_type === 'redirect' && result.checkout_url) {
        // Stripe redirect
        window.location.href = result.checkout_url;
      } else if (result.payment_type === 'qr') {
        // Bank transfer — navigate to QR payment page
        navigate(`/shop/${tenantSlug}/checkout/qr-betaling`, {
          state: {
            orderId: result.order_id,
            orderNumber: result.order_number,
            total: result.total,
            currency: result.currency || 'EUR',
            bankDetails: result.bank_details,
          },
        });
      }
    } catch (error: any) {
      console.error('Checkout complete error:', error);
      toast.error(error.message || 'Er ging iets mis bij het verwerken van je bestelling');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentMethodConfirm = () => {
    if (!serverCartId) {
      toast.error('Checkout sessie verlopen, probeer opnieuw');
      setStep('details');
      return;
    }
    handleSelectAndComplete(serverCartId, paymentMethod);
  };

  // Empty cart redirect
  if (cartItems.length === 0 && step === 'details' && !bankTransferOrder) {
    return (
      <ShopLayout>
        <Helmet>
          <title>Afrekenen | {tenant?.name || 'Shop'}</title>
        </Helmet>
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
      <Helmet>
        <title>Afrekenen | {tenant?.name || 'Shop'}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8">
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
                  <Input
                    type="email"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    placeholder="je@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wachtwoord</Label>
                  <Input
                    type="password"
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                  />
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
                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                >
                  {authMode === 'login' ? 'Nog geen account? Registreer' : 'Al een account? Log in'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
        <>
        {/* Back Button */}
        {step !== 'confirmation' && (
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => step === 'payment' ? setStep('details') : navigate(`/shop/${tenantSlug}/cart`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 'payment' ? 'Terug naar gegevens' : 'Terug naar winkelwagen'}
          </Button>
        )}

        <div className="grid md:grid-cols-3 gap-4 sm:gap-8">
          {/* Main Content */}
          <div className="md:col-span-2">
            {step === 'details' && (
              <Card>
                <CardHeader>
                  <CardTitle>Je gegevens</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Contact Info */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Contactgegevens</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mailadres *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={customerData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">
                          Telefoonnummer {phoneRequired ? '*' : ''}
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={customerData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          required={phoneRequired}
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Voornaam *</Label>
                        <Input
                          id="firstName"
                          value={customerData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Achternaam *</Label>
                        <Input
                          id="lastName"
                          value={customerData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Company field - conditionally shown */}
                  {companyField !== 'hidden' && (
                    <>
                      <Separator />
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
                    </>
                  )}

                  <Separator />

                  {/* Address */}
                  <div className="space-y-4">
                    <h3 className="font-medium">{t('checkout.shippingAddress')}</h3>

                    {/* Separate address search bar */}
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
                              <button
                                key={i}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                                onClick={() => handleSelectSuggestion(s)}
                              >
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
                        <Input
                          id="street"
                          value={customerData.street}
                          onChange={(e) => handleInputChange('street', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="houseNumber">Huisnummer</Label>
                        <Input
                          id="houseNumber"
                          value={customerData.houseNumber}
                          onChange={(e) => handleInputChange('houseNumber', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postcode *</Label>
                        <Input
                          id="postalCode"
                          value={customerData.postalCode}
                          onChange={(e) => handleInputChange('postalCode', e.target.value)}
                          required
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="city">Stad *</Label>
                        <Input
                          id="city"
                          value={customerData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    {/* Country selector */}
                    <div className="space-y-2">
                      <Label>{t('checkout.country')} *</Label>
                      <Select
                        value={customerData.country}
                        onValueChange={(value) => handleInputChange('country', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BE">België</SelectItem>
                          <SelectItem value="NL">Nederland</SelectItem>
                          <SelectItem value="DE">Deutschland</SelectItem>
                          <SelectItem value="FR">France</SelectItem>
                          <SelectItem value="LU">Luxembourg</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleCustomerDetailsSubmit}
                    disabled={isProcessing}
                    style={{ backgroundColor: themeSettings?.primary_color || undefined }}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Bezig...
                      </>
                    ) : enabledPaymentMethods.length === 1 ? 'Doorgaan naar betaling' : 'Kies betaalmethode'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === 'payment' && (
              <div className="space-y-6">
                <PaymentMethodSelector
                  value={paymentMethod}
                  onChange={handlePaymentMethodChange}
                  enabledMethods={enabledPaymentMethods}
                  stripePaymentMethods={(tenant as any)?.stripe_payment_methods || ['card', 'ideal', 'bancontact']}
                  showTransactionFee={tenant?.pass_transaction_fee_to_customer || false}
                  transactionFeeLabel={selectedFee?.fee_label || tenant?.transaction_fee_label || 'Transactiekosten'}
                />

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePaymentMethodConfirm}
                  disabled={isProcessing}
                  style={{ backgroundColor: themeSettings?.primary_color || undefined }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Bezig...
                    </>
                  ) : paymentMethod === 'bank_transfer' ? (
                    'Bestelling plaatsen'
                  ) : (
                    `Afrekenen met ${paymentMethod === 'ideal' ? 'iDEAL' : paymentMethod === 'card' ? 'Creditcard' : paymentMethod === 'bancontact' ? 'Bancontact' : paymentMethod === 'klarna' ? 'Klarna' : 'Online betaling'}`
                  )}
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
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Besteloverzicht</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Items */}
                <div className="space-y-3 mb-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.name}
                      </span>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotaal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {selectedFee && selectedFee.fee_cents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{selectedFee.fee_label}</span>
                      <span>{formatPrice(selectedFee.fee_cents / 100)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verzending</span>
                    <span>
                      {checkoutData?.shipping_display_state === 'charged'
                        ? formatPrice(checkoutData.shipping_cost)
                        : checkoutData?.shipping_display_state === 'free'
                          ? 'Gratis'
                          : <span className="text-muted-foreground">Wordt berekend</span>}
                    </span>
                  </div>
                  {checkoutData?.discount_total > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Korting</span>
                      <span>-{formatPrice(checkoutData.discount_total)}</span>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Totaal</span>
                  <span>{formatPrice(checkoutData?.total ?? (subtotal + (selectedFee?.fee_cents || 0) / 100))}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </>
        )}
      </div>
    </ShopLayout>
  );
}
