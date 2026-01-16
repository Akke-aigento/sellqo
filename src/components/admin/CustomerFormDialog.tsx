import { useState } from 'react';
import { UserPlus, Building2, User, MapPin, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { cn } from '@/lib/utils';

interface CustomerFormData {
  customer_type: 'b2c' | 'b2b';
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  vat_number?: string;
  vat_verified?: boolean;
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
    billing_street: '',
    billing_city: '',
    billing_postal_code: '',
    billing_country: 'NL',
    shipping_street: '',
    shipping_city: '',
    shipping_postal_code: '',
    shipping_country: '',
  });
  const [differentShipping, setDifferentShipping] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData: CustomerFormData = {
      ...formData,
      company_name: formData.customer_type === 'b2b' ? formData.company_name : undefined,
      vat_number: formData.customer_type === 'b2b' ? formData.vat_number : undefined,
      vat_verified: formData.customer_type === 'b2b' ? formData.vat_verified : undefined,
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
      billing_street: '',
      billing_city: '',
      billing_postal_code: '',
      billing_country: 'NL',
      shipping_street: '',
      shipping_city: '',
      shipping_postal_code: '',
      shipping_country: '',
    });
    setDifferentShipping(false);
    setShowAddress(false);
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
          {/* Customer Type Toggle */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Label htmlFor="customer-type" className="text-sm font-medium">Type klant:</Label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, customer_type: 'b2c' }))}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  formData.customer_type === 'b2c'
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                )}
              >
                <User className="h-4 w-4" />
                Particulier (B2C)
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, customer_type: 'b2b' }))}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  formData.customer_type === 'b2b'
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                )}
              >
                <Building2 className="h-4 w-4" />
                Zakelijk (B2B)
              </button>
            </div>
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
              </div>
            </div>
          )}

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

          {/* Address Section */}
          <Collapsible open={showAddress} onOpenChange={setShowAddress}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Adresgegevens (optioneel)
                </div>
                {showAddress ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-4">
              {/* Billing Address */}
              <AddressInput
                label="Factuuradres"
                value={{
                  street: formData.billing_street || '',
                  city: formData.billing_city || '',
                  postal_code: formData.billing_postal_code || '',
                  country: formData.billing_country || 'NL',
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
              <div className="flex items-center space-x-2">
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
                <AddressInput
                  label="Afleveradres"
                  value={{
                    street: formData.shipping_street || '',
                    city: formData.shipping_city || '',
                    postal_code: formData.shipping_postal_code || '',
                    country: formData.shipping_country || formData.billing_country || 'NL',
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
              )}
            </CollapsibleContent>
          </Collapsible>

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
