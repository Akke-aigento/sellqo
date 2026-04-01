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
import { useAdsAI } from '@/hooks/useAdsAI';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

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
  bid_adjustment: 'Bod Aanpassing',
  budget_pacing: 'Budget Pacing',
  inventory_pause: 'Voorraad Pauze',
};

function fmt(d: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'd MMM yyyy HH:mm', { locale: nl }); } catch { return '—'; }
}

export default function AdsAiRulesPage() {
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
          <span>Ads</span><span>/</span><span>AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">AI Aanbevelingen</h1>
        </div>
      </div>

      <Tabs defaultValue="recommendations">
        <TabsList>
          <TabsTrigger value="recommendations">Aanbevelingen</TabsTrigger>
          <TabsTrigger value="rules">Automation Regels</TabsTrigger>
          <TabsTrigger value="history">Geschiedenis</TabsTrigger>
        </TabsList>

        {/* TAB 1: Aanbevelingen */}
        <TabsContent value="recommendations" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={channel || 'all'} onValueChange={(v) => setChannel(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Kanaal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle kanalen</SelectItem>
                <SelectItem value="bolcom">Bol.com</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="meta">Meta</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type || 'all'} onValueChange={(v) => setType(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? null : v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Geaccepteerd</SelectItem>
                <SelectItem value="rejected">Afgewezen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recommendations list */}
          {loadingRecs ? (
            <p className="text-muted-foreground">Laden...</p>
          ) : recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Geen aanbevelingen gevonden</p>
                <p className="text-sm text-muted-foreground mt-1">AI analyseert je campagnes continu en doet hier suggesties.</p>
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
                              <span className="text-xs text-muted-foreground">Confidence</span>
                              <Progress value={rec.confidence * 100} className="h-2 flex-1" />
                              <span className="text-xs font-medium">{Math.round(rec.confidence * 100)}%</span>
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground">{fmt(rec.created_at)}</p>
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
            <p className="text-muted-foreground">Laden...</p>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Nog geen automation regels</p>
                <p className="text-sm text-muted-foreground mt-1">Maak regels aan om AI automatisch optimalisaties te laten uitvoeren.</p>
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
                            <Clock className="h-3 w-3" /> {fmt(rule.last_triggered_at)}
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
                <DialogTitle>Nieuwe Automation Regel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Naam</Label>
                  <Input value={newRule.name} onChange={(e) => setNewRule(p => ({ ...p, name: e.target.value }))} placeholder="Bijv. Auto negatief hoge spend" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kanaal</Label>
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
                    <Label>Type</Label>
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
                    <div><Label>Min Clicks</Label><Input type="number" value={newRule.min_clicks} onChange={(e) => setNewRule(p => ({ ...p, min_clicks: +e.target.value }))} /></div>
                    <div><Label>Max Conversies</Label><Input type="number" value={newRule.max_conversions} onChange={(e) => setNewRule(p => ({ ...p, max_conversions: +e.target.value }))} /></div>
                    <div><Label>Min Spend (€)</Label><Input type="number" value={newRule.min_spend} onChange={(e) => setNewRule(p => ({ ...p, min_spend: +e.target.value }))} /></div>
                    <div><Label>Lookback (dagen)</Label><Input type="number" value={newRule.lookback_days} onChange={(e) => setNewRule(p => ({ ...p, lookback_days: +e.target.value }))} /></div>
                  </div>
                )}
                {newRule.rule_type === 'bid_adjustment' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Target ACoS (%)</Label><Input type="number" value={newRule.target_acos} onChange={(e) => setNewRule(p => ({ ...p, target_acos: +e.target.value }))} /></div>
                    <div><Label>Min Datapunten</Label><Input type="number" value={newRule.min_data_points} onChange={(e) => setNewRule(p => ({ ...p, min_data_points: +e.target.value }))} /></div>
                    <div><Label>Max Bod Wijziging (%)</Label><Input type="number" value={newRule.max_bid_change} onChange={(e) => setNewRule(p => ({ ...p, max_bid_change: +e.target.value }))} /></div>
                  </div>
                )}
                {newRule.rule_type === 'inventory_pause' && (
                  <div>
                    <Label>Min Voorraad Level</Label>
                    <Input type="number" value={newRule.min_stock_level} onChange={(e) => setNewRule(p => ({ ...p, min_stock_level: +e.target.value }))} />
                  </div>
                )}
                {newRule.rule_type === 'budget_pacing' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Budget Drempel (%)</Label><Input type="number" value={newRule.budget_threshold} onChange={(e) => setNewRule(p => ({ ...p, budget_threshold: +e.target.value }))} /></div>
                    <div>
                      <Label>Actie</Label>
                      <Select value={newRule.budget_action} onValueChange={(v) => setNewRule(p => ({ ...p, budget_action: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warn">Waarschuwen</SelectItem>
                          <SelectItem value="reduce">Biedingen verlagen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch checked={newRule.is_active} onCheckedChange={(v) => setNewRule(p => ({ ...p, is_active: v }))} />
                  <Label>Direct activeren</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Annuleren</Button>
                <Button onClick={handleCreateRule} disabled={!newRule.name || createRule.isPending}>Aanmaken</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB 3: Geschiedenis */}
        <TabsContent value="history" className="space-y-4">
          {loadingHistory ? (
            <p className="text-muted-foreground">Laden...</p>
          ) : history.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Nog geen uitgevoerde AI acties</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Datum</th>
                        <th className="text-left p-3 font-medium">Kanaal</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Beschrijving</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Door</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="p-3 whitespace-nowrap">{fmt(h.applied_at)}</td>
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
                              <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3 w-3" /> Merchant</span>
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
