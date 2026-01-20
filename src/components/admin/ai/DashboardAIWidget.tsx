import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Sparkles, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIActions } from '@/hooks/useAIActions';
import { AIActionCard } from './AIActionCard';
import { AIActionPreviewDialog } from './AIActionPreviewDialog';
import type { AIActionSuggestion } from '@/types/aiActions';

export function DashboardAIWidget() {
  const { pendingSuggestions, suggestionsLoading, suggestionCounts, triggerAnalysis } = useAIActions();
  const [selectedSuggestion, setSelectedSuggestion] = useState<AIActionSuggestion | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handlePreview = (suggestion: AIActionSuggestion) => {
    setSelectedSuggestion(suggestion);
    setPreviewOpen(true);
  };

  if (suggestionsLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const urgentCount = suggestionCounts?.urgent || 0;
  const highCount = suggestionCounts?.high || 0;
  const totalPending = suggestionCounts?.total || 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Assistent
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => triggerAnalysis.mutate()}
              disabled={triggerAnalysis.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${triggerAnalysis.isPending ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalPending === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Geen suggesties op dit moment</p>
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => triggerAnalysis.mutate()}
                disabled={triggerAnalysis.isPending}
              >
                Analyse uitvoeren
              </Button>
            </div>
          ) : (
            <>
              {/* Summary badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {urgentCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {urgentCount} urgent
                  </Badge>
                )}
                {highCount > 0 && (
                  <Badge variant="default" className="gap-1 bg-orange-500">
                    {highCount} hoog
                  </Badge>
                )}
                <Badge variant="secondary">{totalPending} totaal</Badge>
              </div>

              {/* Top 3 suggestions */}
              <div className="space-y-2">
                {pendingSuggestions?.slice(0, 3).map(suggestion => (
                  <AIActionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onPreview={handlePreview}
                    compact
                  />
                ))}
              </div>

              {/* View all link */}
              <Button variant="ghost" className="w-full justify-between" asChild>
                <Link to="/admin/ai-center">
                  Bekijk alle suggesties
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <AIActionPreviewDialog
        suggestion={selectedSuggestion}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}
