import { useState, useCallback } from 'react';
import { Sparkles, Loader2, RefreshCw, ArrowDown, ArrowUp, Wand2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSEOKeywords } from '@/hooks/useSEOKeywords';
import { calculateQuickSEOScore, type SEOScoreResult } from '@/utils/calculateQuickSEOScore';
import { SEOScorePreview } from './SEOScorePreview';
import { AICopyVariationsPopover, type CopyVariation } from './AICopyVariationsPopover';

type FieldType = 'title' | 'subtitle' | 'cta' | 'button' | 'description';
type SectionType = 'hero' | 'newsletter' | 'text_image' | 'featured_products' | 'testimonials';
type ActionType = 'generate' | 'rewrite' | 'shorter' | 'longer' | 'generate_variations';

interface AICopyButtonProps {
  fieldType: FieldType;
  sectionType: SectionType;
  currentValue: string;
  onGenerate: (newValue: string, wasAIGenerated: boolean) => void;
  className?: string;
}

interface AIAction {
  action: ActionType;
  label: string;
  icon: typeof Sparkles;
  requiresValue: boolean;
}

const actions: AIAction[] = [
  { action: 'generate', label: 'Genereer nieuw', icon: Wand2, requiresValue: false },
  { action: 'generate_variations', label: 'Genereer 3 variaties', icon: Layers, requiresValue: false },
  { action: 'rewrite', label: 'Herschrijf', icon: RefreshCw, requiresValue: true },
  { action: 'shorter', label: 'Maak korter', icon: ArrowDown, requiresValue: true },
  { action: 'longer', label: 'Maak langer', icon: ArrowUp, requiresValue: true },
];

export function AICopyButton({
  fieldType,
  sectionType,
  currentValue,
  onGenerate,
  className,
}: AICopyButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<ActionType | null>(null);
  const [seoScore, setSeoScore] = useState<SEOScoreResult | null>(null);
  const [showVariations, setShowVariations] = useState(false);
  const [variations, setVariations] = useState<CopyVariation[]>([]);
  const [pendingText, setPendingText] = useState<string | null>(null);

  const { primaryKeywords } = useSEOKeywords();

  const handleAction = async (action: ActionType) => {
    if (action !== 'generate' && action !== 'generate_variations' && !currentValue.trim()) {
      toast.error('Voer eerst tekst in om te bewerken');
      return;
    }

    setIsLoading(true);
    setLoadingAction(action);
    setSeoScore(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-storefront-copy', {
        body: {
          fieldType,
          sectionType,
          currentValue: currentValue.trim(),
          action,
        },
      });

      if (error) throw error;

      // Handle variations response
      if (action === 'generate_variations' && data?.variations) {
        setVariations(data.variations);
        setShowVariations(true);
        setIsOpen(false);
      } 
      // Handle single text response
      else if (data?.text) {
        const generatedText = data.text;
        setPendingText(generatedText);
        
        // Calculate SEO score for the generated text
        if (primaryKeywords.length > 0) {
          const score = calculateQuickSEOScore(generatedText, primaryKeywords, fieldType);
          setSeoScore(score);
        } else {
          // No keywords, just apply the text
          onGenerate(generatedText, true);
          toast.success('Tekst gegenereerd!');
          setIsOpen(false);
        }
      } else {
        throw new Error('Geen tekst ontvangen');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
          toast.error('Rate limit bereikt. Probeer het later opnieuw.');
        } else if (error.message.includes('402') || error.message.includes('credits')) {
          toast.error('Geen AI credits meer. Koop meer credits in de instellingen.');
        } else {
          toast.error('Kon geen tekst genereren. Probeer het opnieuw.');
        }
      } else {
        toast.error('Kon geen tekst genereren. Probeer het opnieuw.');
      }
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleAcceptText = useCallback(() => {
    if (pendingText) {
      onGenerate(pendingText, true);
      toast.success('Tekst toegepast!');
      setPendingText(null);
      setSeoScore(null);
      setIsOpen(false);
    }
  }, [pendingText, onGenerate]);

  const handleRejectText = useCallback(() => {
    setPendingText(null);
    setSeoScore(null);
  }, []);

  const handleVariationSelect = useCallback((variation: CopyVariation) => {
    onGenerate(variation.text, true);
    toast.success('Tekst toegepast!');
    setShowVariations(false);
    setVariations([]);
  }, [onGenerate]);

  const handleVariationsClose = useCallback(() => {
    setShowVariations(false);
    setVariations([]);
  }, []);

  const availableActions = actions.filter(
    (a) => !a.requiresValue || currentValue.trim().length > 0
  );

  return (
    <>
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
        <PopoverContent className="w-56 p-1" align="start" side="bottom">
          <div className="flex flex-col gap-0.5">
            {availableActions.map(({ action, label, icon: Icon }) => (
              <button
                key={action}
                onClick={() => handleAction(action)}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  loadingAction === action && 'bg-accent',
                  action === 'generate_variations' && 'border-t mt-1 pt-2'
                )}
              >
                {loadingAction === action ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {label}
                {action === 'generate_variations' && (
                  <span className="ml-auto text-xs text-muted-foreground">2 credits</span>
                )}
              </button>
            ))}
          </div>
          <div className="border-t mt-1 pt-1 px-2 pb-1">
            <p className="text-xs text-muted-foreground">
              1 AI credit per generatie
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* SEO Score Preview with pending text */}
      {seoScore && pendingText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="max-w-md w-full mx-4">
            {/* Preview text */}
            <div className="bg-card border rounded-lg p-4 mb-3 shadow-lg">
              <p className="text-sm font-medium mb-2">Gegenereerde tekst:</p>
              <p className="text-sm border-l-2 border-primary pl-3 py-1">
                {pendingText}
              </p>
            </div>

            {/* SEO Score */}
            <SEOScorePreview result={seoScore} />

            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleRejectText}
              >
                Opnieuw genereren
              </Button>
              <Button 
                className="flex-1"
                onClick={handleAcceptText}
              >
                Accepteren
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Variations Popover */}
      {showVariations && variations.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <AICopyVariationsPopover
            variations={variations}
            onSelect={handleVariationSelect}
            onClose={handleVariationsClose}
          />
        </div>
      )}
    </>
  );
}
