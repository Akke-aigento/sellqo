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
import { nl } from 'date-fns/locale';

type ImageStyle = 'product_photo' | 'lifestyle' | 'flat_lay' | 'minimalist' | 'vibrant' | 'custom';
type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';
type EnhancementType = 'generate' | 'enhance' | 'background_remove' | 'overlay';
type PlatformPreset = 'instagram_post' | 'instagram_story' | 'facebook_banner' | 'email_header' | 'linkedin_post' | 'custom';
type SettingPreset = 'lifestyle' | 'summer' | 'winter' | 'spring' | 'kitchen' | 'living_room' | 'office' | 'outdoor' | 'studio' | 'gradient' | 'geometric' | 'custom';

const styles: { id: ImageStyle; name: string; description: string }[] = [
  { id: 'product_photo', name: 'Product Foto', description: 'Professionele productfoto' },
  { id: 'lifestyle', name: 'Lifestyle', description: 'Product in context' },
  { id: 'flat_lay', name: 'Flat Lay', description: 'Bovenaanzicht styling' },
  { id: 'minimalist', name: 'Minimalistisch', description: 'Clean en strak' },
  { id: 'vibrant', name: 'Levendig', description: 'Kleurrijk en opvallend' },
  { id: 'custom', name: 'Eigen stijl', description: 'Beschrijf zelf' },
];

const sizes: { id: ImageSize; name: string; ratio: string }[] = [
  { id: '1024x1024', name: 'Vierkant', ratio: '1:1' },
  { id: '1792x1024', name: 'Liggend', ratio: '16:9' },
  { id: '1024x1792', name: 'Staand', ratio: '9:16' },
];

const settingPresets: { id: SettingPreset; name: string; description: string }[] = [
  { id: 'lifestyle', name: 'Lifestyle', description: 'Product in gebruik door persoon' },
  { id: 'summer', name: 'Zomer/Strand', description: 'Zonnig strandtafereel' },
  { id: 'winter', name: 'Winter/Kerst', description: 'Gezellige wintersfeer' },
  { id: 'spring', name: 'Lente', description: 'Fris en bloeiend' },
  { id: 'kitchen', name: 'Keuken', description: 'Moderne keukenomgeving' },
  { id: 'living_room', name: 'Woonkamer', description: 'Stijlvolle woonkamer' },
  { id: 'office', name: 'Kantoor', description: 'Professionele werkplek' },
  { id: 'outdoor', name: 'Buiten', description: 'Natuurlijke buitenomgeving' },
  { id: 'studio', name: 'Studio', description: 'Witte achtergrond, professioneel' },
  { id: 'gradient', name: 'Gradient', description: 'Vloeiende kleurovergang' },
  { id: 'geometric', name: 'Geometrisch', description: 'Abstracte vormen' },
  { id: 'custom', name: 'Eigen setting', description: 'Beschrijf je eigen setting' },
];

const platformPresets: { id: PlatformPreset; name: string; dimensions: string }[] = [
  { id: 'instagram_post', name: 'Instagram Post', dimensions: '1080×1080' },
  { id: 'instagram_story', name: 'Instagram Story', dimensions: '1080×1920' },
  { id: 'facebook_banner', name: 'Facebook Banner', dimensions: '1200×628' },
  { id: 'email_header', name: 'Email Header', dimensions: '600×200' },
  { id: 'linkedin_post', name: 'LinkedIn Post', dimensions: '1200×627' },
  { id: 'custom', name: 'Aangepast', dimensions: 'Kies zelf' },
];

export function AIImageGenerator() {
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
      prompt: enhancePrompt || `Marketingafbeelding voor ${selectedProduct?.name}`,
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
            AI Afbeelding Generator
          </CardTitle>
          <CardDescription>
            Genereer of bewerk afbeeldingen voor je marketing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'generate' | 'enhance')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="generate" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Genereer Nieuw
              </TabsTrigger>
              <TabsTrigger value="enhance" className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Bewerk Productfoto
              </TabsTrigger>
            </TabsList>

            {/* Generate New Tab */}
            <TabsContent value="generate" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Beschrijving</Label>
                <Textarea
                  placeholder="Beschrijf de afbeelding die je wilt genereren..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Wees specifiek over kleuren, stijl en compositie
                </p>
              </div>

              <div className="space-y-2">
                <Label>Stijl</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as ImageStyle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex flex-col">
                          <span>{s.name}</span>
                          <span className="text-xs text-muted-foreground">{s.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Formaat</Label>
                <div className="flex gap-2">
                  {sizes.map((s) => (
                    <Button
                      key={s.id}
                      variant={size === s.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSize(s.id)}
                      className="flex-1"
                    >
                      <span className="font-medium">{s.name}</span>
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
                    Genereren...
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
                <Label>Selecteer Product</Label>
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
                      Kies een product...
                    </div>
                  )}
                </Button>
                {selectedProduct && !productImageUrl && (
                  <p className="text-xs text-destructive">
                    Dit product heeft geen afbeelding
                  </p>
                )}
              </div>

              {/* Setting Preset */}
              <div className="space-y-2">
                <Label>Setting / Omgeving</Label>
                <Select value={settingPreset} onValueChange={(v) => setSettingPreset(v as SettingPreset)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {settingPresets.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex flex-col">
                          <span>{s.name}</span>
                          <span className="text-xs text-muted-foreground">{s.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {settingPreset === 'custom' && (
                  <Input
                    placeholder="Beschrijf je eigen setting..."
                    value={customSetting}
                    onChange={(e) => setCustomSetting(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              {/* Marketing Text */}
              <div className="space-y-2">
                <Label>Marketing Tekst (optioneel)</Label>
                <Input
                  placeholder="bv. '30% KORTING' of 'Nieuw!'"
                  value={marketingText}
                  onChange={(e) => setMarketingText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Tekst die op de afbeelding wordt geplaatst
                </p>
              </div>

              {/* Platform Preset */}
              <div className="space-y-2">
                <Label>Doelformaat</Label>
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
                        <span className="font-medium text-xs">{p.name}</span>
                        <span className="text-[10px] opacity-70">{p.dimensions}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Additional Instructions */}
              <div className="space-y-2">
                <Label>Extra instructies (optioneel)</Label>
                <Textarea
                  placeholder="Aanvullende instructies voor de AI..."
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
                    Transformeren...
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
              Gegenereerde Afbeeldingen
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
              <p>Nog geen afbeeldingen gegenereerd</p>
              <p className="text-sm">Gebruik de generator hierboven</p>
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
                        Bewerkt
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
                          {format(new Date(image.created_at), 'PPp', { locale: nl })}
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
