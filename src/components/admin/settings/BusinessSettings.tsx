import { useState, useEffect } from 'react';
import { Building2, Upload, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

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
  });

  useEffect(() => {
    if (currentTenant) {
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
      });
    }
  }, [currentTenant]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!currentTenant) return;
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
        })
        .eq('id', currentTenant.id);

      if (error) throw error;

      await refreshTenants();
      
      toast({
        title: 'Bedrijfsgegevens opgeslagen',
        description: 'Je wijzigingen zijn succesvol opgeslagen.',
      });
    } catch (error: any) {
      toast({
        title: 'Fout bij opslaan',
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
            <CardTitle>Bedrijfsgegevens</CardTitle>
            <CardDescription>
              Beheer je winkel- en bedrijfsinformatie
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo section */}
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 rounded-lg">
            <AvatarImage src={currentTenant?.logo_url || ''} />
            <AvatarFallback className="rounded-lg text-lg">
              {currentTenant?.name?.charAt(0) || 'W'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">Winkellogo</p>
            <p className="text-sm text-muted-foreground mb-2">
              Aanbevolen: 200x200px, PNG of JPG
            </p>
            <Button variant="outline" size="sm" disabled>
              <Upload className="h-4 w-4 mr-2" />
              Logo uploaden
            </Button>
          </div>
        </div>

        {/* Form fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="name">Winkelnaam *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Mijn Webshop"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="owner_name">Eigenaar naam</Label>
            <Input
              id="owner_name"
              value={formData.owner_name}
              onChange={(e) => handleChange('owner_name', e.target.value)}
              placeholder="Jan Jansen"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">Telefoonnummer</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+31 6 12345678"
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="address">Adres</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Straatnaam 123"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="postal_code">Postcode</Label>
            <Input
              id="postal_code"
              value={formData.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              placeholder="1234 AB"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="city">Stad</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Amsterdam"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="country">Land *</Label>
            <Select
              value={formData.country}
              onValueChange={(value) => handleChange('country', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer land" />
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
              Belangrijk voor BTW-berekeningen en -regels
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="kvk_number">KvK-nummer</Label>
            <Input
              id="kvk_number"
              value={formData.kvk_number}
              onChange={(e) => handleChange('kvk_number', e.target.value)}
              placeholder="12345678"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="btw_number">BTW-nummer</Label>
            <Input
              id="btw_number"
              value={formData.btw_number}
              onChange={(e) => handleChange('btw_number', e.target.value)}
              placeholder="NL123456789B01"
            />
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
