import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Upload, Save, Landmark, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useInvoiceCompliance, validateIBAN, formatIBAN } from '@/hooks/useInvoiceCompliance';
import { supabase } from '@/integrations/supabase/client';

// Verhuisd uit StoreSettings (WEBSHOP-4b).
const CURRENCIES = [
  { code: 'EUR', name: 'Euro (€)', symbol: '€' },
  { code: 'USD', name: 'US Dollar ($)', symbol: '$' },
  { code: 'GBP', name: 'Brits Pond (£)', symbol: '£' },
];

// EU countries for VAT purposes
const EU_COUNTRIES = [
  { code: 'NL', name: 'Nederland' },
  { code: 'BE', name: 'België' },
  { code: 'DE', name: 'Duitsland' },
  { code: 'FR', name: 'Frankrijk' },
  { code: 'LU', name: 'Luxemburg' },
  { code: 'AT', name: 'Oostenrijk' },
  { code: 'IT', name: 'Italië' },
  { code: 'ES', name: 'Spanje' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IE', name: 'Ierland' },
  { code: 'FI', name: 'Finland' },
  { code: 'SE', name: 'Zweden' },
  { code: 'DK', name: 'Denemarken' },
  { code: 'PL', name: 'Polen' },
  { code: 'CZ', name: 'Tsjechië' },
  { code: 'SK', name: 'Slowakije' },
  { code: 'HU', name: 'Hongarije' },
  { code: 'RO', name: 'Roemenië' },
  { code: 'BG', name: 'Bulgarije' },
  { code: 'GR', name: 'Griekenland' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'MT', name: 'Malta' },
  { code: 'EE', name: 'Estland' },
  { code: 'LV', name: 'Letland' },
  { code: 'LT', name: 'Litouwen' },
  { code: 'SI', name: 'Slovenië' },
  { code: 'HR', name: 'Kroatië' },
];

export function BusinessSettings() {
  const { t } = useTranslation();
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const { uploadImage, uploading } = useImageUpload();
  const { isCompliant, errorCount } = useInvoiceCompliance();
  const [isSaving, setIsSaving] = useState(false);
  const [ibanError, setIbanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentTenant) return;

    const url = await uploadImage(file, 'tenant-logos', `${currentTenant.id}/logo`);
    
    if (url) {
      // Update tenant with new logo URL
      const { error } = await supabase
        .from('tenants')
        .update({ logo_url: url })
        .eq('id', currentTenant.id);

      if (error) {
        toast({
          title: t('settings.business.logoErrorTitle'),
          description: error.message,
          variant: 'destructive',
        });
      } else {
        await refreshTenants();
        toast({
          title: t('settings.business.logoSavedTitle'),
          description: t('settings.business.logoSavedBody'),
        });
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'NL',
    kvk_number: '',
    btw_number: '',
    iban: '',
    bic: '',
    // Verhuisd uit Winkelinstellingen (WEBSHOP-4b).
    currency: 'EUR',
  });

  useEffect(() => {
    if (currentTenant) {
      const tenantData = currentTenant as any;
      setFormData({
        name: currentTenant.name || '',
        owner_name: currentTenant.owner_name || '',
        phone: currentTenant.phone || '',
        address: currentTenant.address || '',
        city: currentTenant.city || '',
        postal_code: currentTenant.postal_code || '',
        country: currentTenant.country || 'NL',
        kvk_number: currentTenant.kvk_number || '',
        btw_number: currentTenant.btw_number || '',
        iban: tenantData.iban || '',
        bic: tenantData.bic || '',
        currency: currentTenant.currency || 'EUR',
      });
    }
  }, [currentTenant]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Validate IBAN when it changes
    if (field === 'iban') {
      if (value && !validateIBAN(value)) {
        setIbanError('Ongeldig IBAN formaat');
      } else {
        setIbanError(null);
      }
    }
  };

  const handleSave = async () => {
    if (!currentTenant) return;
    
    // Validate IBAN before saving
    if (formData.iban && !validateIBAN(formData.iban)) {
      toast({
        title: t('settings.business.ibanInvalidTitle'),
        description: t('settings.business.ibanInvalidBody'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          owner_name: formData.owner_name,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          postal_code: formData.postal_code,
          country: formData.country,
          kvk_number: formData.kvk_number,
          btw_number: formData.btw_number,
          iban: formData.iban.replace(/\s/g, '').toUpperCase() || null,
          bic: formData.bic.toUpperCase() || null,
          currency: formData.currency,
        })
        .eq('id', currentTenant.id);

      if (error) throw error;

      await refreshTenants();
      
      toast({
        title: t('settings.business.savedTitle'),
        description: t('settings.business.savedBody'),
      });
    } catch (error: any) {
      toast({
        title: t('settings.business.saveErrorTitle'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>{t('settings.sections.company')}</CardTitle>
            <CardDescription>
              {t('settings.business.subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Compliance warning */}
        {!isCompliant && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Er ontbreken {errorCount} verplichte velden voor Belgische factuur compliance. 
              {t('settings.business.requiredFieldsAlert')}
            </AlertDescription>
          </Alert>
        )}

        {/* Logo section */}
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 rounded-lg">
            <AvatarImage src={currentTenant?.logo_url || ''} />
            <AvatarFallback className="rounded-lg text-lg">
              {currentTenant?.name?.charAt(0) || 'W'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{t('settings.business.storeLogo')}</p>
            <p className="text-sm text-muted-foreground mb-2">
              {t('settings.business.logoHint')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? 'Uploaden...' : 'Logo uploaden'}
            </Button>
          </div>
        </div>

        {/* Form fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="name">{t('settings.business.storeName')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('settings.business.storeNamePlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="owner_name">{t('settings.business.ownerName')}</Label>
            <Input
              id="owner_name"
              value={formData.owner_name}
              onChange={(e) => handleChange('owner_name', e.target.value)}
              placeholder={t('settings.business.ownerNamePlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">{t('settings.business.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+31 6 12345678"
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="address">{t('settings.business.address')}</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder={t('settings.business.addressPlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="postal_code">{t('settings.business.postalCode')}</Label>
            <Input
              id="postal_code"
              value={formData.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              placeholder={t('settings.business.postalCodePlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="city">{t('settings.business.city')}</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder={t('settings.business.cityPlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="country">{t('settings.business.country')}</Label>
            <Select
              value={formData.country}
              onValueChange={(value) => handleChange('country', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('settings.business.countryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {EU_COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('settings.business.countryHint')}
            </p>
          </div>

          {/* Valuta — verhuisd uit Winkelinstellingen (WEBSHOP-4b). Staat naast
              Land omdat het dezelfde soort keuze is: waar je onderneemt. */}
          <div className="grid gap-2">
            <Label htmlFor="currency">{t('settings.business.currency')}</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => handleChange('currency', value)}
            >
              <SelectTrigger id="currency">
                <SelectValue placeholder={t('settings.business.currencyPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('settings.business.currencyHint')}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="kvk_number">{t('settings.business.enterpriseNumber')}</Label>
            <Input
              id="kvk_number"
              value={formData.kvk_number}
              onChange={(e) => handleChange('kvk_number', e.target.value)}
              placeholder={t('settings.business.enterpriseNumberPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {formData.country === 'BE' ? 'KBO-nummer' : 'KvK-nummer'}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="btw_number">{t('settings.business.vatNumber')}</Label>
            <Input
              id="btw_number"
              value={formData.btw_number}
              onChange={(e) => handleChange('btw_number', e.target.value)}
              placeholder={formData.country === 'BE' ? 'BE0123456789' : 'NL123456789B01'}
            />
          </div>
        </div>

        {/* Bank Account Section */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="h-5 w-5 text-primary" />
            <h4 className="font-semibold">{t('settings.business.bankDetails')}</h4>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="iban">{t('settings.business.iban')}</Label>
              <Input
                id="iban"
                value={formatIBAN(formData.iban)}
                onChange={(e) => handleChange('iban', e.target.value.replace(/\s/g, ''))}
                placeholder={t('settings.business.ibanPlaceholder')}
                className={ibanError ? 'border-destructive' : ''}
              />
              {ibanError && (
                <p className="text-xs text-destructive">{ibanError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('settings.business.ibanHint')}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bic">{t('settings.business.bic')}</Label>
              <Input
                id="bic"
                value={formData.bic}
                onChange={(e) => handleChange('bic', e.target.value.toUpperCase())}
                placeholder="ABNANL2A"
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.business.bicHint')}
              </p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Opslaan...' : 'Wijzigingen opslaan'}
        </Button>
      </CardContent>
    </Card>
  );
}
