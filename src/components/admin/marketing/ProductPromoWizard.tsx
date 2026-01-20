import { useState } from 'react';
import { 
  Rocket, Zap, Smile, Briefcase, PartyPopper,
  ChevronRight, ChevronLeft, Sparkles, Loader2,
  Check, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductSelectDialog } from './ProductSelectDialog';
import { PromoKitResult } from './PromoKitResult';
import { useProducts } from '@/hooks/useProducts';
import { useAICredits } from '@/hooks/useAICredits';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProductPromoWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tone = 'urgent' | 'casual' | 'professional' | 'playful';
type Language = 'nl' | 'en' | 'de' | 'fr';

const toneOptions: { value: Tone; label: string; icon: React.ElementType; description: string; color: string }[] = [
  { value: 'urgent', label: 'Urgent', icon: Zap, description: 'Nu kopen! Beperkte tijd!', color: 'text-red-500 bg-red-500/10 border-red-500/30' },
  { value: 'casual', label: 'Casual', icon: Smile, description: 'Vriendelijk en relaxed', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  { value: 'professional', label: 'Professioneel', icon: Briefcase, description: 'Zakelijk en betrouwbaar', color: 'text-slate-500 bg-slate-500/10 border-slate-500/30' },
  { value: 'playful', label: 'Speels', icon: PartyPopper, description: 'Fun en energiek!', color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
];

const languageOptions: { value: Language; label: string; flag: string }[] = [
  { value: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
];

export interface PromoKit {
  productId: string;
  productName: string;
  tone: Tone;
  language: Language;
  images: {
    original: string | null;
    enhanced: string | null;
    generated: string | null;
  };
  social: {
    instagram: { caption: string; hashtags: string[] };
    facebook: { post: string };
    linkedin: { post: string };
    twitter: { tweet: string };
  };
  email: {
    subjectLines: string[];
    previewText: string;
    bodySnippet: string;
  };
  slogans: string[];
  suggestedTiming: {
    bestDay: string;
    bestTime: string;
    reason: string;
  };
  creditsUsed: number;
  generatedAt: string;
}

export function ProductPromoWizard({ open, onOpenChange }: ProductPromoWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [productSelectOpen, setProductSelectOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>('casual');
  const [language, setLanguage] = useState<Language>('nl');
  const [includeDiscount, setIncludeDiscount] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState(20);
  const [generateImages, setGenerateImages] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promoKit, setPromoKit] = useState<PromoKit | null>(null);

  const { products } = useProducts();
  const { credits, hasCredits, refetch: refetchCredits } = useAICredits();
  const { currentTenant } = useTenant();

  const selectedProduct = products?.find(p => p.id === selectedProductId);
  const estimatedCredits = 5 + (generateImages ? 10 : 0);

  const handleProductSelect = (ids: string[]) => {
    setSelectedProductId(ids[0] || null);
    setProductSelectOpen(false);
  };

  const handleGenerate = async () => {
    if (!selectedProduct || !currentTenant?.id) return;

    if (!hasCredits(estimatedCredits)) {
      toast.error('Onvoldoende AI credits', {
        description: `Je hebt ${estimatedCredits} credits nodig, maar je hebt er ${credits?.available || 0}.`
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-product-promo-kit', {
        body: {
          tenantId: currentTenant.id,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          productDescription: selectedProduct.description,
          productPrice: selectedProduct.price,
          productImageUrl: selectedProduct.images?.[0],
          tone,
          includeDiscount,
          discountPercentage: includeDiscount ? discountPercentage : undefined,
          language,
          generateImages,
        }
      });

      if (error) {
        console.error('Function error:', error);
        if (error.message?.includes('402') || error.message?.includes('credits')) {
          toast.error('Onvoldoende AI credits');
        } else if (error.message?.includes('429')) {
          toast.error('Te veel verzoeken. Probeer het later opnieuw.');
        } else {
          toast.error('Er ging iets mis bij het genereren');
        }
        return;
      }

      setPromoKit(data);
      setStep(3);
      refetchCredits();
      toast.success('Marketing kit gegenereerd!');

    } catch (err) {
      console.error('Generate error:', err);
      toast.error('Er ging iets mis');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep(1);
      setSelectedProductId(null);
      setPromoKit(null);
      setTone('casual');
      setLanguage('nl');
      setIncludeDiscount(false);
      setGenerateImages(true);
    }, 300);
  };

  const handleNewKit = () => {
    setStep(1);
    setSelectedProductId(null);
    setPromoKit(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              Product Promotie Wizard
            </DialogTitle>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step === s 
                    ? "bg-primary text-primary-foreground" 
                    : step > s
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                )}>
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && (
                  <div className={cn(
                    "w-16 h-0.5 mx-2",
                    step > s ? "bg-green-500" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Product Selection */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">Kies een product</h3>
                <p className="text-sm text-muted-foreground">
                  Selecteer het product dat je wilt promoten
                </p>
              </div>

              {selectedProduct ? (
                <Card className="border-primary">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {selectedProduct.images?.[0] ? (
                        <img 
                          src={selectedProduct.images[0]} 
                          alt={selectedProduct.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium">{selectedProduct.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          €{selectedProduct.price?.toFixed(2)}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setProductSelectOpen(true)}
                      >
                        Wijzig
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-32 border-dashed"
                  onClick={() => setProductSelectOpen(true)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <span>Selecteer product</span>
                  </div>
                </Button>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!selectedProduct}
                >
                  Volgende
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium">Configureer je campagne</h3>
                <p className="text-sm text-muted-foreground">
                  Kies de toon en opties voor je marketing content
                </p>
              </div>

              {/* Tone Selection */}
              <div className="space-y-3">
                <Label>Toon</Label>
                <div className="grid grid-cols-2 gap-3">
                  {toneOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setTone(option.value)}
                        className={cn(
                          "p-4 rounded-lg border-2 text-left transition-all",
                          tone === option.value
                            ? option.color + " border-current"
                            : "border-border hover:border-muted-foreground/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5" />
                          <div>
                            <p className="font-medium">{option.label}</p>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-3">
                <Label>Taal</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          {lang.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Discount Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Korting toevoegen</Label>
                  <p className="text-xs text-muted-foreground">
                    Benadruk een kortingsactie in de content
                  </p>
                </div>
                <Switch checked={includeDiscount} onCheckedChange={setIncludeDiscount} />
              </div>

              {includeDiscount && (
                <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                  <Label>Kortingspercentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      max={90}
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  {selectedProduct && (
                    <Badge variant="secondary">
                      €{(selectedProduct.price * (1 - discountPercentage / 100)).toFixed(2)}
                    </Badge>
                  )}
                </div>
              )}

              {/* Image Generation Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    Afbeeldingen genereren
                    <Badge variant="outline" className="text-xs">+10 credits</Badge>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Maak enhanced en nieuwe marketing afbeeldingen
                  </p>
                </div>
                <Switch checked={generateImages} onCheckedChange={setGenerateImages} />
              </div>

              {/* Credit Summary */}
              <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Geschatte kosten</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold">{estimatedCredits} credits</span>
                      <p className="text-xs text-muted-foreground">
                        Beschikbaar: {credits?.available || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Terug
                </Button>
                <Button 
                  onClick={handleGenerate}
                  disabled={isGenerating || !hasCredits(estimatedCredits)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Genereren...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Genereer Marketing Kit
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 3 && promoKit && (
            <PromoKitResult 
              kit={promoKit} 
              onNewKit={handleNewKit}
              onClose={handleClose}
            />
          )}
        </DialogContent>
      </Dialog>

      <ProductSelectDialog
        open={productSelectOpen}
        onOpenChange={setProductSelectOpen}
        selectedIds={selectedProductId ? [selectedProductId] : []}
        onSelect={handleProductSelect}
        maxSelect={1}
      />
    </>
  );
}
