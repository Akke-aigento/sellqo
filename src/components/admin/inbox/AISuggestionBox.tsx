import { Sparkles, X, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AISuggestionBoxProps {
  suggestion: string;
  onAccept: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
  className?: string;
}

export function AISuggestionBox({
  suggestion,
  onAccept,
  onEdit,
  onDismiss,
  isLoading,
  className,
}: AISuggestionBoxProps) {
  if (isLoading) {
    return (
      <div className={cn('bg-muted/50 border rounded-lg p-3', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span>AI genereert suggestie...</span>
        </div>
      </div>
    );
  }

  if (!suggestion) return null;

  return (
    <div className={cn('bg-primary/5 border border-primary/20 rounded-lg p-3', className)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          AI Suggestie
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      <p className="text-sm text-foreground whitespace-pre-wrap mb-3">
        {suggestion}
      </p>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-3 w-3 mr-1" />
          Bewerken
        </Button>
        <Button size="sm" onClick={onAccept}>
          <Check className="h-3 w-3 mr-1" />
          Gebruiken
        </Button>
      </div>
    </div>
  );
}
