import { useState } from 'react';
import { 
  Instagram, Facebook, Linkedin, Twitter, 
  Sparkles, Copy, Check, RefreshCw, ImageIcon,
  Loader2, ChevronDown, Wand2, Package
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAIMarketing } from '@/hooks/useAIMarketing';
import { useAICredits } from '@/hooks/useAICredits';
import { ProductSelectDialog } from './ProductSelectDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'twitter';
type ContentType = 'product_highlight' | 'low_stock_alert' | 'new_arrival' | 'seasonal' | 'custom';
type Tone = 'professional' | 'casual' | 'playful' | 'urgent';

const platforms = [
  { id: 'instagram' as Platform, name: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { id: 'facebook' as Platform, name: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  { id: 'linkedin' as Platform, name: 'LinkedIn', icon: Linkedin, color: 'text-blue-700' },
  { id: 'twitter' as Platform, name: 'X / Twitter', icon: Twitter, color: 'text-foreground' },
];

const contentTypes = [
  { id: 'product_highlight' as ContentType, name: 'Product Highlight', description: 'Zet een product in de spotlight', needsProducts: true },
  { id: 'low_stock_alert' as ContentType, name: 'Laatste Kans', description: 'Urgentie voor bijna uitverkochte items', needsProducts: false },
  { id: 'new_arrival' as ContentType, name: 'Nieuwe Collectie', description: 'Kondig nieuwe producten aan', needsProducts: true },
  { id: 'seasonal' as ContentType, name: 'Seizoensgebonden', description: 'Passend bij het seizoen of feestdag', needsProducts: false },
  { id: 'custom' as ContentType, name: 'Eigen Idee', description: 'Schrijf je eigen prompt', needsProducts: false },
];

const tones = [
  { id: 'casual' as Tone, name: 'Casual', emoji: '😊' },
  { id: 'professional' as Tone, name: 'Professioneel', emoji: '💼' },
  { id: 'playful' as Tone, name: 'Speels', emoji: '🎉' },
  { id: 'urgent' as Tone, name: 'Urgent', emoji: '⚡' },
];

interface SocialPostGeneratorProps {
  initialContentType?: ContentType;
  initialProductIds?: string[];
}

export function SocialPostGenerator({ initialContentType, initialProductIds }: SocialPostGeneratorProps) {
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [contentType, setContentType] = useState<ContentType>(initialContentType || 'product_highlight');
  const [tone, setTone] = useState<Tone>('casual');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [suggestedImages, setSuggestedImages] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialProductIds || []);
  const [productDialogOpen, setProductDialogOpen] = useState(false);

  const { generateSocialPost, context } = useAIMarketing();
  const { hasCredits, getCreditCost } = useAICredits();

  const creditCost = getCreditCost('social_post');
  const canGenerate = hasCredits(creditCost);
  const selectedType = contentTypes.find(ct => ct.id === contentType);
  const needsProducts = selectedType?.needsProducts;

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast.error('Onvoldoende AI credits');
      return;
    }

    const result = await generateSocialPost.mutateAsync({
      platform,
      contentType,
      tone,
      customPrompt: contentType === 'custom' ? customPrompt : undefined,
      productIds: needsProducts && selectedProductIds.length > 0 ? selectedProductIds : undefined,
    });

    setGeneratedContent(result.content);
    setAlternatives(result.alternatives || []);
    setSuggestedImages(result.suggestedImages || []);
  };

  const handleCopy = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      toast.success('Gekopieerd naar klembord!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectAlternative = (alt: string) => {
    setGeneratedContent(alt);
    setShowAlternatives(false);
  };

  const selectedPlatform = platforms.find(p => p.id === platform);
  const PlatformIcon = selectedPlatform?.icon || Instagram;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500">
              <Wand2 className="h-4 w-4 text-white" />
            </div>
            Social Media Generator
          </CardTitle>
          <CardDescription>
            Genereer posts voor Instagram, Facebook, LinkedIn en X
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Platform Selection */}
          <div className="space-y-2">
            <Label>Platform</Label>
            <div className="flex gap-2">
              {platforms.map((p) => (
                <Button
                  key={p.id}
                  variant={platform === p.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlatform(p.id)}
                  className={cn(
                    platform === p.id && 'ring-2 ring-offset-2',
                    platform === p.id && p.id === 'instagram' && 'ring-pink-500',
                    platform === p.id && p.id === 'facebook' && 'ring-blue-600',
                    platform === p.id && p.id === 'linkedin' && 'ring-blue-700',
                  )}
                >
                  <p.icon className={cn('h-4 w-4 mr-1', platform !== p.id && p.color)} />
                  {p.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Content Type */}
          <div className="space-y-2">
            <Label>Type Content</Label>
            <Select value={contentType} onValueChange={(v) => {
              setContentType(v as ContentType);
              // Reset products if new type doesn't need them
              if (!contentTypes.find(ct => ct.id === v)?.needsProducts) {
                setSelectedProductIds([]);
              }
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contentTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    <div>
                      <span className="font-medium">{ct.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {ct.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Selection */}
          {needsProducts && (
            <div className="space-y-2">
              <Label>Producten (optioneel)</Label>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setProductDialogOpen(true)}
              >
                <Package className="h-4 w-4 mr-2" />
                {selectedProductIds.length > 0 
                  ? `${selectedProductIds.length} product${selectedProductIds.length > 1 ? 'en' : ''} geselecteerd`
                  : 'Kies producten om te highlighten'
                }
              </Button>
              {selectedProductIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProductIds([])}
                  className="text-muted-foreground"
                >
                  Selectie wissen
                </Button>
              )}
            </div>
          )}

          {/* Custom Prompt */}
          {contentType === 'custom' && (
            <div className="space-y-2">
              <Label>Je idee</Label>
              <Textarea
                placeholder="Beschrijf wat je wilt promoten..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Tone Selection */}
          <div className="space-y-2">
            <Label>Toon</Label>
            <div className="flex gap-2">
              {tones.map((t) => (
                <Button
                  key={t.id}
                  variant={tone === t.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTone(t.id)}
                >
                  {t.emoji} {t.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generateSocialPost.isPending || !canGenerate}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {generateSocialPost.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Genereren...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Genereer Post ({creditCost} credits)
              </>
            )}
          </Button>

          {/* Generated Content */}
          {generatedContent && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformIcon className={cn('h-5 w-5', selectedPlatform?.color)} />
                  <span className="font-medium">{selectedPlatform?.name} Post</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleGenerate}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="whitespace-pre-wrap text-sm bg-background p-4 rounded-md border">
                {generatedContent}
              </div>

              {/* Suggested Images */}
              {suggestedImages.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <ImageIcon className="h-4 w-4" />
                    Aanbevolen afbeeldingen
                  </Label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {suggestedImages.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`Product ${i + 1}`}
                        className="h-20 w-20 object-cover rounded-md border"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Alternatives */}
              {alternatives.length > 0 && (
                <Collapsible open={showAlternatives} onOpenChange={setShowAlternatives}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <ChevronDown className={cn(
                        'h-4 w-4 mr-2 transition-transform',
                        showAlternatives && 'rotate-180'
                      )} />
                      {alternatives.length} alternatieve versies
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {alternatives.map((alt, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-md border bg-background cursor-pointer hover:border-purple-500 transition-colors"
                        onClick={() => handleSelectAlternative(alt)}
                      >
                        <p className="text-sm">{alt}</p>
                        <Badge variant="secondary" className="mt-2">
                          Klik om te selecteren
                        </Badge>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {/* Context Info */}
          {context && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <p>
                AI kent je data: {context.products.total} producten, {context.customers.subscribers} abonnees,
                {context.seasonality.upcomingHolidays[0] && ` ${context.seasonality.upcomingHolidays[0].name} over ${context.seasonality.upcomingHolidays[0].daysUntil} dagen`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductSelectDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        selectedIds={selectedProductIds}
        onSelect={setSelectedProductIds}
        maxSelect={5}
      />
    </>
  );
}
