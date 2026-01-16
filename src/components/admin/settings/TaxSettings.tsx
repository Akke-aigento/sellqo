import { useState, useEffect } from 'react';
import { Receipt, Save, AlertCircle, Info, AlertTriangle, Calendar, Hash, TrendingUp, Globe, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { useOssRevenue, OSS_THRESHOLD_AMOUNT } from '@/hooks/useOssRevenue';
import { supabase } from '@/integrations/supabase/client';
import { EU_VAT_RATES } from '@/lib/euVatRates';
import { DEFAULT_VAT_TEXTS, type VatTextType, type SupportedLanguage } from '@/lib/vatInvoiceTexts';
import { useTranslation } from 'react-i18next';

export function TaxSettings() {
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [showVatRates, setShowVatRates] = useState(false);
  const [previewLanguage, setPreviewLanguage] = useState<SupportedLanguage>('nl');

  const { data: ossRevenue, isLoading: ossLoading } = useOssRevenue();

  const [formData, setFormData] = useState({
    default_vat_handling: 'inclusive',
    apply_oss_rules: false,
    oss_registration_date: '',
    oss_identification_number: '',
  });

  useEffect(() => {
    if (currentTenant) {
      const tenantData = currentTenant as any;
      setFormData({
        default_vat_handling: tenantData.default_vat_handling || 'inclusive',
        apply_oss_rules: tenantData.apply_oss_rules ?? false,
        oss_registration_date: tenantData.oss_registration_date || '',
        oss_identification_number: tenantData.oss_identification_number || '',
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
          oss_registration_date: formData.oss_registration_date || null,
          oss_identification_number: formData.oss_identification_number || null,
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

  const tenantCountry = (currentTenant as any)?.country || 'NL';
  const currentYear = new Date().getFullYear();

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
        </CardContent>
      </Card>

      {/* OSS Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>OSS-regeling (One-Stop-Shop)</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>Bij B2C verkopen aan particulieren in andere EU-landen wordt automatisch het BTW-tarief van het bestemmingsland toegepast. De drempel is €10.000 per jaar (cumulatief alle EU-landen).</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CardDescription>
                EU-regeling voor B2C verkopen aan particulieren in andere EU-landen
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OSS Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">OSS-regeling activeren</p>
              <p className="text-sm text-muted-foreground">
                Bij overschrijding van de €10.000 drempel moet het BTW-tarief van het bestemmingsland worden toegepast
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
            <>
              {/* OSS Registration Fields */}
              <div className="grid gap-4 sm:grid-cols-2 p-4 bg-muted/30 rounded-lg">
                <div className="grid gap-2">
                  <Label htmlFor="oss_registration_date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Datum OSS-registratie
                  </Label>
                  <Input
                    id="oss_registration_date"
                    type="date"
                    value={formData.oss_registration_date}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      oss_registration_date: e.target.value 
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    De datum waarop je je hebt geregistreerd bij de Belastingdienst
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="oss_identification_number" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    OSS-identificatienummer
                  </Label>
                  <Input
                    id="oss_identification_number"
                    value={formData.oss_identification_number}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      oss_identification_number: e.target.value 
                    }))}
                    placeholder="NL000000000B01"
                  />
                  <p className="text-xs text-muted-foreground">
                    Je OSS-registratienummer (vaak gelijk aan je BTW-nummer)
                  </p>
                </div>
              </div>

              <Alert variant="default" className="bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <AlertTitle className="text-purple-800 dark:text-purple-200">OSS-regeling actief</AlertTitle>
                <AlertDescription className="text-purple-700 dark:text-purple-300">
                  Bij B2C verkopen aan particulieren in andere EU-landen wordt automatisch het lokale BTW-tarief toegepast.
                  De factuur vermeldt "OSS-regeling toegepast".
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* OSS Revenue Tracker */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">B2C EU-omzet {currentYear}</p>
                <p className="text-sm text-muted-foreground">
                  Cumulatieve omzet aan particulieren in andere EU-landen
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  €{ossLoading ? '...' : (ossRevenue?.totalRevenue || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground">
                  van €{OSS_THRESHOLD_AMOUNT.toLocaleString('nl-NL')} drempel
                </p>
              </div>
            </div>

            <Progress 
              value={ossRevenue?.thresholdPercentage || 0} 
              className={`h-3 ${
                ossRevenue?.isOverThreshold 
                  ? '[&>div]:bg-red-500' 
                  : ossRevenue?.isNearThreshold 
                    ? '[&>div]:bg-amber-500' 
                    : ''
              }`}
            />

            <p className="text-sm text-muted-foreground">
              {ossRevenue?.thresholdPercentage?.toFixed(1) || 0}% van de drempel bereikt
            </p>

            {ossRevenue?.isNearThreshold && !formData.apply_oss_rules && (
              <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-200">Je nadert de OSS-drempel</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  Je bent op 80% of meer van de €10.000 drempel. Overweeg OSS-registratie bij de Belastingdienst.
                </AlertDescription>
              </Alert>
            )}

            {ossRevenue?.isOverThreshold && !formData.apply_oss_rules && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>OSS-drempel overschreden!</AlertTitle>
                <AlertDescription>
                  Je hebt de €10.000 drempel overschreden. Je bent verplicht om OSS te registreren en het BTW-tarief van het bestemmingsland toe te passen.
                </AlertDescription>
              </Alert>
            )}

            {/* Revenue by Country */}
            {ossRevenue && Object.keys(ossRevenue.revenueByCountry).length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">Omzet per land:</p>
                <div className="grid gap-1 text-sm">
                  {Object.entries(ossRevenue.revenueByCountry)
                    .sort(([, a], [, b]) => b - a)
                    .map(([country, amount]) => {
                      const countryInfo = EU_VAT_RATES.find(r => r.code === country);
                      return (
                        <div key={country} className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">
                            {countryInfo?.name || country}
                          </span>
                          <span className="font-medium">
                            €{amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* EU VAT Rates Table */}
          {formData.apply_oss_rules && (
            <Collapsible open={showVatRates} onOpenChange={setShowVatRates}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>EU BTW-tarieven bekijken</span>
                  <span className="text-muted-foreground">{showVatRates ? '▲' : '▼'}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Land</th>
                          <th className="text-right py-2 px-3 font-medium">Standaard tarief</th>
                          <th className="text-right py-2 px-3 font-medium">Verlaagd tarief</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {EU_VAT_RATES.map((rate) => (
                          <tr 
                            key={rate.code} 
                            className={`hover:bg-muted/50 ${rate.code === tenantCountry ? 'bg-primary/5' : ''}`}
                          >
                            <td className="py-2 px-3 flex items-center gap-2">
                              <span className="font-medium">{rate.code}</span>
                              <span className="text-muted-foreground">{rate.name}</span>
                              {rate.code === tenantCountry && (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Eigen land</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-medium">
                              {rate.standardRate}%
                            </td>
                            <td className="py-2 px-3 text-right text-muted-foreground">
                              {rate.reducedRate !== null ? `${rate.reducedRate}%` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Invoice Texts Card - 4 Language Support */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <CardTitle>{t('tax.invoiceTexts.title')}</CardTitle>
              <CardDescription>
                {t('tax.invoiceTexts.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language Preview Selector */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <Label className="text-sm">{t('tax.invoiceTexts.previewInLanguage')}</Label>
            <Select
              value={previewLanguage}
              onValueChange={(value) => setPreviewLanguage(value as SupportedLanguage)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nl">Nederlands</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t('tax.invoiceTexts.defaultTexts')}
            </AlertDescription>
          </Alert>

          {/* VAT Text Types */}
          <div className="space-y-4">
            {/* Intra-Community Goods */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-green-700 dark:text-green-400">
                    {t('tax.invoiceTexts.intracomGoodsLabel')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('tax.invoiceTexts.intracomGoodsDescription')}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded border text-sm font-mono">
                {DEFAULT_VAT_TEXTS.intracom_goods[previewLanguage]}
              </div>
            </div>

            {/* Intra-Community Services (Reverse Charge) */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {t('tax.invoiceTexts.intracomServicesLabel')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('tax.invoiceTexts.intracomServicesDescription')}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded border text-sm font-mono">
                {DEFAULT_VAT_TEXTS.intracom_services[previewLanguage]}
              </div>
            </div>

            {/* Export */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    {t('tax.invoiceTexts.exportLabel')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('tax.invoiceTexts.exportDescription')}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded border text-sm font-mono">
                {DEFAULT_VAT_TEXTS.export[previewLanguage]}
              </div>
            </div>

            {/* OSS */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-purple-700 dark:text-purple-400">
                    {t('tax.invoiceTexts.ossLabel')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('tax.invoiceTexts.ossDescription')}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded border text-sm font-mono">
                {DEFAULT_VAT_TEXTS.oss[previewLanguage]}
              </div>
            </div>
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
                  <td className="py-2 px-3">Eigen land ({tenantCountry})</td>
                  <td className="py-2 px-3 text-muted-foreground">-</td>
                  <td className="py-2 px-3 font-medium">{currentTenant?.tax_percentage || 21}%</td>
                  <td className="py-2 px-3 text-muted-foreground">Standaard</td>
                </tr>
                <tr className={`hover:bg-muted/50 ${formData.apply_oss_rules ? 'bg-purple-50/50 dark:bg-purple-950/20' : ''}`}>
                  <td className="py-2 px-3">B2C</td>
                  <td className="py-2 px-3">Ander EU-land</td>
                  <td className="py-2 px-3 text-muted-foreground">-</td>
                  <td className={`py-2 px-3 font-medium ${formData.apply_oss_rules ? 'text-purple-600' : ''}`}>
                    {formData.apply_oss_rules ? 'Tarief bestemmingsland' : `${currentTenant?.tax_percentage || 21}%`}
                  </td>
                  <td className={`py-2 px-3 ${formData.apply_oss_rules ? 'text-purple-600' : 'text-muted-foreground'}`}>
                    {formData.apply_oss_rules ? 'OSS-regeling toegepast' : 'Standaard'}
                  </td>
                </tr>
                <tr className="hover:bg-muted/50">
                  <td className="py-2 px-3">B2B</td>
                  <td className="py-2 px-3">Eigen land ({tenantCountry})</td>
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
