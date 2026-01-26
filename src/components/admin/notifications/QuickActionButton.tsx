import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAICoach } from '@/hooks/useAICoach';
import type { NotificationQuickAction } from '@/types/notification';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionButtonProps {
  action: NotificationQuickAction;
  suggestionId?: string;
  onComplete?: () => void;
  size?: 'sm' | 'default';
}

export function QuickActionButton({ 
  action, 
  suggestionId,
  onComplete,
  size = 'sm',
}: QuickActionButtonProps) {
  const navigate = useNavigate();
  const { executeQuickAction, snoozeSuggestion } = useAICoach();
  const [isExecuting, setIsExecuting] = useState(false);

  // Get icon component
  const IconComponent = action.icon 
    ? (Icons as any)[action.icon] || null 
    : null;

  const handleClick = async () => {
    setIsExecuting(true);

    try {
      switch (action.action_type) {
        case 'navigate':
          if (action.action_url) {
            navigate(action.action_url);
          }
          break;

        case 'execute':
          if (action.action_function) {
            await executeQuickAction.mutateAsync({
              functionName: action.action_function,
              params: action.action_params || {},
            });
          }
          break;

        case 'snooze':
          if (suggestionId) {
            const hours = (action.action_params?.hours as number) || 24;
            await snoozeSuggestion.mutateAsync({ suggestionId, hours });
          }
          break;

        case 'dismiss':
          // Just close/dismiss
          break;
      }

      onComplete?.();
    } catch (error) {
      console.error('Quick action failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const getVariant = () => {
    switch (action.variant) {
      case 'primary': return 'default';
      case 'secondary': return 'secondary';
      case 'destructive': return 'destructive';
      case 'outline': return 'outline';
      default: return 'ghost';
    }
  };

  return (
    <Button
      variant={getVariant()}
      size={size}
      onClick={handleClick}
      disabled={isExecuting}
      className={cn(
        'gap-1.5',
        size === 'sm' && 'h-7 text-xs px-2'
      )}
    >
      {isExecuting ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : IconComponent ? (
        <IconComponent className="h-3 w-3" />
      ) : null}
      {action.label}
    </Button>
  );
}
