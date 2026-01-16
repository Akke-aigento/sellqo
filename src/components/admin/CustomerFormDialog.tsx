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
}

export function CustomerFormDialog({ onSubmit, isLoading }: CustomerFormDialogProps) {
  const { currentTenant } = useTenant();
  const [open, setOpen] = useState(false);
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
    resetForm();
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
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Nieuwe klant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nieuwe klant toevoegen</DialogTitle>
          <DialogDescription>
            Vul de gegevens in om een nieuwe klant aan te maken.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Contactgegevens
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">Voornaam *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Achternaam *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefoonnummer</Label>
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
              Factuuradres
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
                Afleveradres wijkt af van factuuradres
              </Label>
            </div>

            {/* Shipping Address */}
            {differentShipping && (
              <div className="pt-4">
                <AddressInput
                  label="Afleveradres"
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
                Zakelijke klant (B2B)
              </Label>
            </div>

            {/* B2B Fields */}
            {formData.customer_type === 'b2b' && (
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                  <Building2 className="h-4 w-4" />
                  Bedrijfsgegevens
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Bedrijfsnaam *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder="Bedrijf B.V."
                      required={formData.customer_type === 'b2b'}
                    />
                  </div>

                  <VatInput
                    value={formData.vat_number || ''}
                    onChange={(value) => setFormData(prev => ({ ...prev, vat_number: value }))}
                    onValidated={handleVatValidated}
                  />

                  {/* Peppol ID Field */}
                  <div className="space-y-2">
                    <Label htmlFor="peppol_id" className="flex items-center gap-2">
                      Peppol-ID
                      <span className="text-xs text-muted-foreground font-normal">(optioneel)</span>
                    </Label>
                    <Input
                      id="peppol_id"
                      value={formData.peppol_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, peppol_id: e.target.value }))}
                      placeholder="bijv. 0208:0123456789"
                    />
                    <p className="text-xs text-muted-foreground">
                      Endpoint-ID voor Peppol e-facturatie. Formaat: [scheme]:[identifier]
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Bezig...' : 'Toevoegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
