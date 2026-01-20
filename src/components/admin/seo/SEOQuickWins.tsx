import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Zap, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  ArrowRight,
  FileText,
  Image,
  Type,
  Code
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

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'error': return 'destructive';
    case 'warning': return 'secondary';
    case 'info': return 'outline';
    default: return 'outline';
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
};

export function SEOQuickWins({ issues, suggestions, onAction, isLoading }: SEOQuickWinsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const allItems = [
    ...issues.map((issue) => ({ ...issue, itemType: 'issue' as const })),
    ...suggestions.map((sug) => ({ ...sug, itemType: 'suggestion' as const, severity: sug.priority === 'high' ? 'error' : sug.priority === 'medium' ? 'warning' : 'info' })),
  ].slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Quick Wins
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Geen verbeterpunten gevonden</p>
            <p className="text-sm">Voer een analyse uit om suggesties te krijgen</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allItems.map((item, index) => {
              const isIssue = item.itemType === 'issue';
              const Icon = getIssueIcon(isIssue ? (item as SEOIssue).type : (item as SEOSuggestion).type);
              
              return (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {getSeverityIcon(item.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">
                        {isIssue ? (item as SEOIssue).message : (item as SEOSuggestion).title}
                      </span>
                    </div>
                    {!isIssue && (item as SEOSuggestion).description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {(item as SEOSuggestion).description}
                      </p>
                    )}
                    {(item as any).entity_name && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {(item as any).entity_name}
                      </Badge>
                    )}
                  </div>
                  {!isIssue && (item as SEOSuggestion).action && onAction && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => onAction((item as SEOSuggestion).action!, (item as SEOSuggestion).entity_id)}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
