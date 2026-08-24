import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { useAdPlatforms } from '@/hooks/useAdPlatforms';
import { useProducts } from '@/hooks/useProducts';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import { AD_PLATFORMS, CAMPAIGN_TYPES, type AdPlatform, type CampaignType, type AdCampaign, type BidStrategy } from '@/types/ads';
import { ArrowLeft, ArrowRight, Check, Loader2, Search, Package, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CampaignWizardProps {
  onClose: () => void;
  campaign?: AdCampaign | null;
}

type WizardStep = 'platform' | 'type' | 'products' | 'audience' | 'budget' | 'review';

export function CampaignWizard({ onClose, campaign }: CampaignWizardProps) {
  const { t } = useTranslation();
  const { createCampaign, updateCampaign } = useAdCampaigns();
  const { connectedPlatforms, isConnected } = useAdPlatforms();
  const { products } = useProducts();
  const { segments } = useCustomerSegments();
  const isEditMode = !!campaign;
  
  const [step, setStep] = useState<WizardStep>(isEditMode ? 'type' : 'platform');
  const [productSearch, setProductSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    platform: '' as AdPlatform | '',
    campaign_type: '' as CampaignType | '',
    product_ids: [] as string[],
    segment_id: '' as string,
    budget_type: 'daily' as 'daily' | 'lifetime',
    budget_amount: 25,
    target_roas: 4,
    bid_strategy: 'auto' as BidStrategy,
  });

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        platform: campaign.platform as AdPlatform,
        campaign_type: campaign.campaign_type as CampaignType,
        product_ids: campaign.product_ids || [],
        segment_id: campaign.segment_id || '',
        budget_type: (campaign.budget_type as 'daily' | 'lifetime') || 'daily',
        budget_amount: campaign.budget_amount || 25,
        target_roas: campaign.target_roas || 4,
        bid_strategy: (campaign.bid_strategy as BidStrategy) || 'auto',
      });
    }
  }, [campaign]);

  const steps: WizardStep[] = isEditMode 
    ? ['type', 'products', 'audience', 'budget', 'review']
    : ['platform', 'type', 'products', 'audience', 'budget', 'review'];
  const currentStepIndex = steps.indexOf(step);

  const canProceed = () => {
    switch (step) {
      case 'platform': return !!formData.platform;
      case 'type': return !!formData.campaign_type && !!formData.name;
      case 'products': return true; // optional
      case 'audience': return true; // optional
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
    
    if (isEditMode && campaign) {
      await updateCampaign.mutateAsync({
        id: campaign.id,
        name: formData.name,
        budget_type: formData.budget_type,
        budget_amount: formData.budget_amount,
        target_roas: formData.target_roas,
      });
    } else {
      await createCampaign.mutateAsync({
        name: formData.name,
        platform: formData.platform as AdPlatform,
        campaign_type: formData.campaign_type as CampaignType,
        product_ids: formData.product_ids.length > 0 ? formData.product_ids : undefined,
        segment_id: formData.segment_id || undefined,
        budget_type: formData.budget_type,
        budget_amount: formData.budget_amount,
        bid_strategy: formData.bid_strategy,
        target_roas: formData.target_roas,
      });
    }
    
    onClose();
  };

  const toggleProduct = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      product_ids: prev.product_ids.includes(productId)
        ? prev.product_ids.filter(id => id !== productId)
        : [...prev.product_ids, productId]
    }));
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const availableCampaignTypes = formData.platform 
    ? Object.entries(CAMPAIGN_TYPES).filter(([_, info]) => 
        info.platforms.includes(formData.platform as AdPlatform)
      )
    : [];

  const isPending = createCampaign.isPending || updateCampaign.isPending;

  const stepLabels: Record<WizardStep, string> = {
    platform: 'Platform',
    type: 'Details',
    products: 'Producten',
    audience: 'Doelgroep',
    budget: 'Budget',
    review: 'Controleer',
  };

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
              <span className="text-xs text-muted-foreground mt-1 hidden sm:block">{stepLabels[s]}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mx-1 sm:mx-2 ${
                i < currentStepIndex ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        {step === 'platform' && (
          <>
            <CardHeader>
              <CardTitle>{t('admin.ads.campaignWizard.kies_platform')}</CardTitle>
              <CardDescription>{t('admin.ads.campaignWizard.op_welk_platform_wil_je_adverteren')}</CardDescription>
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
                          : connected 
                          ? 'hover:bg-muted/50' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <RadioGroupItem 
                        value={platform} 
                        id={platform} 
                        disabled={!connected}
                      />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${info.color}`}>
                        {info.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{info.name}</p>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                      </div>
                      {!connected && (
                        <span className="text-xs text-muted-foreground">{t('admin.ads.campaignWizard.niet_gekoppeld')}</span>
                      )}
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
              <CardTitle>{t('admin.ads.campaignWizard.campagne_details')}</CardTitle>
              <CardDescription>{t('admin.ads.campaignWizard.geef_je_campagne_een_naam_en')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">{t('admin.ads.bolCampaignEditForm.campagnenaam')}</Label>
                <Input
                  id="name"
                  placeholder={t('admin.ads.campaignWizard.bijv_zomercollectie_2026')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {!isEditMode && (
                <div className="space-y-2">
                  <Label>{t('admin.ads.campaignWizard.campagne_type')}</Label>
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
              )}

              {isEditMode && (
                <div className="flex justify-between py-2 border rounded-lg px-3">
                  <span className="text-muted-foreground">{t('admin.marketing.contentHistoryList.type')}</span>
                  <span className="font-medium">
                    {formData.campaign_type && CAMPAIGN_TYPES[formData.campaign_type as CampaignType]?.name}
                  </span>
                </div>
              )}
            </CardContent>
          </>
        )}

        {step === 'products' && (
          <>
            <CardHeader>
              <CardTitle>{t('admin.ads.campaignWizard.producten_selecteren')}</CardTitle>
              <CardDescription>
                {t('admin.ads.campaignWizard.kies_welke_producten_je_wilt_adverteren')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.ads.campaignWizard.zoek_producten')}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {formData.product_ids.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {formData.product_ids.length} geselecteerd
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFormData({ ...formData, product_ids: [] })}
                  >
                    {t('admin.ads.campaignWizard.alles_deselecteren')}
                  </Button>
                </div>
              )}

              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">{t('admin.marketing.productSelectDialog.geen_producten_gevonden')}</p>
                    </div>
                  ) : (
                    filteredProducts.map(product => (
                      <label
                        key={product.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          formData.product_ids.includes(product.id) 
                            ? 'bg-primary/5 border border-primary/20' 
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={formData.product_ids.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        {product.images?.[0] && (
                          <img 
                            src={product.images[0]} 
                            alt="" 
                            className="w-8 h-8 rounded object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          {product.sku && (
                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          €{product.price?.toFixed(2)}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </>
        )}

        {step === 'audience' && (
          <>
            <CardHeader>
              <CardTitle>{t('admin.marketing.campaignDialog.doelgroep')}</CardTitle>
              <CardDescription>
                {t('admin.ads.campaignWizard.koppel_een_klantsegment_aan_deze_campagne')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={formData.segment_id || 'none'}
                onValueChange={(v) => setFormData({ ...formData, segment_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.ads.campaignWizard.kies_een_segment')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('admin.ads.campaignWizard.alle_klanten_geen_segment')}</SelectItem>
                  {segments.map(segment => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name} ({segment.member_count || 0} klanten)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {segments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg">
                  <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('admin.ads.campaignWizard.nog_geen_klantsegmenten_aangemaakt')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('admin.ads.campaignWizard.je_kunt_segmenten_aanmaken_bij_marketing')}
                  </p>
                </div>
              )}

              {formData.segment_id && segments.find(s => s.id === formData.segment_id) && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="text-sm font-medium">
                    {segments.find(s => s.id === formData.segment_id)?.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {segments.find(s => s.id === formData.segment_id)?.member_count || 0} klanten in dit segment
                  </p>
                </div>
              )}
            </CardContent>
          </>
        )}

        {step === 'budget' && (
          <>
            <CardHeader>
              <CardTitle>{t('admin.ads.campaignWizard.budget_biedingen')}</CardTitle>
              <CardDescription>{t('admin.ads.campaignWizard.stel_je_budget_en_biedstrategie_in')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {formData.platform === 'bol_ads' && (
                <div className="space-y-3">
                  <Label>{t('admin.ads.campaignWizard.campagne_modus_bol_com')}</Label>
                  <RadioGroup
                    value={formData.bid_strategy}
                    onValueChange={(v) => setFormData({ ...formData, bid_strategy: v as BidStrategy })}
                    className="grid gap-2"
                  >
                    <Label
                      htmlFor="bid-auto"
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.bid_strategy === 'auto' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value="auto" id="bid-auto" className="mt-0.5" />
                      <div>
                        <p className="font-medium">{t('admin.ads.campaignWizard.automatisch_aanbevolen')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('admin.ads.campaignWizard.bol_optimaliseert_biedingen_automatisch_op_basis')}
                        </p>
                      </div>
                    </Label>
                    <Label
                      htmlFor="bid-manual"
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.bid_strategy === 'manual_cpc' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value="manual_cpc" id="bid-manual" className="mt-0.5" />
                      <div>
                        <p className="font-medium">{t('admin.odooChannels.channels.manual')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('admin.ads.campaignWizard.je_stelt_zelf_keywords_en_biedingen')}
                        </p>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('admin.ads.campaignWizard.budget_type')}</Label>
                <Select 
                  value={formData.budget_type}
                  onValueChange={(v) => setFormData({ ...formData, budget_type: v as 'daily' | 'lifetime' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t('admin.ads.campaignWizard.dagbudget')}</SelectItem>
                    <SelectItem value="lifetime">{t('admin.ads.campaignWizard.totaalbudget')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>{t('admin.ads.campaignWizard.budget')}</Label>
                  <span className="text-lg font-semibold">€{formData.budget_amount}</span>
                </div>
                <Slider
                  value={[formData.budget_amount]}
                  onValueChange={([v]) => setFormData({ ...formData, budget_amount: v })}
                  min={5}
                  max={500}
                  step={5}
                />
                <p className="text-sm text-muted-foreground">
                  {formData.budget_type === 'daily' 
                    ? `Geschatte maandelijkse uitgaven: €${formData.budget_amount * 30}`
                    : 'Dit budget wordt over de hele looptijd verdeeld'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>{t('admin.ads.campaignWizard.doel_roas')}</Label>
                  <span className="text-lg font-semibold">{formData.target_roas}x</span>
                </div>
                <Slider
                  value={[formData.target_roas]}
                  onValueChange={([v]) => setFormData({ ...formData, target_roas: v })}
                  min={1}
                  max={10}
                  step={0.5}
                />
                <p className="text-sm text-muted-foreground">
                  Voor elke €1 advertentie-uitgave verwacht je €{formData.target_roas} omzet
                </p>
              </div>
            </CardContent>
          </>
        )}

        {step === 'review' && (
          <>
            <CardHeader>
              <CardTitle>{isEditMode ? t('admin.ads.campaignWizard.wijzigingen_controleren') : t('admin.ads.campaignWizard.controleer_campagne')}</CardTitle>
              <CardDescription>Bekijk je instellingen voordat je {isEditMode ? 'opslaat' : 'de campagne aanmaakt'}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">{t('admin.marketing.contentHistoryList.platform')}</dt>
                  <dd className="font-medium">
                    {formData.platform && AD_PLATFORMS[formData.platform].name}
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">{t('common.name')}</dt>
                  <dd className="font-medium">{formData.name}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">{t('admin.marketing.contentHistoryList.type')}</dt>
                  <dd className="font-medium">
                    {formData.campaign_type && CAMPAIGN_TYPES[formData.campaign_type as CampaignType]?.name}
                  </dd>
                </div>
                {formData.platform === 'bol_ads' && (
                  <div className="flex justify-between py-2 border-b">
                    <dt className="text-muted-foreground">{t('admin.ads.bolCampaignEditForm.campagne_modus')}</dt>
                    <dd className="font-medium">
                      {formData.bid_strategy === 'auto' ? t('admin.ads.campaignWizard.automatisch') : t('admin.odooChannels.channels.manual')}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">{t('admin.marketing.mediaAssetsLibrary.folders.producten')}</dt>
                  <dd className="font-medium">
                    {formData.product_ids.length > 0 
                      ? `${formData.product_ids.length} geselecteerd`
                      : 'Alle producten'}
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">{t('admin.marketing.campaignDialog.doelgroep')}</dt>
                  <dd className="font-medium">
                    {formData.segment_id 
                      ? segments.find(s => s.id === formData.segment_id)?.name || 'Segment'
                      : 'Alle klanten'}
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">{t('admin.ads.campaignWizard.budget_2')}</dt>
                  <dd className="font-medium">
                    €{formData.budget_amount} {formData.budget_type === 'daily' ? '/dag' : 'totaal'}
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">{t('admin.ads.campaignWizard.doel_roas_2')}</dt>
                  <dd className="font-medium">{formData.target_roas}x</dd>
                </div>
              </dl>
            </CardContent>
          </>
        )}

        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStepIndex === 0 ? t('common.cancel') : t('admin.products.bulkAIGenerateDialog.vorige')}
          </Button>
          
          {step === 'review' ? (
            <Button 
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? t('common.saving') : t('admin.promotions.giftCardFormDialog.aanmaken')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {isEditMode ? t('common.save') : t('admin.ads.campaignWizard.campagne_aanmaken')}
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t('common.next')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
