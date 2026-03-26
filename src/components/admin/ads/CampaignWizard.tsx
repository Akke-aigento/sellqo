import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { useAdPlatforms } from '@/hooks/useAdPlatforms';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import { SegmentSelector } from '@/components/admin/shared/SegmentSelector';
import { AD_PLATFORMS, CAMPAIGN_TYPES, type AdPlatform, type CampaignType, type AudienceType } from '@/types/ads';
import { ArrowLeft, ArrowRight, Check, Loader2, CalendarIcon, Package, Search, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CampaignWizardProps {
  onClose: () => void;
}

type WizardStep = 'platform' | 'type' | 'products' | 'audience' | 'budget' | 'review';

export function CampaignWizard({ onClose }: CampaignWizardProps) {
  const { createCampaign } = useAdCampaigns();
  const { connectedPlatforms, isConnected } = useAdPlatforms();
  const { segments } = useCustomerSegments();
  const { currentTenant } = useTenant();
  
  const [step, setStep] = useState<WizardStep>('platform');
  const [productSearch, setProductSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    platform: '' as AdPlatform | '',
    campaign_type: '' as CampaignType | '',
    product_ids: [] as string[],
    category_ids: [] as string[],
    segment_id: '' as string,
    audience_type: '' as AudienceType | '',
    budget_type: 'daily' as 'daily' | 'lifetime',
    budget_amount: 25,
    target_roas: 4,
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
  });

  // Fetch products for selection
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-ads', currentTenant?.id, productSearch],
    queryFn: async (): Promise<{ id: string; name: string; price: number; images: string[] | null }[]> => {
      if (!currentTenant?.id) return [];
      const { data, error } = await (supabase
        .from('products')
        .select('id, name, price, images')
        .eq('tenant_id', currentTenant.id) as any)
        .eq('status', 'active')
        .limit(20);
      if (error) throw error;
      let results = (data || []) as any[];
      if (productSearch) {
        const search = productSearch.toLowerCase();
        results = results.filter((p: any) => p.name?.toLowerCase().includes(search));
      }
      return results;
    },
    enabled: !!currentTenant?.id && step === 'products',
  });

  const steps: WizardStep[] = ['platform', 'type', 'products', 'audience', 'budget', 'review'];
  const stepLabels: Record<WizardStep, string> = {
    platform: 'Platform',
    type: 'Type',
    products: 'Producten',
    audience: 'Doelgroep',
    budget: 'Budget',
    review: 'Controleer',
  };
  const currentStepIndex = steps.indexOf(step);

  const canProceed = () => {
    switch (step) {
      case 'platform': return !!formData.platform;
      case 'type': return !!formData.campaign_type && !!formData.name;
      case 'products': return true; // Optional
      case 'audience': return true; // Optional
      case 'budget': return formData.budget_amount > 0;
      case 'review': return true;
      default: return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) setStep(steps[nextIndex]);
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setStep(steps[prevIndex]);
    else onClose();
  };

  const handleSubmit = async () => {
    if (!formData.platform || !formData.campaign_type) return;
    
    await createCampaign.mutateAsync({
      name: formData.name,
      platform: formData.platform,
      campaign_type: formData.campaign_type,
      product_ids: formData.product_ids.length > 0 ? formData.product_ids : undefined,
      category_ids: formData.category_ids.length > 0 ? formData.category_ids : undefined,
      segment_id: formData.segment_id || undefined,
      audience_type: formData.audience_type || undefined,
      budget_type: formData.budget_type,
      budget_amount: formData.budget_amount,
      target_roas: formData.target_roas,
      start_date: formData.start_date?.toISOString(),
      end_date: formData.end_date?.toISOString(),
    });
    
    onClose();
  };

  const toggleProduct = (id: string) => {
    setFormData(prev => ({
      ...prev,
      product_ids: prev.product_ids.includes(id)
        ? prev.product_ids.filter(p => p !== id)
        : [...prev.product_ids, id],
    }));
  };

  const availableCampaignTypes = formData.platform 
    ? Object.entries(CAMPAIGN_TYPES).filter(([_, info]) => 
        info.platforms.includes(formData.platform as AdPlatform)
      )
    : [];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < currentStepIndex 
                  ? 'bg-primary text-primary-foreground' 
                  : i === currentStepIndex 
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i < currentStepIndex ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 hidden sm:block">{stepLabels[s]}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mx-1 ${i < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        {step === 'platform' && (
          <>
            <CardHeader>
              <CardTitle>Kies Platform</CardTitle>
              <CardDescription>Op welk platform wil je adverteren?</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.platform}
                onValueChange={(v) => setFormData({ ...formData, platform: v as AdPlatform, campaign_type: '' })}
                className="grid gap-3"
              >
                {(Object.keys(AD_PLATFORMS) as AdPlatform[]).map(platform => {
                  const info = AD_PLATFORMS[platform];
                  const connected = isConnected(platform);
                  return (
                    <Label
                      key={platform}
                      htmlFor={platform}
                      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                        formData.platform === platform 
                          ? 'border-primary bg-primary/5' 
                          : connected ? 'hover:bg-muted/50' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <RadioGroupItem value={platform} id={platform} disabled={!connected} />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${info.color}`}>
                        {info.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{info.name}</p>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                      </div>
                      {!connected && <span className="text-xs text-muted-foreground">Niet gekoppeld</span>}
                    </Label>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </>
        )}

        {step === 'type' && (
          <>
            <CardHeader>
              <CardTitle>Campagne Details</CardTitle>
              <CardDescription>Geef je campagne een naam en kies het type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Campagnenaam</Label>
                <Input
                  id="name"
                  placeholder="bijv. Zomercollectie 2026"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Campagne Type</Label>
                <RadioGroup
                  value={formData.campaign_type}
                  onValueChange={(v) => setFormData({ ...formData, campaign_type: v as CampaignType })}
                  className="grid gap-2"
                >
                  {availableCampaignTypes.map(([type, info]) => (
                    <Label
                      key={type}
                      htmlFor={type}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.campaign_type === type ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={type} id={type} />
                      <div>
                        <p className="font-medium">{info.name}</p>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </>
        )}

        {step === 'products' && (
          <>
            <CardHeader>
              <CardTitle>Producten Selecteren</CardTitle>
              <CardDescription>
                Kies welke producten je wilt adverteren (optioneel)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek producten..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {formData.product_ids.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {formData.product_ids.length} product(en) geselecteerd
                </div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-2">
                {products.map(product => {
                  const isSelected = formData.product_ids.includes(product.id);
                  const imageUrl = (product.images as string[])?.[0];
                  return (
                    <label
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          €{Number(product.price).toFixed(2)}
                        </p>
                      </div>
                    </label>
                  );
                })}
                {products.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Geen producten gevonden
                  </p>
                )}
              </div>
            </CardContent>
          </>
        )}

        {step === 'audience' && (
          <>
            <CardHeader>
              <CardTitle>Doelgroep</CardTitle>
              <CardDescription>
                Kies een bestaand klantsegment of doelgroeptype (optioneel)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Klantsegment</Label>
                <Select
                  value={formData.segment_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, segment_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kies segment..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen segment (alle klanten)</SelectItem>
                    {segments.map(seg => (
                      <SelectItem key={seg.id} value={seg.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />
                          {seg.name} ({seg.member_count} klanten)
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Doelgroeptype</Label>
                <RadioGroup
                  value={formData.audience_type || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, audience_type: v === 'none' ? '' as any : v as AudienceType })}
                  className="grid gap-2"
                >
                  {[
                    { value: 'none', label: 'Geen specifiek type', desc: 'Bereik alle klanten' },
                    { value: 'retargeting', label: 'Retargeting', desc: 'Eerdere bezoekers en klanten' },
                    { value: 'lookalike', label: 'Lookalike', desc: 'Vergelijkbare doelgroepen' },
                    { value: 'interest', label: 'Interesse', desc: 'Gebaseerd op interesses' },
                    { value: 'custom', label: 'Aangepast', desc: 'Eigen doelgroep samenstellen' },
                  ].map(opt => (
                    <Label
                      key={opt.value}
                      htmlFor={`aud-${opt.value}`}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        (formData.audience_type || 'none') === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={opt.value} id={`aud-${opt.value}`} />
                      <div>
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </>
        )}

        {step === 'budget' && (
          <>
            <CardHeader>
              <CardTitle>Budget, Biedingen & Planning</CardTitle>
              <CardDescription>Stel je budget, biedstrategie en looptijd in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Budget Type</Label>
                <Select 
                  value={formData.budget_type}
                  onValueChange={(v) => setFormData({ ...formData, budget_type: v as 'daily' | 'lifetime' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Dagbudget</SelectItem>
                    <SelectItem value="lifetime">Totaalbudget</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Budget</Label>
                  <span className="text-lg font-semibold">€{formData.budget_amount}</span>
                </div>
                <Slider
                  value={[formData.budget_amount]}
                  onValueChange={([v]) => setFormData({ ...formData, budget_amount: v })}
                  min={5} max={500} step={5}
                />
                <p className="text-sm text-muted-foreground">
                  {formData.budget_type === 'daily' 
                    ? `Geschatte maandelijkse uitgaven: €${formData.budget_amount * 30}`
                    : 'Dit budget wordt over de hele looptijd verdeeld'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Doel ROAS</Label>
                  <span className="text-lg font-semibold">{formData.target_roas}x</span>
                </div>
                <Slider
                  value={[formData.target_roas]}
                  onValueChange={([v]) => setFormData({ ...formData, target_roas: v })}
                  min={1} max={10} step={0.5}
                />
                <p className="text-sm text-muted-foreground">
                  Voor elke €1 advertentie-uitgave verwacht je €{formData.target_roas} omzet
                </p>
              </div>

              {/* Date pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Startdatum</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.start_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.start_date ? format(formData.start_date, 'dd MMM yyyy', { locale: nl }) : 'Kies datum'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.start_date}
                        onSelect={(d) => setFormData({ ...formData, start_date: d })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Einddatum (optioneel)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.end_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.end_date ? format(formData.end_date, 'dd MMM yyyy', { locale: nl }) : 'Kies datum'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.end_date}
                        onSelect={(d) => setFormData({ ...formData, end_date: d })}
                        disabled={(date) => formData.start_date ? date < formData.start_date : false}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {step === 'review' && (
          <>
            <CardHeader>
              <CardTitle>Controleer Campagne</CardTitle>
              <CardDescription>Bekijk je instellingen voordat je de campagne aanmaakt</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Platform</dt>
                  <dd className="font-medium">{formData.platform && AD_PLATFORMS[formData.platform].name}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Naam</dt>
                  <dd className="font-medium">{formData.name}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{formData.campaign_type && CAMPAIGN_TYPES[formData.campaign_type].name}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Producten</dt>
                  <dd className="font-medium">{formData.product_ids.length || 'Alle'}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Doelgroep</dt>
                  <dd className="font-medium">
                    {formData.segment_id 
                      ? segments.find(s => s.id === formData.segment_id)?.name || 'Segment'
                      : formData.audience_type || 'Alle klanten'}
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Budget</dt>
                  <dd className="font-medium">€{formData.budget_amount} {formData.budget_type === 'daily' ? '/dag' : 'totaal'}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Doel ROAS</dt>
                  <dd className="font-medium">{formData.target_roas}x</dd>
                </div>
                {formData.start_date && (
                  <div className="flex justify-between py-2 border-b">
                    <dt className="text-muted-foreground">Startdatum</dt>
                    <dd className="font-medium">{format(formData.start_date, 'dd MMM yyyy', { locale: nl })}</dd>
                  </div>
                )}
                {formData.end_date && (
                  <div className="flex justify-between py-2">
                    <dt className="text-muted-foreground">Einddatum</dt>
                    <dd className="font-medium">{format(formData.end_date, 'dd MMM yyyy', { locale: nl })}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </>
        )}

        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStepIndex === 0 ? 'Annuleren' : 'Vorige'}
          </Button>
          
          {step === 'review' ? (
            <Button onClick={handleSubmit} disabled={createCampaign.isPending}>
              {createCampaign.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Aanmaken...</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Campagne Aanmaken</>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Volgende
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
