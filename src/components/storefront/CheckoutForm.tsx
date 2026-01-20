import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, User, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// EU countries for dropdown
const EU_COUNTRIES = [
  { code: 'AT', name: 'Oostenrijk' },
  { code: 'BE', name: 'België' },
  { code: 'BG', name: 'Bulgarije' },
  { code: 'HR', name: 'Kroatië' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Tsjechië' },
  { code: 'DK', name: 'Denemarken' },
  { code: 'EE', name: 'Estland' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'Frankrijk' },
  { code: 'DE', name: 'Duitsland' },
  { code: 'GR', name: 'Griekenland' },
  { code: 'HU', name: 'Hongarije' },
  { code: 'IE', name: 'Ierland' },
  { code: 'IT', name: 'Italië' },
  { code: 'LV', name: 'Letland' },
  { code: 'LT', name: 'Litouwen' },
  { code: 'LU', name: 'Luxemburg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Nederland' },
  { code: 'PL', name: 'Polen' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Roemenië' },
  { code: 'SK', name: 'Slowakije' },
  { code: 'SI', name: 'Slovenië' },
  { code: 'ES', name: 'Spanje' },
  { code: 'SE', name: 'Zweden' },
];

const NON_EU_COUNTRIES = [
  { code: 'US', name: 'Verenigde Staten' },
  { code: 'GB', name: 'Verenigd Koninkrijk' },
  { code: 'CH', name: 'Zwitserland' },
  { code: 'NO', name: 'Noorwegen' },
  // Add more as needed
];

const ALL_COUNTRIES = [...EU_COUNTRIES, ...NON_EU_COUNTRIES];

interface VatPreview {
  type: 'standard' | 'reverse_charge' | 'export' | 'oss' | 'exempt';
  rate: number;
  amount: number;
  text: string | null;
}

interface CheckoutFormProps {
  tenantId: string;
  subtotal: number;
  shippingCost: number;
  tenantCountry?: string;
  tenantVatRate?: number;
  ossEnabled?: boolean;
  ossThresholdReached?: boolean;
  onCustomerDataChange?: (data: CustomerFormData) => void;
}

export interface CustomerFormData {
  customer_type: 'b2b' | 'b2c';
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company_name?: string;
  vat_number?: string;
  billing_address: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
  };
}

// EU VAT rates by country
const EU_VAT_RATES: Record<string, number> = {
  'AT': 20, 'BE': 21, 'BG': 20, 'HR': 25, 'CY': 19, 'CZ': 21,
  'DK': 25, 'EE': 22, 'FI': 25.5, 'FR': 20, 'DE': 19, 'GR': 24,
  'HU': 27, 'IE': 23, 'IT': 22, 'LV': 21, 'LT': 21, 'LU': 17,
  'MT': 18, 'NL': 21, 'PL': 23, 'PT': 23, 'RO': 19, 'SK': 20,
  'SI': 22, 'ES': 21, 'SE': 25
};

export function CheckoutForm({
  tenantId,
  subtotal,
  shippingCost,
  tenantCountry = 'BE',
  tenantVatRate = 21,
  ossEnabled = false,
  ossThresholdReached = false,
  onCustomerDataChange,
}: CheckoutFormProps) {
  const { t } = useTranslation();
  
  const [customerType, setCustomerType] = useState<'b2b' | 'b2c'>('b2c');
  const [formData, setFormData] = useState<CustomerFormData>({
    customer_type: 'b2c',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    vat_number: '',
    billing_address: {
      street: '',
      city: '',
      postal_code: '',
      country: tenantCountry,
    },
  });
  
  const [vatValidation, setVatValidation] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    companyName?: string;
  }>({ status: 'idle' });
  
  const [vatPreview, setVatPreview] = useState<VatPreview | null>(null);

  // Calculate VAT preview when relevant fields change
  useEffect(() => {
    const preview = calculateVatPreview();
    setVatPreview(preview);
    
    // Notify parent of form data changes
    if (onCustomerDataChange) {
      onCustomerDataChange({
        ...formData,
        customer_type: customerType,
      });
    }
  }, [customerType, formData.billing_address.country, formData.vat_number, vatValidation.status, subtotal, shippingCost]);

  const calculateVatPreview = (): VatPreview => {
    const customerCountry = formData.billing_address.country.toUpperCase();
    const isEuCountry = EU_COUNTRIES.some(c => c.code === customerCountry);
    const isSameCountry = tenantCountry.toUpperCase() === customerCountry;
    const totalAmount = subtotal + shippingCost;

    // Same country - always standard VAT
    if (isSameCountry) {
      return {
        type: 'standard',
        rate: tenantVatRate,
        amount: Math.round(totalAmount * (tenantVatRate / 100) * 100) / 100,
        text: null,
      };
    }

    // Export outside EU - 0% VAT
    if (!isEuCountry) {
      return {
        type: 'export',
        rate: 0,
        amount: 0,
        text: 'Export levering - vrijgesteld van BTW',
      };
    }

    // B2B in other EU country with valid VAT - Reverse Charge
    if (customerType === 'b2b' && vatValidation.status === 'valid') {
      return {
        type: 'reverse_charge',
        rate: 0,
        amount: 0,
        text: 'BTW verlegd naar afnemer (Art. 196 BTW-richtlijn)',
      };
    }

    // B2C in other EU country with OSS
    if (customerType === 'b2c' && ossEnabled && ossThresholdReached) {
      const destinationRate = EU_VAT_RATES[customerCountry] || tenantVatRate;
      return {
        type: 'oss',
        rate: destinationRate,
        amount: Math.round(totalAmount * (destinationRate / 100) * 100) / 100,
        text: `BTW-tarief ${customerCountry}: ${destinationRate}%`,
      };
    }

    // Default - seller's VAT rate
    return {
      type: 'standard',
      rate: tenantVatRate,
      amount: Math.round(totalAmount * (tenantVatRate / 100) * 100) / 100,
      text: null,
    };
  };

  const handleVatValidation = async () => {
    const vatNumber = formData.vat_number?.trim();
    if (!vatNumber || vatNumber.length < 5) {
      setVatValidation({ status: 'idle' });
      return;
    }

    setVatValidation({ status: 'validating' });

    try {
      const { data, error } = await supabase.functions.invoke('validate-vat', {
        body: { vat_number: vatNumber },
      });

      if (error) throw error;

      if (data?.valid) {
        setVatValidation({
          status: 'valid',
          companyName: data.name,
        });
        // Auto-fill company name if empty
        if (!formData.company_name && data.name) {
          setFormData(prev => ({ ...prev, company_name: data.name }));
        }
        toast.success('BTW-nummer geverifieerd');
      } else {
        setVatValidation({ status: 'invalid' });
        toast.error('BTW-nummer niet geldig');
      }
    } catch (error) {
      console.error('VAT validation error:', error);
      setVatValidation({ status: 'invalid' });
      toast.error('Fout bij valideren BTW-nummer');
    }
  };

  const updateFormField = (field: string, value: string) => {
    if (field.startsWith('billing_address.')) {
      const addressField = field.replace('billing_address.', '');
      setFormData(prev => ({
        ...prev,
        billing_address: {
          ...prev.billing_address,
          [addressField]: value,
        },
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Customer Type Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Klanttype</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant={customerType === 'b2c' ? 'default' : 'outline'}
              onClick={() => {
                setCustomerType('b2c');
                setVatValidation({ status: 'idle' });
              }}
              className="flex-1"
            >
              <User className="h-4 w-4 mr-2" />
              Particulier
            </Button>
            <Button
              type="button"
              variant={customerType === 'b2b' ? 'default' : 'outline'}
              onClick={() => setCustomerType('b2b')}
              className="flex-1"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Zakelijk
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* B2B Fields */}
      {customerType === 'b2b' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Bedrijfsgegevens</CardTitle>
            <CardDescription>Vul uw bedrijfsgegevens in voor BTW-facturatie</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bedrijfsnaam *</Label>
              <Input
                value={formData.company_name}
                onChange={e => updateFormField('company_name', e.target.value)}
                placeholder="Uw bedrijfsnaam"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>BTW-nummer</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.vat_number}
                  onChange={e => {
                    updateFormField('vat_number', e.target.value.toUpperCase());
                    setVatValidation({ status: 'idle' });
                  }}
                  placeholder="BE0123456789"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleVatValidation}
                  disabled={vatValidation.status === 'validating' || !formData.vat_number}
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
                  <span>BTW-nummer geverifieerd{vatValidation.companyName && `: ${vatValidation.companyName}`}</span>
                </div>
              )}
              
              {vatValidation.status === 'invalid' && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>BTW-nummer niet geldig of niet gevonden</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Contactgegevens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Voornaam *</Label>
              <Input
                value={formData.first_name}
                onChange={e => updateFormField('first_name', e.target.value)}
                placeholder="Jan"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Achternaam *</Label>
              <Input
                value={formData.last_name}
                onChange={e => updateFormField('last_name', e.target.value)}
                placeholder="Jansen"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>E-mailadres *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={e => updateFormField('email', e.target.value)}
              placeholder="jan@voorbeeld.nl"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Telefoonnummer</Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={e => updateFormField('phone', e.target.value)}
              placeholder="+31 6 12345678"
            />
          </div>
        </CardContent>
      </Card>

      {/* Billing Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Factuuradres</CardTitle>
          <CardDescription>Dit adres bepaalt het toepasselijke BTW-tarief</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Straat en huisnummer *</Label>
            <Input
              value={formData.billing_address.street}
              onChange={e => updateFormField('billing_address.street', e.target.value)}
              placeholder="Voorbeeldstraat 123"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Postcode *</Label>
              <Input
                value={formData.billing_address.postal_code}
                onChange={e => updateFormField('billing_address.postal_code', e.target.value)}
                placeholder="1000 AA"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Plaats *</Label>
              <Input
                value={formData.billing_address.city}
                onChange={e => updateFormField('billing_address.city', e.target.value)}
                placeholder="Amsterdam"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Land *</Label>
            <Select
              value={formData.billing_address.country}
              onValueChange={value => updateFormField('billing_address.country', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer land" />
              </SelectTrigger>
              <SelectContent>
                {ALL_COUNTRIES.map(country => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* VAT Preview */}
      {vatPreview && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotaal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              
              {shippingCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Verzending</span>
                  <span>{formatCurrency(shippingCost)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  BTW ({vatPreview.rate}%)
                  {vatPreview.type === 'reverse_charge' && (
                    <Badge variant="secondary" className="text-xs">Verlegd</Badge>
                  )}
                  {vatPreview.type === 'export' && (
                    <Badge variant="secondary" className="text-xs">Export</Badge>
                  )}
                  {vatPreview.type === 'oss' && (
                    <Badge variant="secondary" className="text-xs">OSS</Badge>
                  )}
                </span>
                <span>{formatCurrency(vatPreview.amount)}</span>
              </div>
              
              <div className="border-t pt-3 flex justify-between font-semibold">
                <span>Totaal</span>
                <span>{formatCurrency(subtotal + shippingCost + vatPreview.amount)}</span>
              </div>
              
              {vatPreview.text && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{vatPreview.text}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CheckoutForm;
