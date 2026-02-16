import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileText, Mail, Loader2, Info, ShoppingCart, Globe, Store } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

export function InvoiceAutomationSettings() {
  const { roles } = useAuth();
  const activeTenantId = roles.find(r => r.tenant_id)?.tenant_id;
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [autoSendEmail, setAutoSendEmail] = useState(false);
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [emailError, setEmailError] = useState<{ cc?: string; bcc?: string }>({});

  useEffect(() => {
    if (activeTenantId) {
      loadSettings();
    }
  }, [activeTenantId]);

  const loadSettings = async () => {
    if (!activeTenantId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('auto_generate_invoice, auto_send_invoice_email, invoice_cc_email, invoice_bcc_email')
        .eq('id', activeTenantId)
        .single();

      if (error) throw error;

      setAutoGenerate(data?.auto_generate_invoice ?? true);
      setAutoSendEmail(data?.auto_send_invoice_email ?? false);
      setCcEmail(data?.invoice_cc_email ?? '');
      setBccEmail(data?.invoice_bcc_email ?? '');
    } catch (error: any) {
      console.error('Error loading invoice settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeTenantId) return;

    const isValidEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const errors: { cc?: string; bcc?: string } = {};
    if (!isValidEmail(ccEmail)) errors.cc = 'Ongeldig e-mailadres';
    if (!isValidEmail(bccEmail)) errors.bcc = 'Ongeldig e-mailadres';
    setEmailError(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          auto_generate_invoice: autoGenerate,
          auto_send_invoice_email: autoSendEmail,
          invoice_cc_email: ccEmail || null,
          invoice_bcc_email: bccEmail || null,
        })
        .eq('id', activeTenantId);

      if (error) throw error;

      toast({
        title: 'Instellingen opgeslagen',
        description: 'Je facturatie-instellingen zijn bijgewerkt.',
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Automatische Facturatie
          </CardTitle>
          <CardDescription>
            Configureer wanneer facturen automatisch worden aangemaakt en verzonden
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-generate" className="text-base">
                Automatisch facturen genereren
              </Label>
              <p className="text-sm text-muted-foreground">
                Maak automatisch een factuur aan zodra een bestelling als betaald wordt gemarkeerd
              </p>
            </div>
            <Switch
              id="auto-generate"
              checked={autoGenerate}
              onCheckedChange={setAutoGenerate}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-send" className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Automatisch factuur e-mailen
              </Label>
              <p className="text-sm text-muted-foreground">
                Verstuur de factuur direct per e-mail naar de klant na generatie
              </p>
            </div>
            <Switch
              id="auto-send"
              checked={autoSendEmail}
              onCheckedChange={setAutoSendEmail}
              disabled={!autoGenerate}
            />
          </div>

          {autoSendEmail && (
            <div className="space-y-4 pl-4 border-l-2 border-muted">
              <div className="space-y-2">
                <Label htmlFor="cc-email" className="text-base">
                  CC e-mailadres
                </Label>
                <p className="text-sm text-muted-foreground">
                  Dit adres ontvangt een kopie van elke verstuurde factuur, bijv. je boekhoudsoftware
                </p>
                <Input
                  id="cc-email"
                  type="email"
                  placeholder="boekhouding@jouwbedrijf.nl"
                  value={ccEmail}
                  onChange={(e) => { setCcEmail(e.target.value); setEmailError(prev => ({ ...prev, cc: undefined })); }}
                />
                {emailError.cc && <p className="text-sm text-destructive">{emailError.cc}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bcc-email" className="text-base">
                  BCC e-mailadres
                </Label>
                <p className="text-sm text-muted-foreground">
                  Blinde kopie — de klant ziet dit adres niet
                </p>
                <Input
                  id="bcc-email"
                  type="email"
                  placeholder="archief@jouwbedrijf.nl"
                  value={bccEmail}
                  onChange={(e) => { setBccEmail(e.target.value); setEmailError(prev => ({ ...prev, bcc: undefined })); }}
                />
                {emailError.bcc && <p className="text-sm text-destructive">{emailError.bcc}</p>}
              </div>
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Deze instellingen gelden voor:</p>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                  Marketplace orders (Bol.com, Amazon, Shopify, WooCommerce)
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Webshop bankoverschrijvingen
                </li>
                <li className="flex items-center gap-2">
                  <Store className="h-3.5 w-3.5 text-muted-foreground" />
                  Handmatig als betaald gemarkeerde bestellingen
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
