import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Zap, AlertTriangle, AlertCircle, Info, ArrowRight, FileText, Image, Type, Code, Rocket, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

const getSeverityConfig = (severity: string) => {
  switch (severity) {
    case 'error': return { border: 'border-l-red-500', bg: 'bg-red-500/5', icon: <AlertCircle className="h-4 w-4 text-red-500" />, label: 'Kritiek' };
    case 'warning': return { border: 'border-l-yellow-500', bg: 'bg-yellow-500/5', icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />, label: 'Waarschuwing' };
    default: return { border: 'border-l-blue-500', bg: 'bg-blue-500/5', icon: <Info className="h-4 w-4 text-blue-500" />, label: 'Info' };
  }
};

export function SEOQuickWins({ issues, suggestions, onAction, isLoading }: SEOQuickWinsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  const allItems = [
    ...suggestions.map((sug) => ({
      ...sug,
      itemType: 'suggestion' as const,
      severity: sug.priority === 'high' ? 'error' : sug.priority === 'medium' ? 'warning' : 'info',
    })),
    ...issues.slice(0, 3).map((issue) => ({ ...issue, itemType: 'issue' as const })),
  ].slice(0, 6);

  if (allItems.length === 0) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-3">
            <Zap className="h-6 w-6 text-green-500" />
          </div>
          <p className="font-medium text-green-700 dark:text-green-400">Alles ziet er goed uit!</p>
          <p className="text-sm text-muted-foreground mt-1">Geen verbeterpunten gevonden</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Wins
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {allItems.length} acties
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {allItems.map((item, index) => {
            const isIssue = item.itemType === 'issue';
            const isSuggestion = item.itemType === 'suggestion';
            const Icon = getIssueIcon(isIssue ? (item as SEOIssue).type : (item as SEOSuggestion).type);
            const config = getSeverityConfig(item.severity);
            const estimatedImpact = isSuggestion ? (item as SEOSuggestion).estimated_impact : undefined;

            return (
              <div
                key={index}
                className={cn(
                  "relative flex flex-col gap-2 p-4 rounded-xl border border-l-4 transition-all hover:shadow-md",
                  config.border,
                  config.bg,
                )}
              >
                {/* Header */}
                <div className="flex items-start gap-2">
                  {config.icon}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">
                      {isIssue ? (item as SEOIssue).message : (item as SEOSuggestion).title}
                    </p>
                    {isSuggestion && (item as SEOSuggestion).description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {(item as SEOSuggestion).description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer: impact + action */}
                <div className="flex items-center justify-between mt-auto pt-1">
                  {estimatedImpact ? (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>+{estimatedImpact} punten</span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {isSuggestion && (item as SEOSuggestion).action && onAction && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1"
                      onClick={() => onAction((item as SEOSuggestion).action!, (item as SEOSuggestion).entity_id)}
                    >
                      <Rocket className="h-3 w-3" />
                      Fix nu
                    </Button>
                  )}
                </div>

                {(item as any).entity_name && (
                  <Badge variant="outline" className="absolute top-2 right-2 text-[10px]">
                    {(item as any).entity_name}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
