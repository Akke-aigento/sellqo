import { useState } from 'react';
import { 
  Mail, Sparkles, Loader2, Check, Copy, 
  Users, AlertTriangle, Gift, Package
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAIMarketing } from '@/hooks/useAIMarketing';
import { useAICredits } from '@/hooks/useAICredits';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import { useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { CampaignDialog } from '@/components/admin/marketing/CampaignDialog';
import { ProductSelectDialog } from './ProductSelectDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

type CampaignType = 'newsletter' | 'promotion' | 'win_back' | 'new_product' | 'low_stock' | 'custom';

// Labels staan als i18n-key; `id` blijft de CampaignType-enumwaarde.
const campaignTypes = [
  { id: 'newsletter' as CampaignType, nameKey: 'admin.marketing.aiEmailPlanner.campaignTypes.newsletter.name', icon: Mail, descriptionKey: 'admin.marketing.aiEmailPlanner.campaignTypes.newsletter.description', color: 'bg-blue-500', needsProducts: false },
  { id: 'promotion' as CampaignType, nameKey: 'admin.marketing.aiEmailPlanner.campaignTypes.promotion.name', icon: Gift, descriptionKey: 'admin.marketing.aiEmailPlanner.campaignTypes.promotion.description', color: 'bg-green-500', needsProducts: true },
  { id: 'win_back' as CampaignType, nameKey: 'admin.marketing.aiEmailPlanner.campaignTypes.win_back.name', icon: Users, descriptionKey: 'admin.marketing.aiEmailPlanner.campaignTypes.win_back.description', color: 'bg-purple-500', needsProducts: false },
  { id: 'new_product' as CampaignType, nameKey: 'admin.marketing.aiEmailPlanner.campaignTypes.new_product.name', icon: Package, descriptionKey: 'admin.marketing.aiEmailPlanner.campaignTypes.new_product.description', color: 'bg-pink-500', needsProducts: true },
  { id: 'low_stock' as CampaignType, nameKey: 'admin.marketing.aiEmailPlanner.campaignTypes.low_stock.name', icon: AlertTriangle, descriptionKey: 'admin.marketing.aiEmailPlanner.campaignTypes.low_stock.description', color: 'bg-amber-500', needsProducts: false },
];

interface EmailContentResult {
  subjectLines: string[];
  previewText: string;
  greeting: string;
  body: string;
  cta: { text: string; url: string };
  closing: string;
  htmlContent: string;
}

interface AIEmailPlannerProps {
  initialCampaignType?: CampaignType;
  initialProductIds?: string[];
}

export function AIEmailPlanner({ initialCampaignType, initialProductIds }: AIEmailPlannerProps) {
  const { t, i18n } = useTranslation();
  const [campaignType, setCampaignType] = useState<CampaignType>(initialCampaignType || 'newsletter');
  const [segmentId, setSegmentId] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [includeDiscount, setIncludeDiscount] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState(10);
  const [generatedContent, setGeneratedContent] = useState<EmailContentResult | null>(null);
  const [selectedSubject, setSelectedSubject] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialProductIds || []);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);

  const { generateEmailContent, context } = useAIMarketing();
  const { hasCredits, getCreditCost } = useAICredits();
  const { segments } = useCustomerSegments();
  const { createCampaign } = useEmailCampaigns();

  const creditCost = getCreditCost('email_content');
  const canGenerate = hasCredits(creditCost);
  const selectedType = campaignTypes.find((type) => type.id === campaignType);
  const needsProducts = selectedType?.needsProducts;

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast.error('Onvoldoende AI credits');
      return;
    }

    const result = await generateEmailContent.mutateAsync({
      campaignType,
      segmentId: segmentId || undefined,
      customPrompt: campaignType === 'custom' ? customPrompt : undefined,
      includeDiscount,
      discountPercentage,
      productIds: needsProducts && selectedProductIds.length > 0 ? selectedProductIds : undefined,
    });

    setGeneratedContent(result);
    setSelectedSubject(0);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Gekopieerd!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleUseCampaign = () => {
    if (!generatedContent) return;
    setCampaignDialogOpen(true);
  };

  const handleSaveCampaign = async (data: any) => {
    try {
      await createCampaign.mutateAsync(data);
      toast.success('Campagne opgeslagen als concept!');
      setCampaignDialogOpen(false);
    } catch (error) {
      toast.error('Fout bij opslaan campagne');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
              <Mail className="h-4 w-4 text-white" />
            </div>
            {t('admin.marketing.aIEmailPlanner.ai_email_planner')}
          </CardTitle>
          <CardDescription>
            {t('admin.marketing.aIEmailPlanner.laat_ai_je_email_campagne_content')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campaign Type Selection */}
          <div className="space-y-3">
            <Label>{t('admin.marketing.aIEmailPlanner.type_campagne')}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {campaignTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setCampaignType(type.id);
                    if (!type.needsProducts) {
                      setSelectedProductIds([]);
                    }
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                    campaignType === type.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'hover:border-primary/50'
                  )}
                >
                  <div className={cn('p-2 rounded-lg', type.color)}>
                    <type.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">{t(type.nameKey)}</span>
                  <span className="text-xs text-muted-foreground text-center">
                    {t(type.descriptionKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Segment Selection */}
          <div className="space-y-2">
            <Label>{t('admin.marketing.aIEmailPlanner.doelgroep_segment_optioneel')}</Label>
            <Select value={segmentId || "all"} onValueChange={(val) => setSegmentId(val === "all" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder={t('admin.marketing.aIEmailPlanner.alle_abonnees_2')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.marketing.aIEmailPlanner.alle_abonnees')}</SelectItem>
                {segments.map((seg) => (
                  <SelectItem key={seg.id} value={seg.id}>
                    {seg.name} ({seg.member_count} klanten)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Selection */}
          {needsProducts && (
            <div className="space-y-2">
              <Label>{t('admin.marketing.aIEmailPlanner.producten_optioneel')}</Label>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setProductDialogOpen(true)}
              >
                <Package className="h-4 w-4 mr-2" />
                {selectedProductIds.length > 0 
                  ? t('admin.marketing.aiEmailPlanner.producten_geselecteerd', { count: selectedProductIds.length })
                  : 'Kies producten om te promoten'
                }
              </Button>
              {selectedProductIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProductIds([])}
                  className="text-muted-foreground"
                >
                  {t('admin.marketing.aIEmailPlanner.selectie_wissen')}
                </Button>
              )}
            </div>
          )}

          {/* Discount Toggle */}
          {(campaignType === 'promotion' || campaignType === 'win_back') && (
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label>{t('admin.marketing.inlinePromoWizard.korting_toevoegen')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('admin.marketing.aIEmailPlanner.voeg_een_kortingspercentage_toe_aan_de')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {includeDiscount && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={5}
                      max={50}
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                      className="w-16 h-8"
                    />
                    <span className="text-sm">%</span>
                  </div>
                )}
                <Switch
                  checked={includeDiscount}
                  onCheckedChange={setIncludeDiscount}
                />
              </div>
            </div>
          )}

          {/* Custom prompt for custom type */}
          {campaignType === 'custom' && (
            <div className="space-y-2">
              <Label>{t('admin.marketing.aIEmailPlanner.beschrijf_je_campagne')}</Label>
              <Textarea
                placeholder={t('admin.marketing.aIEmailPlanner.wat_wil_je_communiceren_welke_producten')}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generateEmailContent.isPending || !canGenerate}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {generateEmailContent.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('admin.marketing.aIEmailPlanner.email_genereren')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Genereer Email Content ({creditCost} credits)
              </>
            )}
          </Button>

          {/* Generated Content */}
          {generatedContent && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                {selectedType?.icon && <selectedType.icon className="h-5 w-5" />}
                <span className="font-medium">{selectedType ? t(selectedType.nameKey) : ''} Email</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {t('admin.marketing.aIEmailPlanner.ai_gegenereerd')}
                </Badge>
              </div>

              <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content">{t('admin.marketing.aIEmailPlanner.content')}</TabsTrigger>
                  <TabsTrigger value="subjects">{t('admin.marketing.aIEmailPlanner.onderwerpen')}</TabsTrigger>
                  <TabsTrigger value="preview">{t('admin.marketing.emailPreview.preview')}</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4 mt-4">
                  {/* Subject Lines */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('admin.marketing.aIEmailPlanner.onderwerpregel')}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(generatedContent.subjectLines[selectedSubject], 'subject')}
                      >
                        {copiedField === 'subject' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {generatedContent.subjectLines.map((subject, i) => (
                        <Badge
                          key={i}
                          variant={selectedSubject === i ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setSelectedSubject(i)}
                        >
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Preview Text */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('admin.marketing.aIEmailPlanner.preview_tekst')}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(generatedContent.previewText, 'preview')}
                      >
                        {copiedField === 'preview' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-sm p-2 bg-background rounded border">
                      {generatedContent.previewText}
                    </p>
                  </div>

                  {/* Body */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('admin.marketing.aIEmailPlanner.email_inhoud')}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(generatedContent.body, 'body')}
                      >
                        {copiedField === 'body' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div 
                      className="text-sm p-3 bg-background rounded border prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: generatedContent.body }}
                    />
                  </div>

                  {/* CTA */}
                  <div className="space-y-2">
                    <Label>{t('admin.marketing.aIEmailPlanner.call_to_action')}</Label>
                    <div className="flex items-center gap-2">
                      <Button className="pointer-events-none">
                        {generatedContent.cta.text}
                      </Button>
                      <span className="text-xs text-muted-foreground">→ {generatedContent.cta.url}</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="subjects" className="space-y-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('admin.marketing.aIEmailPlanner.kies_de_beste_onderwerpregel_voor_je')}
                  </p>
                  {generatedContent.subjectLines.map((subject, i) => (
                    <div
                      key={i}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedSubject === i ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      )}
                      onClick={() => setSelectedSubject(i)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{subject}</span>
                        {selectedSubject === i && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {subject.length} karakters
                      </p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted p-2 text-xs text-muted-foreground">
                      {t('admin.marketing.aIEmailPlanner.email_preview')}
                    </div>
                    <iframe
                      srcDoc={generatedContent.htmlContent}
                      className="w-full h-[400px] bg-white"
                      title={t('admin.marketing.aIEmailPlanner.email_preview')}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Use in Campaign Button */}
              <Button 
                className="w-full" 
                variant="outline"
                onClick={handleUseCampaign}
              >
                <Mail className="mr-2 h-4 w-4" />
                {t('admin.marketing.aIEmailPlanner.gebruik_in_nieuwe_campagne')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductSelectDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        selectedIds={selectedProductIds}
        onSelect={setSelectedProductIds}
        maxSelect={10}
      />

      <CampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        onSave={handleSaveCampaign}
        isLoading={createCampaign.isPending}
        defaultValues={generatedContent ? {
          name: `AI ${selectedType ? t(selectedType.nameKey) : t('admin.marketing.aiEmailPlanner.campagne')} - ${new Date().toLocaleDateString(i18n.language)}`,
          subject: generatedContent.subjectLines[selectedSubject],
          preview_text: generatedContent.previewText,
          html_content: generatedContent.htmlContent,
          segment_id: segmentId || '',
        } : undefined}
        isAIGenerated
      />
    </>
  );
}
