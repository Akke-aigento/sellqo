import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, Check, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useAICredits } from '@/hooks/useAICredits';

export type AIFieldType =
  | 'product_title'
  | 'short_description'
  | 'description'
  | 'meta_title'
  | 'meta_description'
  | 'specification_value'
  | 'bullet_point'
  | 'category_description'
  | 'page_content'
  | 'newsletter'
  | 'campaign';

export interface AIFieldContext {
  name?: string;
  short_description?: string;
  description?: string;
  category_name?: string;
  price?: number;
  weight?: string | number | null;
  tags?: string[];
  specifications?: Record<string, string>;
  images?: string[];
  marketplace_channels?: string[];
}

interface AIFieldAssistantProps {
  fieldType: AIFieldType;
  currentValue: string;
  onApply: (text: string) => void;
  onSeoGenerated?: (seo: { meta_title: string; meta_description: string }) => void;
  context: AIFieldContext;
  language?: string;
  multiVariant?: boolean;
  className?: string;
  seoKeywords?: string[];
}

interface Variation {
  id: string;
  text: string;
  style: string;
  style_label: string;
}

export function AIFieldAssistant({
  fieldType,
  currentValue,
  onApply,
  onSeoGenerated,
  context,
  language = 'nl',
  multiVariant = false,
  className,
  seoKeywords,
}: AIFieldAssistantProps) {
  const { checkFeature } = useUsageLimits();
  const { hasCredits, refetch: refetchCredits } = useAICredits();

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [briefing, setBriefing] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [activeTab, setActiveTab] = useState<string>('auto');
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);

  const hasAIFeature = checkFeature('ai_copywriting');

  // Feature gate - all hooks are above this
  if (!hasAIFeature) return null;

  const creditsNeeded = multiVariant ? 2 : 1;

  const generate = async (action: 'auto_generate' | 'briefing_generate' | 'generate_variations') => {
    if (!hasCredits(creditsNeeded)) {
      toast.error('Niet genoeg AI credits. Koop meer credits in je instellingen.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-product-field-assistant', {
        body: {
          fieldType,
          currentValue: currentValue?.trim() || '',
          action,
          briefing: action === 'briefing_generate' ? briefing : undefined,
          language,
          productContext: context,
          seoKeywords: seoKeywords?.length ? seoKeywords : undefined,
        },
      });

      if (error) throw error;

      if (data?.variations && Array.isArray(data.variations)) {
        setVariations(data.variations);
      } else if (data?.text) {
        setResult(data.text);
        // Auto-apply SEO if returned alongside description
        if (data?.seo && onSeoGenerated) {
          onSeoGenerated(data.seo);
        }
      } else {
        throw new Error('Geen tekst ontvangen');
      }

      // Close popover, open dialog with results
      setIsPopoverOpen(false);
      setIsDialogOpen(true);

      refetchCredits();
    } catch (error) {
      console.error('AI field assistant error:', error);
      if (error instanceof Error) {
        if (error.message.includes('429')) {
          toast.error('Rate limit bereikt. Probeer het later opnieuw.');
        } else if (error.message.includes('402')) {
          toast.error('Geen AI credits meer beschikbaar.');
        } else {
          toast.error('Kon geen tekst genereren. Probeer het opnieuw.');
        }
      } else {
        toast.error('Kon geen tekst genereren.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoGenerate = () => {
    generate(multiVariant ? 'generate_variations' : 'auto_generate');
  };

  const handleBriefingGenerate = () => {
    if (!briefing.trim()) {
      toast.error('Voer eerst een briefing in.');
      return;
    }
    generate('briefing_generate');
  };

  const handleAccept = (text: string, variationId?: string, seo?: { meta_title: string; meta_description: string }) => {
    onApply(text);
    if (seo && onSeoGenerated) {
      onSeoGenerated(seo);
    }
    toast.success(seo ? 'Tekst + SEO toegepast!' : 'Tekst toegepast!');
    if (variationId) setSelectedVariationId(variationId);
    setIsDialogOpen(false);
  };

  const handleRegenerate = () => {
    if (activeTab === 'briefing') {
      handleBriefingGenerate();
    } else {
      handleAutoGenerate();
    }
  };

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 text-muted-foreground hover:text-primary transition-colors',
              (isPopoverOpen || isDialogOpen) && 'text-primary bg-primary/10',
              className
            )}
            title="AI tekst genereren"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start" side="bottom">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b px-3 pt-3">
              <TabsList className="w-full h-8">
                <TabsTrigger value="auto" className="flex-1 text-xs">Automatisch</TabsTrigger>
                <TabsTrigger value="briefing" className="flex-1 text-xs">Eigen briefing</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="auto" className="p-3 mt-0 space-y-2">
              <p className="text-xs text-muted-foreground">
                AI genereert een voorstel op basis van de productinformatie die je al hebt ingevuld.
              </p>
              {(result || variations.length > 0) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => { setIsPopoverOpen(false); setIsDialogOpen(true); }}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Bekijk vorig voorstel
                </Button>
              )}
              <Button
                size="sm"
                className="w-full"
                onClick={handleAutoGenerate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                Genereer{multiVariant ? ' 3 varianten' : ''}
              </Button>
            </TabsContent>
            <TabsContent value="briefing" className="p-3 mt-0 space-y-2 max-h-[50vh] overflow-y-auto">
              <Textarea
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                placeholder="Beschrijf wat je wilt, bijv. 'focus op duurzaamheid, noem de lithium technologie'"
                rows={4}
                className="text-sm resize-y max-h-32"
              />
              <Button
                size="sm"
                className="w-full"
                onClick={handleBriefingGenerate}
                disabled={isLoading || !briefing.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Send className="h-3 w-3 mr-1" />
                )}
                Genereer met briefing
              </Button>
            </TabsContent>
            <div className="border-t px-3 py-1.5">
              <p className="text-xs text-muted-foreground">
                {creditsNeeded} AI credit{creditsNeeded > 1 ? 's' : ''} per generatie
              </p>
            </div>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* Results Dialog - scrollable modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Voorstel
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            {result && (
              <>
                <p className="text-xs font-medium text-muted-foreground">Voorstel:</p>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert border-l-2 border-primary pl-3 py-1"
                  dangerouslySetInnerHTML={{ __html: result }}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={handleRegenerate} disabled={isLoading}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Opnieuw
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => handleAccept(result)}>
                    <Check className="h-3 w-3 mr-1" />
                    Accepteer
                  </Button>
                </div>
              </>
            )}
            {variations.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground">Kies een variant:</p>
                <div className="space-y-2">
                  {variations.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleAccept(v.text, v.id, (v as any).seo)}
                      className={cn(
                        "w-full text-left p-3 rounded-md border transition-colors",
                        selectedVariationId === v.id
                          ? "border-primary bg-primary/10"
                          : "hover:border-primary hover:bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-primary">{v.style_label}</span>
                        {selectedVariationId === v.id && <Check className="h-3 w-3 text-primary" />}
                      </div>
                      <div className="prose prose-sm max-w-none dark:prose-invert mt-1" dangerouslySetInnerHTML={{ __html: v.text }} />
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={handleRegenerate} disabled={isLoading}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Opnieuw genereren
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
