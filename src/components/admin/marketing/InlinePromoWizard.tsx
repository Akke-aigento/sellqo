import { useState } from 'react';
import { 
  Rocket, Zap, Smile, Briefcase, PartyPopper,
  Sparkles, Loader2, Package, ChevronDown, Check, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PromoKitResult, type PromoKit } from './PromoKitResult';
import { useProducts } from '@/hooks/useProducts';
import { useAICredits } from '@/hooks/useAICredits';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tone = 'urgent' | 'casual' | 'professional' | 'playful';
type Language = 'nl' | 'en' | 'de' | 'fr';

const toneOptions: { value: Tone; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'urgent', label: 'Urgent', icon: Zap, color: 'text-red-500 bg-red-500/10 border-red-500/50 hover:bg-red-500/20' },
  { value: 'casual', label: 'Casual', icon: Smile, color: 'text-blue-500 bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20' },
  { value: 'professional', label: 'Professioneel', icon: Briefcase, color: 'text-slate-600 bg-slate-500/10 border-slate-500/50 hover:bg-slate-500/20' },
  { value: 'playful', label: 'Speels', icon: PartyPopper, color: 'text-purple-500 bg-purple-500/10 border-purple-500/50 hover:bg-purple-500/20' },
];

const languageOptions: { value: Language; flag: string }[] = [
  { value: 'nl', flag: '🇳🇱' },
  { value: 'en', flag: '🇬🇧' },
  { value: 'de', flag: '🇩🇪' },
  { value: 'fr', flag: '🇫🇷' },
];

interface InlinePromoWizardProps {
  onNeedCredits?: () => void;
}

export function InlinePromoWizard({ onNeedCredits }: InlinePromoWizardProps) {
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>('casual');
  const [language, setLanguage] = useState<Language>('nl');
  const [includeDiscount, setIncludeDiscount] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState(20);
  const [generateImages, setGenerateImages] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promoKit, setPromoKit] = useState<PromoKit | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { products } = useProducts();
  const { credits, hasCredits, refetch: refetchCredits } = useAICredits();
  const { currentTenant } = useTenant();

  const selectedProduct = products?.find(p => p.id === selectedProductId);
  const estimatedCredits = 5 + (generateImages ? 10 : 0);
  const canGenerate = selectedProduct && hasCredits(estimatedCredits);

  const handleGenerate = async () => {
    if (!selectedProduct || !currentTenant?.id) return;

    if (!hasCredits(estimatedCredits)) {
      toast.error('Onvoldoende AI credits', {
        description: `Je hebt ${estimatedCredits} credits nodig.`,
        action: onNeedCredits ? { label: 'Credits kopen', onClick: onNeedCredits } : undefined,
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
        if (error.message?.includes('402') || error.message?.includes('credits')) {
          toast.error('Onvoldoende AI credits');
          onNeedCredits?.();
        } else if (error.message?.includes('429')) {
          toast.error('Te veel verzoeken. Probeer het later opnieuw.');
        } else {
          toast.error('Er ging iets mis bij het genereren');
        }
        return;
      }

      setPromoKit(data);
      refetchCredits();
      toast.success('Marketing kit gegenereerd!');

    } catch (err) {
      console.error('Generate error:', err);
      toast.error('Er ging iets mis');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNewKit = () => {
    setPromoKit(null);
    setSelectedProductId(null);
  };

  // Show results if we have a kit
  if (promoKit) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-purple-500/5">
        <CardContent className="p-6">
          <PromoKitResult 
            kit={promoKit} 
            onNewKit={handleNewKit}
            onClose={handleNewKit}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-purple-500/5 hover:border-primary/50 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
            <Rocket className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Product Promoten</h2>
            <p className="text-sm text-muted-foreground">
              Selecteer een product, kies de toon, en AI genereert een complete marketing kit
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Row 1: Product + Tone */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Product Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Product</Label>
              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productOpen}
                    className="w-full justify-between h-12"
                  >
                    {selectedProduct ? (
                      <div className="flex items-center gap-3">
                        {selectedProduct.images?.[0] ? (
                          <img 
                            src={selectedProduct.images[0]} 
                            alt=""
                            className="w-8 h-8 object-cover rounded"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="truncate">{selectedProduct.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Selecteer product...</span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Zoek product..." />
                    <CommandList>
                      <CommandEmpty>Geen producten gevonden.</CommandEmpty>
                      <CommandGroup>
                        {products?.slice(0, 20).map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.name}
                            onSelect={() => {
                              setSelectedProductId(product.id);
                              setProductOpen(false);
                            }}
                          >
                            <div className="flex items-center gap-3 w-full">
                              {product.images?.[0] ? (
                                <img 
                                  src={product.images[0]} 
                                  alt=""
                                  className="w-10 h-10 object-cover rounded"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{product.name}</p>
                                <p className="text-sm text-muted-foreground">€{product.price?.toFixed(2)}</p>
                              </div>
                              {selectedProductId === product.id && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Tone Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Toon</Label>
              <div className="grid grid-cols-4 gap-2">
                {toneOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setTone(option.value)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                        tone === option.value
                          ? option.color + " border-current"
                          : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-xs font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Language + Options (collapsible) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium">Taal:</Label>
              <div className="flex gap-1">
                {languageOptions.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => setLanguage(lang.value)}
                    className={cn(
                      "w-9 h-9 rounded-lg text-lg transition-all flex items-center justify-center",
                      language === lang.value
                        ? "bg-primary/10 ring-2 ring-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    {lang.flag}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-muted-foreground"
            >
              {showAdvanced ? 'Minder opties' : 'Meer opties'}
              <ChevronDown className={cn("h-4 w-4 ml-1 transition-transform", showAdvanced && "rotate-180")} />
            </Button>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="grid gap-4 md:grid-cols-2 p-4 rounded-lg bg-muted/30 border">
              {/* Discount Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Korting toevoegen</Label>
                  <p className="text-xs text-muted-foreground">Benadruk een kortingsactie</p>
                </div>
                <div className="flex items-center gap-2">
                  {includeDiscount && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={5}
                        max={90}
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                        className="w-16 h-8 text-sm"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  )}
                  <Switch checked={includeDiscount} onCheckedChange={setIncludeDiscount} />
                </div>
              </div>

              {/* Image Generation Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Afbeeldingen genereren
                    <Badge variant="outline" className="text-xs">+10 cr</Badge>
                  </Label>
                  <p className="text-xs text-muted-foreground">Enhanced en nieuwe visuals</p>
                </div>
                <Switch checked={generateImages} onCheckedChange={setGenerateImages} />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>{estimatedCredits} credits</span>
              <span className="text-xs">({credits?.available || 0} beschikbaar)</span>
            </div>

            <Button 
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
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
      </CardContent>
    </Card>
  );
}
