import { useState, useEffect, useRef } from 'react';
import { Store, Save, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from 'next-themes';
import { useImageUpload } from '@/hooks/useImageUpload';

const CURRENCIES = [
  { code: 'EUR', name: 'Euro (€)', symbol: '€' },
  { code: 'USD', name: 'US Dollar ($)', symbol: '$' },
  { code: 'GBP', name: 'Brits Pond (£)', symbol: '£' },
];

export function StoreSettings() {
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { uploadImage, uploading } = useImageUpload();
  const [isSaving, setIsSaving] = useState(false);
  const followSystemTheme = theme === 'system';
  const docLogoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    tax_percentage: 21,
    currency: 'EUR',
    shipping_enabled: true,
    document_logo_url: null as string | null,
  });

  useEffect(() => {
    if (currentTenant) {
      setFormData({
        tax_percentage: currentTenant.tax_percentage || 21,
        currency: currentTenant.currency || 'EUR',
        shipping_enabled: currentTenant.shipping_enabled ?? true,
        document_logo_url: (currentTenant as any).document_logo_url || null,
      });
    }
  }, [currentTenant]);

  const handleSave = async () => {
    if (!currentTenant) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          tax_percentage: formData.tax_percentage,
          currency: formData.currency,
          shipping_enabled: formData.shipping_enabled,
          document_logo_url: formData.document_logo_url,
        } as any)
        .eq('id', currentTenant.id);

      if (error) throw error;

      await refreshTenants();
      
      toast({
        title: 'Winkelinstellingen opgeslagen',
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
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Algemene instellingen</CardTitle>
              <CardDescription>
                Configureer BTW, valuta en verzending
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="tax_percentage">BTW Percentage (%)</Label>
              <Input
                id="tax_percentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.tax_percentage}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  tax_percentage: parseFloat(e.target.value) || 0 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Standaard BTW-tarief voor producten
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currency">Valuta</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Selecteer valuta" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Verzending inschakelen</p>
              <p className="text-sm text-muted-foreground">
                Schakel verzendkosten en opties in voor je winkel
              </p>
            </div>
            <Switch
              checked={formData.shipping_enabled}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, shipping_enabled: checked }))
              }
            />
          </div>

          {/* System Theme Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Systeemthema volgen</p>
              <p className="text-sm text-muted-foreground">
                Automatisch schakelen tussen licht en donker op basis van je apparaatinstellingen
              </p>
            </div>
            <Switch
              checked={followSystemTheme}
              onCheckedChange={(checked) => {
                if (checked) {
                  setTheme('system');
                } else {
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  setTheme(prefersDark ? 'dark' : 'light');
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Document Logo */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ImageIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Document logo</CardTitle>
              <CardDescription>
                Logo voor pakbonnen en facturen (witte achtergrond). Valt terug op je standaard logo als dit niet is ingesteld.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="relative h-24 w-48 rounded-lg border-2 border-dashed bg-muted/30 flex items-center justify-center overflow-hidden">
              {formData.document_logo_url ? (
                <>
                  <img
                    src={formData.document_logo_url}
                    alt="Document logo preview"
                    className="h-full w-full object-contain p-2"
                  />
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, document_logo_url: null }))}
                    className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                  <span className="text-xs">Geen document logo</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={docLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadImage(file, 'tenant-logos', `document-logo/${Date.now()}`);
                  if (url) setFormData(prev => ({ ...prev, document_logo_url: url }));
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => docLogoInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploaden...' : 'Upload Document Logo'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Aanbevolen: donker/gekleurd logo, zichtbaar op wit papier
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving}>
        <Save className="h-4 w-4 mr-2" />
        {isSaving ? 'Opslaan...' : 'Alle wijzigingen opslaan'}
      </Button>
    </div>
  );
}
