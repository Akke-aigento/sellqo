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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  context,
  language = 'nl',
  multiVariant = false,
  className,
  seoKeywords,
}: AIFieldAssistantProps) {
  const { checkFeature } = useUsageLimits();
  const { hasCredits, refetch: refetchCredits } = useAICredits();

  const [isOpen, setIsOpen] = useState(false);
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
    setResult(null);
    setVariations([]);

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
      } else {
        throw new Error('Geen tekst ontvangen');
      }

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

  const handleAccept = (text: string, variationId?: string) => {
    onApply(text);
    toast.success('Tekst toegepast!');
    if (variationId) setSelectedVariationId(variationId);
    setIsOpen(false);
  };

  const handleRegenerate = () => {
    if (activeTab === 'briefing') {
      handleBriefingGenerate();
    } else {
      handleAutoGenerate();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 text-muted-foreground hover:text-primary transition-colors',
            isOpen && 'text-primary bg-primary/10',
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
      <PopoverContent className="w-80 max-h-[70vh] overflow-hidden p-0" align="start" side="bottom">
        {/* Result view */}
        {(result || variations.length > 0) ? (
          <div className="max-h-[65vh] overflow-hidden">
            <ScrollArea className="h-full" style={{ maxHeight: '65vh' }}>
              <div className="p-3 space-y-3 relative">
              {result && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Voorstel:</p>
                  <div className="text-sm border-l-2 border-primary pl-3 py-1">
                    {result}
                  </div>
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
                        onClick={() => handleAccept(v.text, v.id)}
                        className={cn(
                          "w-full text-left p-2 rounded-md border transition-colors",
                          selectedVariationId === v.id
                            ? "border-primary bg-primary/10"
                            : "hover:border-primary hover:bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-primary">{v.style_label}</span>
                          {selectedVariationId === v.id && <Check className="h-3 w-3 text-primary" />}
                        </div>
                        <p className="text-sm mt-0.5">{v.text}</p>
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={handleRegenerate} disabled={isLoading}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Opnieuw genereren
                  </Button>
                </>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            </ScrollArea>
          </div>
        ) : (
          /* Input view with tabs */
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
            <TabsContent value="briefing" className="p-3 mt-0 space-y-2">
              <Textarea
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                placeholder="Beschrijf wat je wilt, bijv. 'focus op duurzaamheid, noem de lithium technologie'"
                rows={3}
                className="text-sm resize-none"
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
        )}
      </PopoverContent>
    </Popover>
  );
}
