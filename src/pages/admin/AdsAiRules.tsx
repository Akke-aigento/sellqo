import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Sparkles, ArrowRight, Check, X, Plus, Pencil, Trash2, Bot, User, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdsAI } from '@/hooks/useAdsAI';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTranslation } from 'react-i18next';

const CHANNEL_COLORS: Record<string, string> = {
  bolcom: 'bg-blue-100 text-blue-800',
  amazon: 'bg-orange-100 text-orange-800',
  google: 'bg-green-100 text-green-800',
  meta: 'bg-indigo-100 text-indigo-800',
};

const CHANNEL_LABELS: Record<string, string> = {
  bolcom: 'Bol.com',
  amazon: 'Amazon',
  google: 'Google',
  meta: 'Meta',
};

const TYPE_LABELS: Record<string, string> = {
  add_negative_keyword: 'Negatief Keyword',
  increase_bid: 'Bod Verhogen',
  decrease_bid: 'Bod Verlagen',
  pause_campaign: 'Campagne Pauzeren',
  pause_keyword: 'Keyword Pauzeren',
  resume_campaign: 'Campagne Hervatten',
  budget_increase: 'Budget Verhogen',
  new_keyword: 'Nieuw Keyword',
};

const RULE_TYPE_LABELS: Record<string, string> = {
  auto_negative: 'Auto Negatief',
};
// Disabled until ads-ai-engine implements them:
// bid_adjustment, budget_pacing, inventory_pause

// Helper buiten een component: de locale komt als argument binnen, want een
// hook mag hier niet staan.
function fmt(d: string | null, locale: Locale) {
  if (!d) return '—';
  try { return format(new Date(d), 'd MMM yyyy HH:mm', { locale }); } catch { return '—'; }
}

export default function AdsAiRulesPage() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const {
    recommendations, rules, history,
    loadingRecs, loadingRules, loadingHistory,
    channel, setChannel, type, setType, status, setStatus,
    applyRecommendation, rejectRecommendation,
    toggleRule, createRule, deleteRule,
  } = useAdsAI();

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '', channel: 'bolcom', rule_type: 'auto_negative',
    is_active: true,
    // condition fields
    min_clicks: 20, max_conversions: 0, min_spend: 5, lookback_days: 30,
    target_acos: 25, min_data_points: 10, max_bid_change: 15,
    min_stock_level: 5,
    budget_threshold: 90, budget_action: 'warn',
  });

  const buildConditionsActions = () => {
    const t = newRule.rule_type;
    let conditions: Record<string, unknown> = {};
    let actions: Record<string, unknown> = {};

    if (t === 'auto_negative') {
      conditions = { min_clicks: newRule.min_clicks, max_conversions: newRule.max_conversions, min_spend: newRule.min_spend, lookback_days: newRule.lookback_days };
      actions = { action: 'add_negative_keyword', match_type: 'exact' };
    } else if (t === 'bid_adjustment') {
      conditions = { target_acos: newRule.target_acos, min_data_points: newRule.min_data_points, max_bid_change_pct: newRule.max_bid_change };
      actions = { action: 'adjust_bid' };
    } else if (t === 'inventory_pause') {
      conditions = { min_stock_level: newRule.min_stock_level };
      actions = { action: 'pause_ads' };
    } else if (t === 'budget_pacing') {
      conditions = { budget_threshold_pct: newRule.budget_threshold };
      actions = { action: newRule.budget_action };
    }
    return { conditions, actions };
  };

  const handleCreateRule = () => {
    const { conditions, actions } = buildConditionsActions();
    createRule.mutate({
      name: newRule.name,
      channel: newRule.channel,
      rule_type: newRule.rule_type,
      conditions,
      actions,
      is_active: newRule.is_active,
    }, {
      onSuccess: () => {
        setRuleDialogOpen(false);
        setNewRule({ name: '', channel: 'bolcom', rule_type: 'auto_negative', is_active: true, min_clicks: 20, max_conversions: 0, min_spend: 5, lookback_days: 30, target_acos: 25, min_data_points: 10, max_bid_change: 15, min_stock_level: 5, budget_threshold: 90, budget_action: 'warn' });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span>{t('admin.adsBolcom.ads')}</span><span>/</span><span>AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.ads.ai_aanbevelingen')}</h1>
        </div>
      </div>

      <Tabs defaultValue="recommendations">
        <TabsList>
          <TabsTrigger value="recommendations">{t('admin.adsAiRules.aanbevelingen')}</TabsTrigger>
          <TabsTrigger value="rules">{t('admin.adsAiRules.automation_regels')}</TabsTrigger>
          <TabsTrigger value="history">{t('admin.adsAiRules.geschiedenis')}</TabsTrigger>
        </TabsList>

        {/* TAB 1: Aanbevelingen */}
        <TabsContent value="recommendations" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={channel || 'all'} onValueChange={(v) => setChannel(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder={t('admin.odooChannels.columnChannel')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.adsAiRules.alle_kanalen')}</SelectItem>
                <SelectItem value="bolcom">Bol.com</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="meta">Meta</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type || 'all'} onValueChange={(v) => setType(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('admin.marketing.contentHistoryList.type')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.marketing.aIContentLibrary.alle_types')}</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="pending">{t('admin.adsAiRules.pending')}</SelectItem>
                <SelectItem value="accepted">{t('admin.adsAiRules.geaccepteerd')}</SelectItem>
                <SelectItem value="rejected">{t('admin.adsAiRules.afgewezen')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recommendations list */}
          {loadingRecs ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
            </div>
          ) : recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Check className="h-10 w-10 mx-auto mb-3 text-green-500" />
                <p className="font-medium">{t('admin.adsAiRules.geen_aanbevelingen_op_dit_moment')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('admin.adsAiRules.ai_analyseert_je_campagne_data_continu')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec) => {
                const cur = rec.current_value as Record<string, unknown> | null;
                const rec_val = rec.recommended_value as Record<string, unknown> | null;
                return (
                  <Card key={rec.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={CHANNEL_COLORS[rec.channel] || 'bg-muted text-foreground'}>
                              {CHANNEL_LABELS[rec.channel] || rec.channel}
                            </Badge>
                            <Badge variant="outline">{TYPE_LABELS[rec.recommendation_type] || rec.recommendation_type}</Badge>
                            {rec.auto_apply && <Badge variant="secondary">Auto-apply</Badge>}
                          </div>
                          <p className="text-sm">{rec.reason}</p>

                          {/* Current → Recommended */}
                          {(cur || rec_val) && (
                            <div className="flex items-center gap-2 text-sm">
                              {cur && (
                                <span className="px-2 py-0.5 bg-muted rounded text-muted-foreground">
                                  {Object.entries(cur).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                </span>
                              )}
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              {rec_val && (
                                <span className="px-2 py-0.5 bg-primary/10 rounded text-primary font-medium">
                                  {Object.entries(rec_val).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Confidence */}
                          {rec.confidence != null && (
                            <div className="flex items-center gap-2 max-w-xs">
                              <span className="text-xs text-muted-foreground">{t('admin.adsAiRules.confidence')}</span>
                              <Progress value={rec.confidence * 100} className="h-2 flex-1" />
                              <span className="text-xs font-medium">{Math.round(rec.confidence * 100)}%</span>
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground">{fmt(rec.created_at, dateLocale)}</p>
                        </div>

                        {rec.status === 'pending' && (
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="default" onClick={() => applyRecommendation.mutate(rec.id)}
                              disabled={applyRecommendation.isPending}>
                              <Check className="h-4 w-4 mr-1" /> Toepassen
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => rejectRecommendation.mutate(rec.id)}
                              disabled={rejectRecommendation.isPending}>
                              <X className="h-4 w-4 mr-1" /> Negeren
                            </Button>
                          </div>
                        )}
                        {rec.status !== 'pending' && (
                          <Badge variant={rec.status === 'accepted' ? 'default' : 'secondary'}>
                            {rec.status === 'accepted' ? 'Toegepast' : rec.status === 'rejected' ? 'Genegeerd' : rec.status}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Automation Regels */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setRuleDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nieuwe regel
            </Button>
          </div>

          {loadingRules ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">{t('admin.adsAiRules.nog_geen_automation_regels')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('admin.adsAiRules.maak_regels_aan_om_ai_automatisch')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <Card key={rule.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Switch
                          checked={rule.is_active ?? false}
                          onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, isActive: checked })}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{rule.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}</Badge>
                            {rule.channel && (
                              <Badge className={CHANNEL_COLORS[rule.channel] || ''}>
                                {CHANNEL_LABELS[rule.channel] || rule.channel}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {rule.last_triggered_at && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmt(rule.last_triggered_at, dateLocale)}
                          </span>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => deleteRule.mutate(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Create rule dialog */}
          <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('admin.adsAiRules.nieuwe_automation_regel')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t('common.name')}</Label>
                  <Input value={newRule.name} onChange={(e) => setNewRule(p => ({ ...p, name: e.target.value }))} placeholder={t('admin.adsAiRules.bijv_auto_negatief_hoge_spend')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t('admin.odooChannels.columnChannel')}</Label>
                    <Select value={newRule.channel} onValueChange={(v) => setNewRule(p => ({ ...p, channel: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bolcom">Bol.com</SelectItem>
                        <SelectItem value="amazon">Amazon</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="meta">Meta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('admin.marketing.contentHistoryList.type')}</Label>
                    <Select value={newRule.rule_type} onValueChange={(v) => setNewRule(p => ({ ...p, rule_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(RULE_TYPE_LABELS).map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dynamic condition fields */}
                {newRule.rule_type === 'auto_negative' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t('admin.adsAiRules.min_clicks')}</Label><Input type="number" value={newRule.min_clicks} onChange={(e) => setNewRule(p => ({ ...p, min_clicks: +e.target.value }))} /></div>
                    <div><Label>{t('admin.adsAiRules.max_conversies')}</Label><Input type="number" value={newRule.max_conversions} onChange={(e) => setNewRule(p => ({ ...p, max_conversions: +e.target.value }))} /></div>
                    <div><Label>{t('admin.adsAiRules.min_spend')}</Label><Input type="number" value={newRule.min_spend} onChange={(e) => setNewRule(p => ({ ...p, min_spend: +e.target.value }))} /></div>
                    <div><Label>{t('admin.adsAiRules.lookback_dagen')}</Label><Input type="number" value={newRule.lookback_days} onChange={(e) => setNewRule(p => ({ ...p, lookback_days: +e.target.value }))} /></div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch checked={newRule.is_active} onCheckedChange={(v) => setNewRule(p => ({ ...p, is_active: v }))} />
                  <Label>{t('admin.adsAiRules.direct_activeren')}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={handleCreateRule} disabled={!newRule.name || createRule.isPending}>{t('admin.adsAiRules.aanmaken')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB 3: Geschiedenis */}
        <TabsContent value="history" className="space-y-4">
          {loadingHistory ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded" />)}
            </div>
          ) : history.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">{t('admin.adsAiRules.nog_geen_ai_acties_uitgevoerd')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('admin.adsAiRules.uitgevoerde_aanbevelingen_verschijnen_hier')}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">{t('common.date')}</th>
                        <th className="text-left p-3 font-medium">{t('admin.odooChannels.columnChannel')}</th>
                        <th className="text-left p-3 font-medium">{t('admin.marketing.contentHistoryList.type')}</th>
                        <th className="text-left p-3 font-medium">{t('admin.marketing.emailBlockProperties.beschrijving')}</th>
                        <th className="text-left p-3 font-medium">{t('common.status')}</th>
                        <th className="text-left p-3 font-medium">{t('admin.adsAiRules.door')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="p-3 whitespace-nowrap">{fmt(h.applied_at, dateLocale)}</td>
                          <td className="p-3">
                            <Badge className={CHANNEL_COLORS[h.channel] || ''}>
                              {CHANNEL_LABELS[h.channel] || h.channel}
                            </Badge>
                          </td>
                          <td className="p-3">{TYPE_LABELS[h.recommendation_type] || h.recommendation_type}</td>
                          <td className="p-3 max-w-xs truncate">{h.reason}</td>
                          <td className="p-3">
                            <Badge variant={h.status === 'auto_applied' ? 'secondary' : 'default'}>
                              {h.status === 'auto_applied' ? 'Auto' : 'Handmatig'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {h.auto_apply ? (
                              <span className="flex items-center gap-1 text-muted-foreground"><Bot className="h-3 w-3" /> AI</span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3 w-3" /> {t('admin.adsAiRules.merchant')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
