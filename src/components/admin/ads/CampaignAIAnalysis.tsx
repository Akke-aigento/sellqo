import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, TrendingUp, TrendingDown, Pause, Ban, Play, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  campaignId: string;
  tenantId: string;
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
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch existing pending recommendations for this campaign
  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ['campaign-ai-recs', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_ai_recommendations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('channel', 'bolcom')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const analyze = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ads-campaign-analyze', {
        body: { campaign_id: campaignId, tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.count || 0} suggesties gegenereerd`);
      queryClient.invalidateQueries({ queryKey: ['campaign-ai-recs', campaignId] });
    } catch (err: any) {
      toast.error(err.message || 'Analyse mislukt');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyMutation = useMutation({
    mutationFn: async (rec: any) => {
      // Apply via ads-bolcom-manage
      const actionMap: Record<string, { action: string; payload: any }> = {
        increase_bid: { action: 'update_keyword_bid', payload: { keyword_id: rec.entity_id, bid: parseFloat(rec.recommended_value?.value?.replace('€', '') || '0') } },
        decrease_bid: { action: 'update_keyword_bid', payload: { keyword_id: rec.entity_id, bid: parseFloat(rec.recommended_value?.value?.replace('€', '') || '0') } },
        pause_keyword: { action: 'toggle_keyword', payload: { keyword_id: rec.entity_id, status: 'paused' } },
        resume_keyword: { action: 'toggle_keyword', payload: { keyword_id: rec.entity_id, status: 'active' } },
      };

      const mapped = actionMap[rec.recommendation_type];
      if (mapped && rec.entity_id) {
        await supabase.functions.invoke('ads-bolcom-manage', {
          body: { tenant_id: tenantId, action: mapped.action, ...mapped.payload },
        });
      }

      // Mark as accepted
      await supabase
        .from('ads_ai_recommendations')
        .update({ status: 'accepted', applied_at: new Date().toISOString() })
        .eq('id', rec.id);
    },
    onSuccess: () => {
      toast.success('Suggestie toegepast');
      queryClient.invalidateQueries({ queryKey: ['campaign-ai-recs', campaignId] });
    },
    onError: () => toast.error('Kon suggestie niet toepassen'),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('ads_ai_recommendations')
        .update({ status: 'rejected' })
        .eq('id', id);
    },
    onSuccess: () => {
      toast.success('Suggestie genegeerd');
      queryClient.invalidateQueries({ queryKey: ['campaign-ai-recs', campaignId] });
    },
  });

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

        {!isAnalyzing && recommendations.length === 0 && (
          <p className="text-center text-muted-foreground py-6">
            Klik op "Analyseer campagne" om AI-suggesties te genereren op basis van je performance data.
          </p>
        )}

        {!isAnalyzing && recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.map((rec) => {
              const Icon = actionIcons[rec.recommendation_type] || Sparkles;
              const currentVal = (rec.current_value as any)?.value;
              const recommendedVal = (rec.recommended_value as any)?.value;

              return (
                <div key={rec.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {actionLabels[rec.recommendation_type] || rec.recommendation_type}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${priorityColors[(rec as any).priority || 'medium'] || priorityColors.medium}`}>
                        {(rec as any).priority || 'medium'}
                      </Badge>
                      {rec.confidence != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {Math.round(rec.confidence * 100)}% zeker
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.reason}</p>
                    {(currentVal || recommendedVal) && (
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        {currentVal && <span className="text-muted-foreground line-through">{currentVal}</span>}
                        {currentVal && recommendedVal && <span>→</span>}
                        {recommendedVal && <span className="font-medium text-primary">{recommendedVal}</span>}
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
                      onClick={() => rejectMutation.mutate(rec.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
