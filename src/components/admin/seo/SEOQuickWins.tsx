import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Zap, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  FileText,
  Image,
  Type,
  Code,
  Wand2,
  ExternalLink,
} from 'lucide-react';
import type { SEOIssue, SEOSuggestion } from '@/types/seo';

interface SEOQuickWinsProps {
  issues: SEOIssue[];
  suggestions: SEOSuggestion[];
  onAction?: (action: string, entityId?: string) => void;
  isLoading?: boolean;
}

const getIssueIcon = (type: string) => {
  if (type.includes('meta')) return Type;
  if (type.includes('image') || type.includes('alt')) return Image;
  if (type.includes('structured') || type.includes('schema')) return Code;
  if (type.includes('content') || type.includes('description')) return FileText;
  return AlertCircle;
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
};

function getActionForIssue(issue: SEOIssue): { label: string; action: string } | null {
  const t = issue.type.toLowerCase();
  if (t.includes('meta_title')) return { label: 'Genereer meta title', action: 'generate_meta_title' };
  if (t.includes('meta_description')) return { label: 'Genereer meta description', action: 'generate_meta_description' };
  if (t.includes('content') || t.includes('description_short') || t.includes('description_missing')) return { label: 'Genereer beschrijving', action: 'generate_description' };
  if (t.includes('image') || t.includes('alt')) return { label: 'Bekijk product', action: 'view_product' };
  return null;
}

function getActionForSuggestion(sug: SEOSuggestion): { label: string; action: string } | null {
  if (sug.action) {
    const labels: Record<string, string> = {
      'generate_meta': 'Genereer meta tags',
      'improve_content': 'Verbeter content',
      'optimize_categories': 'Optimaliseer categorieën',
      'generate_faq': 'Genereer FAQ',
      'generate_meta_title': 'Genereer meta title',
      'generate_meta_description': 'Genereer meta description',
    };
    return { label: labels[sug.action] || 'Uitvoeren', action: sug.action };
  }
  return null;
}

export function SEOQuickWins({ issues, suggestions, onAction, isLoading }: SEOQuickWinsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const allItems = [
    ...issues.map((issue) => ({ ...issue, itemType: 'issue' as const })),
    ...suggestions.map((sug) => ({ ...sug, itemType: 'suggestion' as const, severity: sug.priority === 'high' ? 'error' : sug.priority === 'medium' ? 'warning' : 'info' as const })),
  ].slice(0, 8);

  if (allItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Geen verbeterpunten gevonden</p>
        <p className="text-sm">Voer een analyse uit om suggesties te krijgen</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allItems.map((item, index) => {
        const isIssue = item.itemType === 'issue';
        const Icon = getIssueIcon(isIssue ? (item as SEOIssue).type : (item as SEOSuggestion).type);
        const actionInfo = isIssue 
          ? getActionForIssue(item as SEOIssue)
          : getActionForSuggestion(item as SEOSuggestion);
        const isUrgent = item.severity === 'error';
        const entityId = isIssue ? (item as SEOIssue).entity_id : (item as SEOSuggestion).entity_id;

        return (
          <div
            key={index}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              isUrgent ? 'bg-destructive/5 border-destructive/20' : 'bg-card hover:bg-accent/50'
            }`}
          >
            <div className="shrink-0">
              {getSeverityIcon(item.severity)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm truncate">
                  {isIssue ? (item as SEOIssue).message : (item as SEOSuggestion).title}
                </span>
              </div>
              {!isIssue && (item as SEOSuggestion).description && (
                <p className="text-xs text-muted-foreground line-clamp-1 ml-6">
                  {(item as SEOSuggestion).description}
                </p>
              )}
              {(item as any).entity_name && (
                <Badge variant="outline" className="mt-1 text-xs ml-6">
                  {(item as any).entity_name}
                </Badge>
              )}
            </div>
            {actionInfo && onAction && (
              <Button
                size="sm"
                variant={isUrgent ? 'destructive' : 'secondary'}
                className="shrink-0 gap-1.5 text-xs"
                onClick={() => onAction(actionInfo.action, entityId)}
              >
                <Wand2 className="h-3.5 w-3.5" />
                {actionInfo.label}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
