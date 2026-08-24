import { Sparkles, X, Check, Pencil, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AISuggestionBoxProps {
  suggestion: string;
  onAccept: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  onRegenerate?: () => void;
  isLoading?: boolean;
  isCached?: boolean;
  className?: string;
}

export function AISuggestionBox({
  suggestion,
  onAccept,
  onEdit,
  onDismiss,
  onRegenerate,
  isLoading,
  isCached,
  className,
}: AISuggestionBoxProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 bg-muted/50 border rounded-md text-sm', className)}>
        <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse shrink-0" />
        <span className="text-muted-foreground">{t('admin.inbox.aISuggestionBox.ai_genereert_suggestie')}</span>
      </div>
    );
  }

  if (!suggestion) return null;

  // Truncated preview (first 80 chars)
  const preview = suggestion.length > 80 ? suggestion.substring(0, 80) + '...' : suggestion;

  return (
    <div className={cn('border border-primary/20 rounded-md bg-primary/5 overflow-hidden', className)}>
      {/* Compact header - always visible */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-primary shrink-0">
          AI suggestie
          {isCached && (
            <span className="ml-1 text-muted-foreground font-normal">{t('admin.inbox.aISuggestionBox.gecached')}</span>
          )}
        </span>
        
        {/* Preview text (collapsed) */}
        {!isExpanded && (
          <span className="text-xs text-muted-foreground truncate flex-1 mx-2">
            "{preview}"
          </span>
        )}
        
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* Quick accept button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onAccept}
          >
            <Check className="h-3 w-3 mr-1" />
            {t('admin.inbox.aISuggestionBox.gebruik')}
          </Button>
          
          {/* Expand/collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
          
          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-primary/10">
          <p className="text-sm text-foreground whitespace-pre-wrap py-2">
            {suggestion}
          </p>
          <div className="flex items-center gap-2 justify-between pt-2">
            {/* Regenerate button */}
            {onRegenerate && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onRegenerate} 
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {t('admin.inbox.aISuggestionBox.hergenereren_1_credit')}
              </Button>
            )}
            
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={onEdit} className="h-7 text-xs">
                <Pencil className="h-3 w-3 mr-1" />
                {t('common.edit')}
              </Button>
              <Button size="sm" onClick={onAccept} className="h-7 text-xs">
                <Check className="h-3 w-3 mr-1" />
                {t('admin.inbox.aISuggestionBox.gebruiken')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
