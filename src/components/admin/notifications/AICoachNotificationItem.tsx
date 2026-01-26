import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { 
  Bot, 
  Clock, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { QuickActionButton } from './QuickActionButton';
import { useAICoach } from '@/hooks/useAICoach';
import type { AIActionSuggestion } from '@/types/aiActions';
import { cn } from '@/lib/utils';

interface AICoachNotificationItemProps {
  suggestion: AIActionSuggestion;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

export function AICoachNotificationItem({
  suggestion,
  onDismiss,
  compact = false,
}: AICoachNotificationItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { snoozeSuggestion, muteSuggestionType } = useAICoach();

  const priorityColors = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    urgent: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const handleSnooze = async (hours: number) => {
    await snoozeSuggestion.mutateAsync({ suggestionId: suggestion.id, hours });
    onDismiss?.(suggestion.id);
  };

  const handleMute = async () => {
    await muteSuggestionType.mutateAsync(suggestion.suggestion_type);
    onDismiss?.(suggestion.id);
  };

  // Parse quick actions from the suggestion
  const quickActions = suggestion.quick_actions || [];

  return (
    <div
      className={cn(
        'p-3 border-b last:border-0 transition-colors',
        'bg-gradient-to-r from-purple-500/5 to-blue-500/5',
        'hover:from-purple-500/10 hover:to-blue-500/10'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Coach Avatar */}
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0">
          <Bot className="h-4 w-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className={cn('text-xs', priorityColors[suggestion.priority])}
            >
              {suggestion.priority === 'urgent' ? '🔥 Urgent' : 
               suggestion.priority === 'high' ? '⚠️ Hoog' : 
               suggestion.priority === 'medium' ? '📊 Gemiddeld' : '💡 Tip'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(suggestion.created_at), { 
                addSuffix: true, 
                locale: nl 
              })}
            </span>
          </div>

          {/* Conversational Message */}
          <div className="mt-2">
            <p className="text-sm leading-relaxed">
              {suggestion.conversational_message || suggestion.description}
            </p>
          </div>

          {/* Quick Actions */}
          {quickActions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {quickActions.slice(0, compact ? 2 : 4).map((action, idx) => (
                <QuickActionButton
                  key={action.id || idx}
                  action={action}
                  suggestionId={suggestion.id}
                  onComplete={() => onDismiss?.(suggestion.id)}
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => handleSnooze(24)}
              >
                <Clock className="h-3 w-3 mr-1" />
                Later
              </Button>
            </div>
          )}

          {/* Expandable Details */}
          {!compact && suggestion.reasoning && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-muted-foreground mt-2 p-0"
                >
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
              <CollapsibleContent className="mt-2">
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  <p className="font-medium mb-1">Waarom deze suggestie:</p>
                  <p>{suggestion.reasoning}</p>
                  {suggestion.confidence_score && (
                    <p className="mt-1">
                      Zekerheid: {Math.round(suggestion.confidence_score * 100)}%
                    </p>
                  )}
                </div>

                {/* Feedback buttons */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Was dit nuttig?</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs ml-auto"
                    onClick={handleMute}
                  >
                    Dit type niet meer tonen
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 text-muted-foreground"
          onClick={() => onDismiss?.(suggestion.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
