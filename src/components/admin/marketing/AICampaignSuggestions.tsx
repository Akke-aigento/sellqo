import { useState, useEffect } from 'react';
import { 
  Lightbulb, Loader2, RefreshCw, ChevronRight,
  Mail, Users, Package, AlertTriangle, Gift, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAIMarketing } from '@/hooks/useAIMarketing';
import { useAICredits } from '@/hooks/useAICredits';
import { cn } from '@/lib/utils';
import type { CampaignSuggestion } from '@/types/aiMarketing';

const typeIcons: Record<string, any> = {
  newsletter: Mail,
  promotion: Gift,
  win_back: Users,
  new_product: Package,
  low_stock: AlertTriangle,
  seasonal: TrendingUp,
};

const urgencyColors: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
};

export function AICampaignSuggestions() {
  const [suggestions, setSuggestions] = useState<CampaignSuggestion[]>([]);
  const { getCampaignSuggestions, context } = useAIMarketing();
  const { hasCredits, getCreditCost } = useAICredits();

  const creditCost = getCreditCost('campaign_suggestion');
  const canGenerate = hasCredits(creditCost);

  const handleGetSuggestions = async () => {
    const result = await getCampaignSuggestions.mutateAsync();
    setSuggestions(result || []);
  };

  // Auto-load on first mount if we have context
  useEffect(() => {
    if (context && suggestions.length === 0 && canGenerate) {
      // Don't auto-load to save credits
    }
  }, [context]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
              <Lightbulb className="h-4 w-4 text-white" />
            </div>
            AI Campagne Suggesties
          </CardTitle>
          <CardDescription>
            Slimme campagne-ideeën gebaseerd op je data
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGetSuggestions}
          disabled={getCampaignSuggestions.isPending || !canGenerate}
        >
          {getCampaignSuggestions.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">
              Laat AI analyseren welke campagnes het meest impactvol zijn
            </p>
            <Button
              onClick={handleGetSuggestions}
              disabled={getCampaignSuggestions.isPending || !canGenerate}
              className="bg-gradient-to-r from-amber-500 to-orange-500"
            >
              {getCampaignSuggestions.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyseren...
                </>
              ) : (
                <>
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Genereer Suggesties ({creditCost} credit)
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => {
              const Icon = typeIcons[suggestion.type] || Lightbulb;
              return (
                <div
                  key={index}
                  className="p-4 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{suggestion.title}</h4>
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          urgencyColors[suggestion.urgency]
                        )} />
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.urgency === 'high' ? 'Urgent' : 
                           suggestion.urgency === 'medium' ? 'Aanbevolen' : 'Optioneel'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {suggestion.estimatedReach?.toLocaleString() || '?'} bereik
                        </span>
                        {suggestion.targetAudience && (
                          <span>{suggestion.targetAudience}</span>
                        )}
                        {suggestion.suggestedTiming && (
                          <span>📅 {suggestion.suggestedTiming}</span>
                        )}
                      </div>
                      
                      {/* Confidence Score */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">AI Zekerheid:</span>
                        <Progress value={suggestion.confidenceScore} className="h-1.5 flex-1 max-w-[100px]" />
                        <span className="text-xs font-medium">{suggestion.confidenceScore}%</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
