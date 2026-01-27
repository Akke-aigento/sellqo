import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAILearning, type CopyVariationForLearning } from '@/hooks/useAILearning';

export interface CopyVariation {
  id: string;
  text: string;
  style: string;
  style_label: string;
  keywords_used: string[];
}

interface AICopyVariationsPopoverProps {
  variations: CopyVariation[];
  onSelect: (variation: CopyVariation) => void;
  onClose: () => void;
  className?: string;
}

export function AICopyVariationsPopover({
  variations,
  onSelect,
  onClose,
  className,
}: AICopyVariationsPopoverProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { trackVariationChoice } = useAILearning();

  const handleSelect = (variation: CopyVariation) => {
    setSelectedId(variation.id);
    
    // Track the choice for learning
    const rejectedVariations = variations.filter(v => v.id !== variation.id);
    trackVariationChoice(variation, rejectedVariations);
    
    // Small delay for visual feedback
    setTimeout(() => {
      onSelect(variation);
    }, 200);
  };

  const styleColors: Record<string, string> = {
    professional: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    playful: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    concise: 'bg-green-500/10 text-green-600 border-green-500/20',
    emotional: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    urgent: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  };

  const labels = ['A', 'B', 'C'];

  return (
    <div className={cn(
      'bg-card border rounded-lg shadow-xl p-4 w-[400px] max-w-[95vw] animate-in fade-in slide-in-from-top-2',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-gradient-to-br from-primary/20 to-purple-500/20">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Kies je favoriet</h3>
            <p className="text-xs text-muted-foreground">3 variaties gegenereerd</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Variations */}
      <div className="space-y-3">
        {variations.map((variation, idx) => (
          <button
            key={variation.id}
            onClick={() => handleSelect(variation)}
            className={cn(
              'w-full text-left p-3 rounded-lg border-2 transition-all duration-200',
              'hover:border-primary/50 hover:bg-accent/50',
              selectedId === variation.id 
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                : 'border-muted'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Label */}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                selectedId === variation.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              )}>
                {selectedId === variation.id ? (
                  <Check className="h-3 w-3" />
                ) : (
                  labels[idx]
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Style badge */}
                <Badge 
                  variant="outline" 
                  className={cn('text-xs mb-1.5', styleColors[variation.style] || 'bg-muted')}
                >
                  {variation.style_label}
                </Badge>

                {/* Text */}
                <p className="text-sm leading-relaxed">
                  {variation.text}
                </p>

                {/* Keywords used */}
                {variation.keywords_used.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {variation.keywords_used.map((kw, i) => (
                      <span 
                        key={i} 
                        className="text-xs text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          2 AI credits (3 variaties)
        </p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}
