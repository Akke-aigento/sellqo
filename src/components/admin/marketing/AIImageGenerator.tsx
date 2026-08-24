import { useState } from 'react';
import { 
  ImageIcon, Sparkles, Loader2, Download, Trash2, 
  Copy, Check, Wand2, Package, ImagePlus
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIImages } from '@/hooks/useAIImages';
import { useAICredits } from '@/hooks/useAICredits';
import { useProducts } from '@/hooks/useProducts';
import { ProductSelectDialog } from './ProductSelectDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

type ImageStyle = 'product_photo' | 'lifestyle' | 'flat_lay' | 'minimalist' | 'vibrant' | 'custom';
type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';
type EnhancementType = 'generate' | 'enhance' | 'background_remove' | 'overlay';
type PlatformPreset = 'instagram_post' | 'instagram_story' | 'facebook_banner' | 'email_header' | 'linkedin_post' | 'custom';
type SettingPreset = 'lifestyle' | 'summer' | 'winter' | 'spring' | 'kitchen' | 'living_room' | 'office' | 'outdoor' | 'studio' | 'gradient' | 'geometric' | 'custom';

// Labels staan als i18n-key; `id` blijft de ImageStyle-enumwaarde.
const styles: { id: ImageStyle; nameKey: string; descriptionKey: string }[] = [
  { id: 'product_photo', nameKey: 'admin.marketing.aiImageGenerator.styles.product_photo.name', descriptionKey: 'admin.marketing.aiImageGenerator.styles.product_photo.description' },
  { id: 'lifestyle', nameKey: 'admin.marketing.aiImageGenerator.styles.lifestyle.name', descriptionKey: 'admin.marketing.aiImageGenerator.styles.lifestyle.description' },
  { id: 'flat_lay', nameKey: 'admin.marketing.aiImageGenerator.styles.flat_lay.name', descriptionKey: 'admin.marketing.aiImageGenerator.styles.flat_lay.description' },
  { id: 'minimalist', nameKey: 'admin.marketing.aiImageGenerator.styles.minimalist.name', descriptionKey: 'admin.marketing.aiImageGenerator.styles.minimalist.description' },
  { id: 'vibrant', nameKey: 'admin.marketing.aiImageGenerator.styles.vibrant.name', descriptionKey: 'admin.marketing.aiImageGenerator.styles.vibrant.description' },
  { id: 'custom', nameKey: 'admin.marketing.aiImageGenerator.styles.custom.name', descriptionKey: 'admin.marketing.aiImageGenerator.styles.custom.description' },
];

const sizes: { id: ImageSize; nameKey: string; ratio: string }[] = [
  { id: '1024x1024', nameKey: 'admin.marketing.aiImageGenerator.sizes.1024_1024.name', ratio: '1:1' },
  { id: '1792x1024', nameKey: 'admin.marketing.aiImageGenerator.sizes.1792_1024.name', ratio: '16:9' },
  { id: '1024x1792', nameKey: 'admin.marketing.aiImageGenerator.sizes.1024_1792.name', ratio: '9:16' },
];

const settingPresets: { id: SettingPreset; nameKey: string; descriptionKey: string }[] = [
  { id: 'lifestyle', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.lifestyle.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.lifestyle.description' },
  { id: 'summer', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.summer.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.summer.description' },
  { id: 'winter', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.winter.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.winter.description' },
  { id: 'spring', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.spring.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.spring.description' },
  { id: 'kitchen', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.kitchen.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.kitchen.description' },
  { id: 'living_room', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.living_room.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.living_room.description' },
  { id: 'office', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.office.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.office.description' },
  { id: 'outdoor', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.outdoor.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.outdoor.description' },
  { id: 'studio', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.studio.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.studio.description' },
  { id: 'gradient', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.gradient.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.gradient.description' },
  { id: 'geometric', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.geometric.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.geometric.description' },
  { id: 'custom', nameKey: 'admin.marketing.aiImageGenerator.settingPresets.custom.name', descriptionKey: 'admin.marketing.aiImageGenerator.settingPresets.custom.description' },
];

// `dimensions` is een pixelmaat en blijft letterlijk; alleen 'custom' toont tekst.
const platformPresets: { id: PlatformPreset; nameKey: string; dimensions?: string; dimensionsKey?: string }[] = [
  { id: 'instagram_post', nameKey: 'admin.marketing.aiImageGenerator.platformPresets.instagram_post.name', dimensions: '1080×1080' },
  { id: 'instagram_story', nameKey: 'admin.marketing.aiImageGenerator.platformPresets.instagram_story.name', dimensions: '1080×1920' },
  { id: 'facebook_banner', nameKey: 'admin.marketing.aiImageGenerator.platformPresets.facebook_banner.name', dimensions: '1200×628' },
  { id: 'email_header', nameKey: 'admin.marketing.aiImageGenerator.platformPresets.email_header.name', dimensions: '600×200' },
  { id: 'linkedin_post', nameKey: 'admin.marketing.aiImageGenerator.platformPresets.linkedin_post.name', dimensions: '1200×627' },
  { id: 'custom', nameKey: 'admin.marketing.aiImageGenerator.platformPresets.custom.name', dimensionsKey: 'admin.marketing.aiImageGenerator.platformPresets.custom.dimensions' },
];

export function AIImageGenerator() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const [activeTab, setActiveTab] = useState<'generate' | 'enhance'>('generate');
  
  // Generate tab state
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ImageStyle>('product_photo');
  const [size, setSize] = useState<ImageSize>('1024x1024');
  
  // Enhance tab state
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [settingPreset, setSettingPreset] = useState<SettingPreset>('lifestyle');
  const [customSetting, setCustomSetting] = useState('');
  const [marketingText, setMarketingText] = useState('');
  const [platformPreset, setPlatformPreset] = useState<PlatformPreset>('instagram_post');
  const [enhancePrompt, setEnhancePrompt] = useState('');
  
  const [copied, setCopied] = useState<string | null>(null);

  const { images, isLoading, generateImage, deleteImage } = useAIImages();
  const { hasCredits, getCreditCost } = useAICredits();
  const { products } = useProducts();

  const creditCost = getCreditCost('image_generation');
  const selectedProduct = products.find(p => p.id === selectedProductIds[0]);
  const productImageUrl = selectedProduct?.images?.[0];

  const canGenerate = hasCredits(creditCost) && prompt.trim().length > 0;
  const canEnhance = hasCredits(creditCost) && selectedProductIds.length > 0 && productImageUrl;

  const handleGenerate = async () => {
    if (!canGenerate) {
      if (!prompt.trim()) {
        toast.error('Voer een beschrijving in');
        return;
      }
      toast.error('Onvoldoende AI credits');
      return;
    }

    const [width, height] = size.split('x').map(Number);
    
    await generateImage.mutateAsync({
      prompt: prompt.trim(),
      style: style !== 'custom' ? style : undefined,
      width,
      height,
    });
  };

  const handleEnhance = async () => {
    if (!canEnhance) {
      if (!selectedProductIds.length) {
        toast.error('Selecteer eerst een product');
        return;
      }
      if (!productImageUrl) {
        toast.error('Dit product heeft geen afbeelding');
        return;
      }
      toast.error('Onvoldoende AI credits');
      return;
    }

    const finalSetting = settingPreset === 'custom' ? customSetting : settingPreset;
    
    await generateImage.mutateAsync({
      prompt: enhancePrompt || t('admin.marketing.aiImageGenerator.marketingafbeelding_voor', { product: selectedProduct?.name ?? '' }),
      sourceImageUrl: productImageUrl,
      sourceProductId: selectedProductIds[0],
      settingPreset: finalSetting,
      marketingText: marketingText || undefined,
      platformPreset,
      enhancementType: 'enhance',
    });
  };

  const handleCopy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    toast.success('URL gekopieerd!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-image-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <Wand2 className="h-4 w-4 text-white" />
            </div>
            {t('admin.marketing.aIImageGenerator.ai_afbeelding_generator')}
          </CardTitle>
          <CardDescription>
            {t('admin.marketing.aIImageGenerator.genereer_of_bewerk_afbeeldingen_voor_je')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'generate' | 'enhance')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="generate" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {t('admin.marketing.aIImageGenerator.genereer_nieuw')}
              </TabsTrigger>
              <TabsTrigger value="enhance" className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                {t('admin.marketing.aIImageGenerator.bewerk_productfoto')}
              </TabsTrigger>
            </TabsList>

            {/* Generate New Tab */}
            <TabsContent value="generate" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>{t('admin.marketing.emailBlockProperties.beschrijving')}</Label>
                <Textarea
                  placeholder={t('admin.marketing.aIImageGenerator.beschrijf_de_afbeelding_die_je_wilt')}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.marketing.aIImageGenerator.tip_wees_specifiek_over_kleuren_stijl')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('admin.marketing.emailBlockProperties.stijl')}</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as ImageStyle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex flex-col">
                          <span>{t(s.nameKey)}</span>
                          <span className="text-xs text-muted-foreground">{t(s.descriptionKey)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('admin.marketing.aIImageGenerator.formaat')}</Label>
                <div className="flex gap-2">
                  {sizes.map((s) => (
                    <Button
                      key={s.id}
                      variant={size === s.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSize(s.id)}
                      className="flex-1"
                    >
                      <span className="font-medium">{t(s.nameKey)}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {s.ratio}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateImage.isPending || !canGenerate}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                {generateImage.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('admin.marketing.aIImageGenerator.genereren')}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Genereer Afbeelding ({creditCost} credits)
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Enhance Product Photo Tab */}
            <TabsContent value="enhance" className="space-y-4 mt-0">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label>{t('admin.marketing.aIImageGenerator.selecteer_product')}</Label>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setProductDialogOpen(true)}
                >
                  {selectedProduct ? (
                    <div className="flex items-center gap-3">
                      {productImageUrl && (
                        <img 
                          src={productImageUrl} 
                          alt={selectedProduct.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                      )}
                      <span className="truncate">{selectedProduct.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      {t('admin.marketing.aIImageGenerator.kies_een_product')}
                    </div>
                  )}
                </Button>
                {selectedProduct && !productImageUrl && (
                  <p className="text-xs text-destructive">
                    {t('admin.marketing.aIImageGenerator.dit_product_heeft_geen_afbeelding')}
                  </p>
                )}
              </div>

              {/* Setting Preset */}
              <div className="space-y-2">
                <Label>{t('admin.marketing.aIImageGenerator.setting_omgeving')}</Label>
                <Select value={settingPreset} onValueChange={(v) => setSettingPreset(v as SettingPreset)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {settingPresets.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex flex-col">
                          <span>{t(s.nameKey)}</span>
                          <span className="text-xs text-muted-foreground">{t(s.descriptionKey)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {settingPreset === 'custom' && (
                  <Input
                    placeholder={t('admin.marketing.aIImageGenerator.beschrijf_je_eigen_setting')}
                    value={customSetting}
                    onChange={(e) => setCustomSetting(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              {/* Marketing Text */}
              <div className="space-y-2">
                <Label>{t('admin.marketing.aIImageGenerator.marketing_tekst_optioneel')}</Label>
                <Input
                  placeholder={t('admin.marketing.aIImageGenerator.bv_30_korting_of_nieuw')}
                  value={marketingText}
                  onChange={(e) => setMarketingText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.marketing.aIImageGenerator.tekst_die_op_de_afbeelding_wordt')}
                </p>
              </div>

              {/* Platform Preset */}
              <div className="space-y-2">
                <Label>{t('admin.marketing.aIImageGenerator.doelformaat')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {platformPresets.map((p) => (
                    <Button
                      key={p.id}
                      variant={platformPreset === p.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPlatformPreset(p.id)}
                      className="justify-start h-auto py-2"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-xs">{t(p.nameKey)}</span>
                        <span className="text-[10px] opacity-70">{p.dimensionsKey ? t(p.dimensionsKey) : p.dimensions}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Additional Instructions */}
              <div className="space-y-2">
                <Label>{t('admin.marketing.aIImageGenerator.extra_instructies_optioneel')}</Label>
                <Textarea
                  placeholder={t('admin.marketing.aIImageGenerator.aanvullende_instructies_voor_de_ai')}
                  value={enhancePrompt}
                  onChange={(e) => setEnhancePrompt(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <Button
                onClick={handleEnhance}
                disabled={generateImage.isPending || !canEnhance}
                className="w-full bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700"
              >
                {generateImage.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('admin.marketing.aIImageGenerator.transformeren')}
                  </>
                ) : (
                  <>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Transformeer Productfoto ({creditCost} credits)
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Gallery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              {t('admin.marketing.aIImageGenerator.gegenereerde_afbeeldingen')}
            </CardTitle>
            <Badge variant="secondary">{images.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t('admin.marketing.aIImageGenerator.nog_geen_afbeeldingen_gegenereerd')}</p>
              <p className="text-sm">{t('admin.marketing.aIImageGenerator.gebruik_de_generator_hierboven')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-2 gap-3">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square rounded-lg overflow-hidden border bg-muted"
                  >
                    <img
                      src={image.image_url}
                      alt={image.prompt}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Enhancement badge */}
                    {(image as any).enhancement_type === 'enhance' && (
                      <Badge 
                        className="absolute top-2 left-2 text-[10px] bg-orange-500/90"
                      >
                        {t('admin.marketing.aIImageGenerator.bewerkt')}
                      </Badge>
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopy(image.image_url, image.id)}
                        >
                          {copied === image.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDownload(image.image_url, image.id)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteImage.mutate(image.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="text-white text-xs">
                        <p className="line-clamp-2">{image.prompt}</p>
                        <p className="opacity-70 mt-1">
                          {format(new Date(image.created_at), 'PPp', { locale: dateLocale })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Product Select Dialog */}
      <ProductSelectDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        selectedIds={selectedProductIds}
        onSelect={setSelectedProductIds}
        maxSelect={1}
      />
    </div>
  );
}
