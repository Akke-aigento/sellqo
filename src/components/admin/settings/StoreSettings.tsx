import { useState, useEffect } from 'react';
import { Store, Palette, Save, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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

const INVOICE_FORMATS = [
  { value: 'pdf', label: 'PDF', description: 'Standaard PDF factuur' },
  { value: 'ubl', label: 'UBL (e-facturatie)', description: 'XML formaat voor boekhoudprogramma\'s' },
  { value: 'both', label: 'Beide', description: 'PDF én UBL formaat' },
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
    auto_send_invoices: true,
    invoice_format: 'pdf',
    invoice_prefix: 'INV',
    invoice_email_subject: '',
    invoice_email_body: '',
    invoice_cc_email: '',
    invoice_bcc_email: '',
  });

  useEffect(() => {
    if (currentTenant) {
      const tenantData = currentTenant as any;
      setFormData({
        tax_percentage: currentTenant.tax_percentage || 21,
        currency: currentTenant.currency || 'EUR',
        language: tenantData.language || 'nl',
        shipping_enabled: currentTenant.shipping_enabled ?? true,
        primary_color: currentTenant.primary_color || '#3b82f6',
        secondary_color: currentTenant.secondary_color || '#1e40af',
        auto_send_invoices: tenantData.auto_send_invoices ?? true,
        invoice_format: tenantData.invoice_format || 'pdf',
        invoice_prefix: tenantData.invoice_prefix || 'INV',
        invoice_email_subject: tenantData.invoice_email_subject || '',
        invoice_email_body: tenantData.invoice_email_body || '',
        invoice_cc_email: tenantData.invoice_cc_email || '',
        invoice_bcc_email: tenantData.invoice_bcc_email || '',
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
          auto_send_invoices: formData.auto_send_invoices,
          invoice_format: formData.invoice_format,
          invoice_prefix: formData.invoice_prefix,
          invoice_email_subject: formData.invoice_email_subject || null,
          invoice_email_body: formData.invoice_email_body || null,
          invoice_cc_email: formData.invoice_cc_email || null,
          invoice_bcc_email: formData.invoice_bcc_email || null,
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

      {/* Invoice Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Facturatie</CardTitle>
              <CardDescription>
                Configureer automatische facturen na betaling
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Automatisch facturen versturen</p>
              <p className="text-sm text-muted-foreground">
                Stuur facturen automatisch naar klanten na succesvolle betaling
              </p>
            </div>
            <Switch
              checked={formData.auto_send_invoices}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, auto_send_invoices: checked }))
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invoice_format">Factuurformaat</Label>
              <Select
                value={formData.invoice_format}
                onValueChange={(value) => setFormData(prev => ({ ...prev, invoice_format: value }))}
              >
                <SelectTrigger id="invoice_format">
                  <SelectValue placeholder="Selecteer formaat" />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      <div>
                        <span className="font-medium">{format.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {format.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                UBL (e-facturatie) is een XML standaard die direct importeerbaar is in boekhoudprogramma's
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoice_prefix">Factuurnummer prefix</Label>
              <Input
                id="invoice_prefix"
                value={formData.invoice_prefix}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  invoice_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') 
                }))}
                placeholder="INV"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                Voorbeeld: {formData.invoice_prefix}-2025-0001
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice_email_subject">E-mail onderwerp (optioneel)</Label>
            <Input
              id="invoice_email_subject"
              value={formData.invoice_email_subject}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                invoice_email_subject: e.target.value 
              }))}
              placeholder={`Factuur [nummer] van ${currentTenant?.name || 'je bedrijf'}`}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice_email_body">E-mail tekst (optioneel)</Label>
            <Textarea
              id="invoice_email_body"
              value={formData.invoice_email_body}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                invoice_email_body: e.target.value 
              }))}
              placeholder="Voeg een persoonlijke boodschap toe aan je factuur e-mails..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Deze tekst wordt toegevoegd aan de standaard factuur e-mail
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invoice_cc_email">CC e-mailadres (optioneel)</Label>
              <Input
                id="invoice_cc_email"
                type="email"
                value={formData.invoice_cc_email}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  invoice_cc_email: e.target.value 
                }))}
                placeholder="boekhouding@bedrijf.nl"
              />
              <p className="text-xs text-muted-foreground">
                Ontvangt een kopie van elke factuur e-mail
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoice_bcc_email">BCC e-mailadres (optioneel)</Label>
              <Input
                id="invoice_bcc_email"
                type="email"
                value={formData.invoice_bcc_email}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  invoice_bcc_email: e.target.value 
                }))}
                placeholder="archief@bedrijf.nl"
              />
              <p className="text-xs text-muted-foreground">
                Ontvangt een blinde kopie (onzichtbaar voor klant)
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
