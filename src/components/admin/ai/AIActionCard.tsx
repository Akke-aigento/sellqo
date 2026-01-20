import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  Package, 
  Megaphone, 
  AlertTriangle, 
  UserCheck, 
  Truck, 
  TrendingUp,
  Percent,
  Brain,
  Eye,
  Check,
  X,
  Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { AIActionSuggestion } from '@/types/aiActions';
import { cn } from '@/lib/utils';

const ICONS = {
  purchase_order: Package,
  marketing_campaign: Megaphone,
  price_change: TrendingUp,
  stock_alert: AlertTriangle,
  customer_winback: UserCheck,
  supplier_order: Truck,
  promotion: Percent,
};

const PRIORITY_STYLES = {
  urgent: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    icon: 'text-red-500',
    border: 'border-l-red-500',
  },
  high: {
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: 'text-orange-500',
    border: 'border-l-orange-500',
  },
  medium: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: 'text-blue-500',
    border: 'border-l-blue-500',
  },
  low: {
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: 'text-gray-500',
    border: 'border-l-gray-500',
  },
};

interface AIActionCardProps {
  suggestion: AIActionSuggestion;
  onPreview: (suggestion: AIActionSuggestion) => void;
  onQuickExecute?: (suggestion: AIActionSuggestion) => void;
  onReject?: (suggestion: AIActionSuggestion) => void;
  compact?: boolean;
}

export function AIActionCard({
  suggestion,
  onPreview,
  onQuickExecute,
  onReject,
  compact = false,
}: AIActionCardProps) {
  const Icon = ICONS[suggestion.suggestion_type] || Brain;
  const styles = PRIORITY_STYLES[suggestion.priority];
  const confidencePercent = Math.round((suggestion.confidence_score || 0) * 100);

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer',
          'border-l-4',
          styles.border
        )}
        onClick={() => onPreview(suggestion)}
      >
        <div className={cn('p-2 rounded-lg bg-muted', styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{suggestion.title}</p>
          <p className="text-xs text-muted-foreground">
            Vertrouwen: {confidencePercent}%
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={(e) => {
          e.stopPropagation();
          onPreview(suggestion);
        }}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Card className={cn('border-l-4', styles.border)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg bg-muted shrink-0', styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium truncate">{suggestion.title}</h4>
              <Badge variant="outline" className={cn('shrink-0', styles.badge)}>
                {suggestion.priority === 'urgent' ? 'Urgent' :
                 suggestion.priority === 'high' ? 'Hoog' :
                 suggestion.priority === 'medium' ? 'Gemiddeld' : 'Laag'}
              </Badge>
            </div>
            
            {suggestion.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {suggestion.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                <span>Vertrouwen: {confidencePercent}%</span>
              </div>
              {suggestion.expires_at && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Vervalt {formatDistanceToNow(new Date(suggestion.expires_at), { addSuffix: true, locale: nl })}</span>
                </div>
              )}
            </div>

            <Progress value={confidencePercent} className="h-1" />

            <div className="flex items-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => onPreview(suggestion)}>
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              {onQuickExecute && (
                <Button size="sm" onClick={() => onQuickExecute(suggestion)}>
                  <Check className="h-4 w-4 mr-1" />
                  Uitvoeren
                </Button>
              )}
              {onReject && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-muted-foreground"
                  onClick={() => onReject(suggestion)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
