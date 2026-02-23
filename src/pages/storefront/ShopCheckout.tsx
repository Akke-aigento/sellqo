import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Building2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { PaymentMethodSelector, type PaymentMethod } from '@/components/storefront/PaymentMethodSelector';
import { BankTransferPayment } from '@/components/storefront/BankTransferPayment';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { useCart } from '@/context/CartContext';
import { useAddressValidation } from '@/hooks/useAddressValidation';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';

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

export default function ShopCheckout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { tenant, themeSettings } = usePublicStorefront(tenantSlug || '');
  const { items: cartItems, setTenantSlug, getSubtotal, clearCart } = useCart();
  const { searchAddress, suggestions, isSearching } = useAddressValidation();
  
  const [step, setStep] = useState<CheckoutStep>('details');
  const [customerData, setCustomerData] = useState<CustomerData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
    country: 'BE',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>(['stripe']);
  const [isProcessing, setIsProcessing] = useState(false);
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

  // Read checkout config settings
  const ts = themeSettings as any;
  const phoneRequired = ts?.checkout_phone_required || false;
  const companyField = ts?.checkout_company_field || 'hidden';
  const addressAutocomplete = ts?.checkout_address_autocomplete || false;
  const guestEnabled = ts?.checkout_guest_enabled !== false; // default true

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

  // Set tenant slug for cart context
  useEffect(() => {
    if (tenantSlug) {
      setTenantSlug(tenantSlug);
    }
  }, [tenantSlug, setTenantSlug]);

  // Handle cancelled Stripe checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('cancelled') === 'true') {
      toast.info('Je betaling is geannuleerd. Probeer het opnieuw.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load tenant payment settings
  useEffect(() => {
    if (tenant?.payment_methods_enabled) {
      const methods = tenant.payment_methods_enabled as PaymentMethod[];
      setEnabledPaymentMethods(methods.length > 0 ? methods : ['stripe']);
      if (methods.length > 0 && !methods.includes(paymentMethod)) {
        setPaymentMethod(methods[0]);
      }
    }
  }, [tenant?.payment_methods_enabled]);

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: tenant?.currency || 'EUR',
    }).format(price);
  };

  const subtotal = getSubtotal();
  const shipping = subtotal > 0 ? 5.95 : 0;
  const total = subtotal + shipping;

  const handleInputChange = (field: keyof CustomerData, value: string) => {
    setCustomerData(prev => ({ ...prev, [field]: value }));
    if (field === 'street' && addressAutocomplete) {
      setAddressQuery(value);
    }
  };

  const handleSelectSuggestion = (suggestion: any) => {
    setCustomerData(prev => ({
      ...prev,
      street: suggestion.street,
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
    
    setIsProcessing(true);
    
    try {
      const formattedItems = cartItems.map(item => ({
        product_id: item.productId,
        product_name: item.name,
        product_sku: item.sku,
        product_image: item.image,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const shippingAddress = {
        street: `${customerData.street} ${customerData.houseNumber}`.trim(),
        city: customerData.city,
        postal_code: customerData.postalCode,
        country: customerData.country,
      };

      if (method === 'stripe') {
        const { data: sessionData, error } = await supabase.functions.invoke('create-checkout-session', {
          body: {
            tenant_id: tenant.id,
            items: formattedItems,
            customer_email: customerData.email,
            customer_name: `${customerData.firstName} ${customerData.lastName}`,
            customer_phone: customerData.phone,
            company_name: customerData.companyName || undefined,
            shipping_address: shippingAddress,
            billing_address: shippingAddress,
            shipping_cost: shipping,
          },
        });

        if (error) throw new Error(error.message);
        if (sessionData?.url) {
          clearCart();
          window.location.href = sessionData.url;
        }
      } else if (method === 'bank_transfer') {
        const { data: orderData, error } = await supabase.functions.invoke('create-bank-transfer-order', {
          body: {
            tenant_id: tenant.id,
            items: formattedItems,
            customer_email: customerData.email,
            customer_name: `${customerData.firstName} ${customerData.lastName}`,
            customer_phone: customerData.phone,
            company_name: customerData.companyName || undefined,
            shipping_address: shippingAddress,
            billing_address: shippingAddress,
            shipping_cost: shipping,
          },
        });

        if (error) throw new Error(error.message);
        
        clearCart();
        navigate(`/shop/${tenantSlug}/order/${orderData.order.id}`);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Er ging iets mis bij het verwerken van je bestelling');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentMethodConfirm = () => {
    handlePayment(paymentMethod);
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
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
                    <h3 className="font-medium">Verzendadres</h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2 space-y-2 relative">
                        <Label htmlFor="street">Straat *</Label>
                        <Input
                          id="street"
                          value={customerData.street}
                          onChange={(e) => handleInputChange('street', e.target.value)}
                          required
                          placeholder={addressAutocomplete ? 'Begin met typen...' : undefined}
                        />
                        {/* Address autocomplete suggestions */}
                        {addressAutocomplete && showSuggestions && suggestions.length > 0 && (
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
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleCustomerDetailsSubmit}
                    disabled={isProcessing}
                    style={{
                      backgroundColor: themeSettings?.primary_color || undefined,
                    }}
                  >
                    {enabledPaymentMethods.length === 1 ? 'Doorgaan naar betaling' : 'Kies betaalmethode'}
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
                  className="w-full"
                  size="lg"
                  onClick={handlePaymentMethodConfirm}
                  disabled={isProcessing}
                  style={{
                    backgroundColor: themeSettings?.primary_color || undefined,
                  }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Bezig...
                    </>
                  ) : paymentMethod === 'stripe' ? (
                    'Afrekenen met iDEAL / Card'
                  ) : (
                    'Bestelling plaatsen'
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
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verzending</span>
                    <span>{shipping > 0 ? formatPrice(shipping) : 'Gratis'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Totaal</span>
                  <span>{formatPrice(total)}</span>
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