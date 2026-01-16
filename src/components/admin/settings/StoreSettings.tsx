import { useState, useEffect } from 'react';
import { Store, Palette, Save } from 'lucide-react';
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

const CURRENCIES = [
  { code: 'EUR', name: 'Euro (€)', symbol: '€' },
  { code: 'USD', name: 'US Dollar ($)', symbol: '$' },
  { code: 'GBP', name: 'Brits Pond (£)', symbol: '£' },
];

const LANGUAGES = [
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export function StoreSettings() {
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const followSystemTheme = theme === 'system';

  const [formData, setFormData] = useState({
    tax_percentage: 21,
    currency: 'EUR',
    language: 'nl',
    shipping_enabled: true,
    primary_color: '#3b82f6',
    secondary_color: '#1e40af',
  });

  useEffect(() => {
    if (currentTenant) {
      setFormData({
        tax_percentage: currentTenant.tax_percentage || 21,
        currency: currentTenant.currency || 'EUR',
        language: (currentTenant as any).language || 'nl',
        shipping_enabled: currentTenant.shipping_enabled ?? true,
        primary_color: currentTenant.primary_color || '#3b82f6',
        secondary_color: currentTenant.secondary_color || '#1e40af',
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
          language: formData.language,
          shipping_enabled: formData.shipping_enabled,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
        })
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
                Configureer BTW, valuta en taalinstellingen
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            <div className="grid gap-2">
              <Label htmlFor="language">Taal</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
              >
                <SelectTrigger id="language">
                  <SelectValue placeholder="Selecteer taal" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
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
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Palette className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Thema kleuren</CardTitle>
              <CardDescription>
                Pas de kleuren van je webshop aan
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="primary_color">Primaire kleur</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    primary_color: e.target.value 
                  }))}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    primary_color: e.target.value 
                  }))}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="secondary_color">Secundaire kleur</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary_color"
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    secondary_color: e.target.value 
                  }))}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.secondary_color}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    secondary_color: e.target.value 
                  }))}
                  placeholder="#1e40af"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-3">Preview</p>
            <div className="flex gap-3">
              <Button 
                style={{ backgroundColor: formData.primary_color }}
                className="hover:opacity-90"
              >
                Primaire knop
              </Button>
              <Button 
                variant="outline"
                style={{ 
                  borderColor: formData.secondary_color,
                  color: formData.secondary_color 
                }}
              >
                Secundaire knop
              </Button>
            </div>
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
                  // When turning off, use current resolved theme
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
