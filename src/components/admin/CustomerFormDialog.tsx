import { useState, useEffect } from 'react';
import { UserPlus, Building2, User, MapPin, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { VatInput } from './VatInput';
import { AddressInput } from './AddressInput';
import { useTenant } from '@/hooks/useTenant';
import type { Customer } from '@/types/order';
import { useTranslation } from 'react-i18next';

interface CustomerFormData {
  customer_type: 'b2c' | 'b2b';
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  vat_number?: string;
  vat_verified?: boolean;
  peppol_id?: string;
  billing_street?: string;
  billing_city?: string;
  billing_postal_code?: string;
  billing_country?: string;
  shipping_street?: string;
  shipping_city?: string;
  shipping_postal_code?: string;
  shipping_country?: string;
}

interface CustomerFormDialogProps {
  onSubmit: (data: CustomerFormData) => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
  customer?: Customer | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CustomerFormDialog({
  onSubmit,
  isLoading,
  mode = 'create',
  customer,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CustomerFormDialogProps) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    controlledOnOpenChange?.(next);
  };
  const [formData, setFormData] = useState<CustomerFormData>({
    customer_type: 'b2c',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    vat_number: '',
    vat_verified: false,
    peppol_id: '',
    billing_street: '',
    billing_city: '',
    billing_postal_code: '',
    billing_country: currentTenant?.country || 'NL',
    shipping_street: '',
    shipping_city: '',
    shipping_postal_code: '',
    shipping_country: '',
  });
  const [differentShipping, setDifferentShipping] = useState(false);

  // Update default country when tenant loads
  useEffect(() => {
    if (currentTenant?.country && !formData.billing_street) {
      setFormData(prev => ({
        ...prev,
        billing_country: prev.billing_country || currentTenant.country,
      }));
    }
  }, [currentTenant?.country]);

  // Prefill form data when editing an existing customer (or when the customer changes)
  useEffect(() => {
    if (mode !== 'edit' || !customer || !open) return;
    const type: 'b2c' | 'b2b' = customer.customer_type === 'b2b' ? 'b2b' : 'b2c';
    setFormData({
      customer_type: type,
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      company_name: customer.company_name || '',
      vat_number: customer.vat_number || '',
      vat_verified: Boolean(customer.vat_verified),
      peppol_id: (customer as any).peppol_id || '',
      billing_street: customer.billing_street || '',
      billing_city: customer.billing_city || '',
      billing_postal_code: customer.billing_postal_code || '',
      billing_country: customer.billing_country || currentTenant?.country || 'NL',
      shipping_street: customer.shipping_street || '',
      shipping_city: customer.shipping_city || '',
      shipping_postal_code: customer.shipping_postal_code || '',
      shipping_country: customer.shipping_country || '',
    });
    setDifferentShipping(
      Boolean(
        customer.shipping_street ||
        customer.shipping_city ||
        customer.shipping_postal_code
      )
    );
  }, [mode, customer, open, currentTenant?.country]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData: CustomerFormData = {
      ...formData,
      company_name: formData.customer_type === 'b2b' ? formData.company_name : undefined,
      vat_number: formData.customer_type === 'b2b' ? formData.vat_number : undefined,
      vat_verified: formData.customer_type === 'b2b' ? formData.vat_verified : undefined,
      peppol_id: formData.customer_type === 'b2b' ? formData.peppol_id : undefined,
      shipping_street: differentShipping ? formData.shipping_street : undefined,
      shipping_city: differentShipping ? formData.shipping_city : undefined,
      shipping_postal_code: differentShipping ? formData.shipping_postal_code : undefined,
      shipping_country: differentShipping ? formData.shipping_country : undefined,
    };
    
    onSubmit(submitData);
    if (mode === 'create') resetForm();
    setOpen(false);
  };

  const resetForm = () => {
    setFormData({
      customer_type: 'b2c',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company_name: '',
      vat_number: '',
      vat_verified: false,
      peppol_id: '',
      billing_street: '',
      billing_city: '',
      billing_postal_code: '',
      billing_country: currentTenant?.country || 'NL',
      shipping_street: '',
      shipping_city: '',
      shipping_postal_code: '',
      shipping_country: '',
    });
    setDifferentShipping(false);
  };

  const handleVatValidated = (result: { valid: boolean; company_name?: string | null }) => {
    setFormData(prev => ({
      ...prev,
      vat_verified: result.valid,
      company_name: result.company_name || prev.company_name,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen && mode === 'create') resetForm();
    }}>
      {!isControlled && mode === 'create' && (
        <DialogTrigger asChild>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            {t('admin.customerFormDialog.nieuwe_klant')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? t('admin.customerFormDialog.klant_bewerken') : t('admin.customerFormDialog.nieuwe_klant_toevoegen')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? t('admin.customerFormDialog.werk_de_gegevens_van_deze_klant') : t('admin.customerFormDialog.vul_de_gegevens_in_om_een')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              {t('admin.customerDetail.contactgegevens')}
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">{t('admin.customerFormDialog.voornaam')}</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">{t('admin.customerFormDialog.achternaam')}</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('admin.customerFormDialog.e_mailadres')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('admin.customerFormDialog.telefoonnummer')}</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>

          <Separator />

          {/* Billing Address - Always visible */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4" />
              {t('admin.customerDetail.factuuradres')}
            </div>
            
            <AddressInput
              value={{
                street: formData.billing_street || '',
                city: formData.billing_city || '',
                postal_code: formData.billing_postal_code || '',
                country: formData.billing_country || currentTenant?.country || 'NL',
              }}
              onChange={(address) => setFormData(prev => ({
                ...prev,
                billing_street: address.street,
                billing_city: address.city,
                billing_postal_code: address.postal_code,
                billing_country: address.country,
              }))}
              showValidation={true}
            />

            {/* Different Shipping Address Toggle */}
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="different-shipping"
                checked={differentShipping}
                onCheckedChange={setDifferentShipping}
              />
              <Label htmlFor="different-shipping" className="flex items-center gap-2 cursor-pointer">
                <Truck className="h-4 w-4" />
                {t('admin.customerFormDialog.afleveradres_wijkt_af_van_factuuradres')}
              </Label>
            </div>

            {/* Shipping Address */}
            {differentShipping && (
              <div className="pt-4">
                <AddressInput
                  label={t('admin.customerFormDialog.afleveradres')}
                  value={{
                    street: formData.shipping_street || '',
                    city: formData.shipping_city || '',
                    postal_code: formData.shipping_postal_code || '',
                    country: formData.shipping_country || formData.billing_country || currentTenant?.country || 'NL',
                  }}
                  onChange={(address) => setFormData(prev => ({
                    ...prev,
                    shipping_street: address.street,
                    shipping_city: address.city,
                    shipping_postal_code: address.postal_code,
                    shipping_country: address.country,
                  }))}
                  showValidation={true}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* B2B Checkbox and Fields */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-business"
                checked={formData.customer_type === 'b2b'}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ 
                    ...prev, 
                    customer_type: checked ? 'b2b' : 'b2c' 
                  }))
                }
              />
              <Label htmlFor="is-business" className="cursor-pointer font-medium">
                {t('admin.customerFormDialog.zakelijke_klant_b2b')}
              </Label>
            </div>

            {/* B2B Fields */}
            {formData.customer_type === 'b2b' && (
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                  <Building2 className="h-4 w-4" />
                  {t('admin.customerFormDialog.bedrijfsgegevens')}
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">{t('admin.customerFormDialog.bedrijfsnaam')}</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder={t('admin.customerFormDialog.bedrijf_b_v')}
                      required={formData.customer_type === 'b2b'}
                    />
                  </div>

                  <VatInput
                    value={formData.vat_number || ''}
                    onChange={(value) => setFormData(prev => ({ ...prev, vat_number: value }))}
                    onValidated={handleVatValidated}
                  />

                  {formData.customer_type === 'b2b' && !formData.vat_number?.trim() && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                      {t('admin.customerFormDialog.zonder_btw_nummer_kan_deze_b2b')}
                    </div>
                  )}

                  {/* Peppol ID Field */}
                  <div className="space-y-2">
                    <Label htmlFor="peppol_id" className="flex items-center gap-2">
                      {t('admin.customerFormDialog.peppol_id')}
                      <span className="text-xs text-muted-foreground font-normal">{t('admin.customerFormDialog.optioneel')}</span>
                    </Label>
                    <Input
                      id="peppol_id"
                      value={formData.peppol_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, peppol_id: e.target.value }))}
                      placeholder={t('admin.customerFormDialog.bijv_0208_0123456789')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('admin.customerFormDialog.endpoint_id_voor_peppol_e_facturatie')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? 'Bezig...'
                : mode === 'edit'
                  ? t('admin.customerFormDialog.wijzigingen_opslaan') : t('common.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
