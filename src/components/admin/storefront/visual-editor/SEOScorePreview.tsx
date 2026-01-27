import { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import type { SEOScoreResult } from '@/utils/calculateQuickSEOScore';

interface SEOScorePreviewProps {
  result: SEOScoreResult;
  onClose?: () => void;
  className?: string;
}

export function SEOScorePreview({ result, onClose, className }: SEOScorePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-orange-500';
    return 'text-red-500';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getStatusIcon = (score: number) => {
    if (score >= 80) return <Check className="h-3 w-3 text-green-600" />;
    if (score >= 60) return <AlertCircle className="h-3 w-3 text-orange-500" />;
    return <X className="h-3 w-3 text-red-500" />;
  };

  const { breakdown, suggestions, score } = result;

  return (
    <div className={cn(
      'bg-card/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg animate-in fade-in slide-in-from-top-2',
      className
    )}>
      {/* Header with overall score */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">SEO Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-lg font-bold', getScoreColor(score))}>
            {score}/100
          </span>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-3">
        <div 
          className={cn('h-full transition-all duration-500', getProgressColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
        <div className="flex items-center gap-1">
          {getStatusIcon(breakdown.keywords.score)}
          <span className="text-muted-foreground">Keywords</span>
          <span className={getScoreColor(breakdown.keywords.score)}>
            {breakdown.keywords.found.length}/{breakdown.keywords.found.length + breakdown.keywords.missing.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {getStatusIcon(breakdown.length.score)}
          <span className="text-muted-foreground">Lengte</span>
          <span className={getScoreColor(breakdown.length.score)}>
            {breakdown.length.status === 'optimal' ? '✓' : 
             breakdown.length.status === 'too_short' ? 'Kort' : 'Lang'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {getStatusIcon(breakdown.readability.score)}
          <span className="text-muted-foreground">Leesbaar</span>
          <span className={getScoreColor(breakdown.readability.score)}>
            {breakdown.readability.status === 'excellent' ? '✓' :
             breakdown.readability.status === 'good' ? 'Goed' :
             breakdown.readability.status === 'fair' ? 'Matig' : 'Moeilijk'}
          </span>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && score < 80 && (
        <div className="border-t pt-2 mt-2">
          <p className="text-xs text-muted-foreground mb-1">Tips:</p>
          <ul className="text-xs space-y-0.5">
            {suggestions.slice(0, 2).map((suggestion, idx) => (
              <li key={idx} className="text-foreground">
                • {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expandable details */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full h-6 text-xs mt-2">
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Minder details
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Meer details
              </>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 text-xs">
          {/* Keywords detail */}
          <div className="bg-muted/50 rounded p-2">
            <p className="font-medium mb-1">Keywords ({breakdown.keywords.score}%)</p>
            {breakdown.keywords.found.length > 0 && (
              <p className="text-green-600">
                ✓ Gevonden: {breakdown.keywords.found.join(', ')}
              </p>
            )}
            {breakdown.keywords.missing.length > 0 && (
              <p className="text-muted-foreground">
                Ontbreekt: {breakdown.keywords.missing.join(', ')}
              </p>
            )}
            {breakdown.keywords.found.length === 0 && breakdown.keywords.missing.length === 0 && (
              <p className="text-muted-foreground">Geen primaire keywords gedefinieerd</p>
            )}
          </div>

          {/* Length detail */}
          <div className="bg-muted/50 rounded p-2">
            <p className="font-medium mb-1">Lengte ({breakdown.length.score}%)</p>
            <p>
              {breakdown.length.current} tekens (optimaal: {breakdown.length.optimal.min}-{breakdown.length.optimal.max})
            </p>
          </div>

          {/* Readability detail */}
          <div className="bg-muted/50 rounded p-2">
            <p className="font-medium mb-1">Leesbaarheid ({breakdown.readability.score}%)</p>
            <p>
              {breakdown.readability.wordCount} woorden, gem. {breakdown.readability.avgWordLength} letters/woord
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
