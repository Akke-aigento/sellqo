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

      <Button onClick={handleSave} disabled={isSaving}>
        <Save className="h-4 w-4 mr-2" />
        {isSaving ? 'Opslaan...' : 'Alle wijzigingen opslaan'}
      </Button>
    </div>
  );
}
