import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, ArrowDown, ArrowUp, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type FieldType = 'title' | 'subtitle' | 'cta' | 'button' | 'description';
type SectionType = 'hero' | 'newsletter' | 'text_image' | 'featured_products' | 'testimonials';
type ActionType = 'generate' | 'rewrite' | 'shorter' | 'longer';

interface AICopyButtonProps {
  fieldType: FieldType;
  sectionType: SectionType;
  currentValue: string;
  onGenerate: (newValue: string) => void;
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

  const handleAction = async (action: ActionType) => {
    if (action !== 'generate' && !currentValue.trim()) {
      toast.error('Voer eerst tekst in om te bewerken');
      return;
    }

    setIsLoading(true);
    setLoadingAction(action);

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

      if (data?.text) {
        onGenerate(data.text);
        toast.success('Tekst gegenereerd!');
        setIsOpen(false);
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

  const availableActions = actions.filter(
    (a) => !a.requiresValue || currentValue.trim().length > 0
  );

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
      <PopoverContent className="w-48 p-1" align="start" side="bottom">
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
                loadingAction === action && 'bg-accent'
              )}
            >
              {loadingAction === action ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {label}
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
  );
}
