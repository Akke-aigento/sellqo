import { useState, useEffect } from 'react';
import { Receipt, Save, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function TaxSettings() {
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    default_vat_handling: 'inclusive',
    apply_oss_rules: false,
    reverse_charge_text: 'BTW verlegd naar afnemer conform artikel 44 EU BTW-richtlijn',
    export_text: 'Vrijgesteld van BTW - levering buiten EU',
  });

  useEffect(() => {
    if (currentTenant) {
      const tenantData = currentTenant as any;
      setFormData({
        default_vat_handling: tenantData.default_vat_handling || 'inclusive',
        apply_oss_rules: tenantData.apply_oss_rules ?? false,
        reverse_charge_text: tenantData.reverse_charge_text || 'BTW verlegd naar afnemer conform artikel 44 EU BTW-richtlijn',
        export_text: tenantData.export_text || 'Vrijgesteld van BTW - levering buiten EU',
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
          default_vat_handling: formData.default_vat_handling,
          apply_oss_rules: formData.apply_oss_rules,
          reverse_charge_text: formData.reverse_charge_text,
          export_text: formData.export_text,
        })
        .eq('id', currentTenant.id);

      if (error) throw error;

      await refreshTenants();
      
      toast({
        title: 'BTW-instellingen opgeslagen',
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
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>BTW-regels voor internationale handel</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-2">
            Deze instellingen bepalen hoe BTW wordt berekend op basis van klanttype en locatie:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>B2B + geldig EU BTW-nummer</strong>: BTW verlegd (0%)</li>
            <li><strong>B2B zonder geldig BTW-nummer in EU</strong>: Standaard BTW-tarief</li>
            <li><strong>B2C in eigen land</strong>: Standaard BTW-tarief</li>
            <li><strong>B2C in ander EU-land (met OSS)</strong>: BTW-tarief van bestemmingsland</li>
            <li><strong>Klanten buiten EU</strong>: 0% BTW (export)</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* VAT Handling Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>BTW-berekening</CardTitle>
              <CardDescription>
                Configureer hoe BTW wordt berekend en weergegeven
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="default_vat_handling">Prijzen weergave</Label>
              <Select
                value={formData.default_vat_handling}
                onValueChange={(value) => setFormData(prev => ({ ...prev, default_vat_handling: value }))}
              >
                <SelectTrigger id="default_vat_handling">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inclusive">
                    <div className="flex flex-col">
                      <span>Inclusief BTW</span>
                      <span className="text-xs text-muted-foreground">Prijzen worden inclusief BTW getoond</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="exclusive">
                    <div className="flex flex-col">
                      <span>Exclusief BTW</span>
                      <span className="text-xs text-muted-foreground">Prijzen worden exclusief BTW getoond (B2B)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Bepaalt hoe prijzen standaard worden weergegeven in je winkel
              </p>
            </div>
          </div>

          {/* OSS Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">OSS-regeling toepassen</p>
              <p className="text-sm text-muted-foreground">
                One-Stop-Shop regeling voor EU B2C verkopen aan consumenten in andere EU-landen.
                Hiermee wordt automatisch het BTW-tarief van het bestemmingsland toegepast.
              </p>
            </div>
            <Switch
              checked={formData.apply_oss_rules}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, apply_oss_rules: checked }))
              }
            />
          </div>

          {formData.apply_oss_rules && (
            <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-200">OSS-regeling actief</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Bij B2C verkopen aan consumenten in andere EU-landen wordt automatisch het lokale BTW-tarief toegepast.
                Zorg ervoor dat je geregistreerd bent voor de OSS-regeling bij de Belastingdienst.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Invoice Texts Card */}
      <Card>
        <CardHeader>
          <CardTitle>Factuur teksten</CardTitle>
          <CardDescription>
            Teksten die op facturen worden getoond bij speciale BTW-situaties
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="reverse_charge_text">BTW verlegd tekst</Label>
            <Textarea
              id="reverse_charge_text"
              value={formData.reverse_charge_text}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                reverse_charge_text: e.target.value 
              }))}
              placeholder="BTW verlegd naar afnemer..."
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Deze tekst verschijnt op facturen voor B2B klanten met een geldig EU BTW-nummer
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="export_text">Export tekst</Label>
            <Textarea
              id="export_text"
              value={formData.export_text}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                export_text: e.target.value 
              }))}
              placeholder="Vrijgesteld van BTW - levering buiten EU"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Deze tekst verschijnt op facturen voor klanten buiten de EU
            </p>
          </div>
        </CardContent>
      </Card>

      {/* BTW Decision Tree Preview */}
      <Card>
        <CardHeader>
          <CardTitle>BTW-beslisboom</CardTitle>
          <CardDescription>
            Overzicht hoe BTW wordt berekend per situatie
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Klanttype</th>
                  <th className="text-left py-2 px-3 font-medium">Locatie</th>
                  <th className="text-left py-2 px-3 font-medium">BTW-nummer</th>
                  <th className="text-left py-2 px-3 font-medium">BTW-tarief</th>
                  <th className="text-left py-2 px-3 font-medium">Factuur vermelding</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="hover:bg-muted/50">
                  <td className="py-2 px-3">B2C</td>
                  <td className="py-2 px-3">Eigen land (NL)</td>
                  <td className="py-2 px-3 text-muted-foreground">-</td>
                  <td className="py-2 px-3 font-medium">{currentTenant?.tax_percentage || 21}%</td>
                  <td className="py-2 px-3 text-muted-foreground">Standaard</td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="py-2 px-3">B2C</td>
                  <td className="py-2 px-3">Ander EU-land</td>
                  <td className="py-2 px-3 text-muted-foreground">-</td>
                  <td className="py-2 px-3 font-medium">
                    {formData.apply_oss_rules ? 'Lokaal tarief' : `${currentTenant?.tax_percentage || 21}%`}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {formData.apply_oss_rules ? 'OSS-regeling' : 'Standaard'}
                  </td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="py-2 px-3">B2B</td>
                  <td className="py-2 px-3">Eigen land (NL)</td>
                  <td className="py-2 px-3">✓ Geldig</td>
                  <td className="py-2 px-3 font-medium">{currentTenant?.tax_percentage || 21}%</td>
                  <td className="py-2 px-3 text-muted-foreground">Standaard</td>
                </tr>
                <tr className="hover:bg-muted/50 bg-green-50/50 dark:bg-green-950/20">
                  <td className="py-2 px-3">B2B</td>
                  <td className="py-2 px-3">Ander EU-land</td>
                  <td className="py-2 px-3 text-green-600">✓ Geldig</td>
                  <td className="py-2 px-3 font-medium text-green-600">0%</td>
                  <td className="py-2 px-3 text-green-600">BTW verlegd</td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="py-2 px-3">B2B</td>
                  <td className="py-2 px-3">Ander EU-land</td>
                  <td className="py-2 px-3 text-destructive">✗ Ongeldig</td>
                  <td className="py-2 px-3 font-medium">{currentTenant?.tax_percentage || 21}%</td>
                  <td className="py-2 px-3 text-muted-foreground">Standaard</td>
                </tr>
                <tr className="hover:bg-muted/50 bg-blue-50/50 dark:bg-blue-950/20">
                  <td className="py-2 px-3">B2C / B2B</td>
                  <td className="py-2 px-3">Buiten EU</td>
                  <td className="py-2 px-3 text-muted-foreground">-</td>
                  <td className="py-2 px-3 font-medium text-blue-600">0%</td>
                  <td className="py-2 px-3 text-blue-600">Export</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving}>
        <Save className="h-4 w-4 mr-2" />
        {isSaving ? 'Opslaan...' : 'BTW-instellingen opslaan'}
      </Button>
    </div>
  );
}
