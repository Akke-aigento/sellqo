import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, TrendingUp, TrendingDown, Pause, Ban, Play, Check, X, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  campaignId: string;
  tenantId: string;
}

interface Suggestion {
  id?: string;
  action_type: string;
  entity_id?: string;
  entity_name: string;
  current_value?: string;
  recommended_value?: string;
  reason: string;
  confidence: number;
  priority: string;
  status?: string;
}

const actionIcons: Record<string, React.ElementType> = {
  increase_bid: TrendingUp,
  decrease_bid: TrendingDown,
  pause_keyword: Pause,
  add_negative: Ban,
  resume_keyword: Play,
};

const actionLabels: Record<string, string> = {
  increase_bid: 'Bod verhogen',
  decrease_bid: 'Bod verlagen',
  pause_keyword: 'Keyword pauzeren',
  add_negative: 'Negatief keyword',
  resume_keyword: 'Keyword hervatten',
};

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-orange-500/10 text-orange-700 border-orange-200',
  low: 'bg-muted text-muted-foreground border-border',
};

export function CampaignAIAnalysis({ campaignId, tenantId }: Props) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [noDataMessage, setNoDataMessage] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyze = async () => {
    setIsAnalyzing(true);
    setNoDataMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('ads-campaign-analyze', {
        body: { campaign_id: campaignId, tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.message) {
        // No data available
        setNoDataMessage(data.message);
        setSuggestions([]);
        toast.info(data.message);
      } else {
        const items = (data?.suggestions || []).map((s: any, i: number) => ({
          ...s,
          id: `inline-${i}`,
          status: 'pending',
        }));
        setSuggestions(items);
        toast.success(`${items.length} suggestie${items.length !== 1 ? 's' : ''} gegenereerd`);
      }
      setHasAnalyzed(true);
    } catch (err: any) {
      toast.error(err.message || 'Analyse mislukt');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyMutation = useMutation({
    mutationFn: async (rec: Suggestion) => {
      const actionMap: Record<string, { action: string; payload: any }> = {
        increase_bid: { action: 'update_keyword_bid', payload: { keyword_id: rec.entity_id, bid: parseFloat(rec.recommended_value?.replace('€', '') || '0') } },
        decrease_bid: { action: 'update_keyword_bid', payload: { keyword_id: rec.entity_id, bid: parseFloat(rec.recommended_value?.replace('€', '') || '0') } },
        pause_keyword: { action: 'toggle_keyword', payload: { keyword_id: rec.entity_id, status: 'paused' } },
        resume_keyword: { action: 'toggle_keyword', payload: { keyword_id: rec.entity_id, status: 'active' } },
      };

      const mapped = actionMap[rec.action_type];
      if (mapped && rec.entity_id) {
        await supabase.functions.invoke('ads-bolcom-manage', {
          body: { tenant_id: tenantId, action: mapped.action, ...mapped.payload },
        });
      }

      return rec.id;
    },
    onSuccess: (id) => {
      toast.success('Suggestie toegepast');
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'accepted' } : s));
    },
    onError: () => toast.error('Kon suggestie niet toepassen'),
  });

  const handleReject = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected' } : s));
    toast.success('Suggestie genegeerd');
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const processedSuggestions = suggestions.filter(s => s.status !== 'pending');

  return (
    <Card className="border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Campagne Optimizer</CardTitle>
          </div>
          <Button onClick={analyze} disabled={isAnalyzing} size="sm">
            {isAnalyzing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyseren...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Analyseer campagne</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isAnalyzing && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isAnalyzing && noDataMessage && (
          <div className="flex items-center gap-3 py-6 px-4 rounded-lg bg-muted/50 border border-border">
            <Info className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">{noDataMessage}</p>
          </div>
        )}

        {!isAnalyzing && !noDataMessage && !hasAnalyzed && (
          <p className="text-center text-muted-foreground py-6">
            Klik op "Analyseer campagne" om AI-suggesties te genereren op basis van je performance data.
          </p>
        )}

        {!isAnalyzing && !noDataMessage && hasAnalyzed && pendingSuggestions.length === 0 && processedSuggestions.length === 0 && (
          <p className="text-center text-muted-foreground py-6">
            De AI heeft geen suggesties op basis van de huidige data.
          </p>
        )}

        {!isAnalyzing && pendingSuggestions.length > 0 && (
          <div className="space-y-3">
            {pendingSuggestions.map((rec) => {
              const Icon = actionIcons[rec.action_type] || Sparkles;

              return (
                <div key={rec.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {actionLabels[rec.action_type] || rec.action_type}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${priorityColors[rec.priority] || priorityColors.medium}`}>
                        {rec.priority}
                      </Badge>
                      {rec.confidence != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {Math.round(rec.confidence * 100)}% zeker
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-0.5">{rec.entity_name}</p>
                    <p className="text-sm text-muted-foreground">{rec.reason}</p>
                    {(rec.current_value || rec.recommended_value) && (
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        {rec.current_value && <span className="text-muted-foreground line-through">{rec.current_value}</span>}
                        {rec.current_value && rec.recommended_value && <span>→</span>}
                        {rec.recommended_value && <span className="font-medium text-primary">{rec.recommended_value}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => applyMutation.mutate(rec)}
                      disabled={applyMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleReject(rec.id!)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isAnalyzing && processedSuggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Verwerkt</p>
            {processedSuggestions.map((rec) => {
              const Icon = actionIcons[rec.action_type] || Sparkles;
              return (
                <div key={rec.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 opacity-60">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{rec.entity_name} — {actionLabels[rec.action_type]}</span>
                  <Badge variant="outline" className={rec.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted'}>
                    {rec.status === 'accepted' ? 'Toegepast' : 'Genegeerd'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
