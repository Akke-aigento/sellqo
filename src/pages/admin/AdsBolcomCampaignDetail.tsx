import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBolcomCampaignDetail, Period } from '@/hooks/useBolcomCampaignDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowLeft, Pause, Play, Pencil, Plus, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CampaignWizard } from '@/components/admin/ads/CampaignWizard';
import type { AdCampaign } from '@/types/ads';

const formatCurrency = (v: number | null) => v != null ? `€${v.toFixed(2)}` : '—';
const formatPct = (v: number | null) => v != null ? `${v.toFixed(1)}%` : '—';

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-700 border-green-200',
  paused: 'bg-muted text-muted-foreground',
  archived: 'bg-destructive/10 text-destructive',
  ENABLED: 'bg-green-500/10 text-green-700 border-green-200',
  PAUSED: 'bg-muted text-muted-foreground',
};

export default function AdsBolcomCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    campaign, chartData, adGroups, positiveKeywords, negativeKeywords,
    keywordPerf, adGroupPerf, isLoading, period, setPeriod,
    updateCampaignStatus, updateKeywordBid, toggleKeywordStatus,
    addKeyword, addNegativeKeyword,
  } = useBolcomCampaignDetail(id);

  const [editingBid, setEditingBid] = useState<string | null>(null);
  const [bidValue, setBidValue] = useState('');
  const [negModalOpen, setNegModalOpen] = useState(false);
  const [negKeyword, setNegKeyword] = useState('');
  const [negMatchType, setNegMatchType] = useState('broad');
  const [addKwGroup, setAddKwGroup] = useState<string | null>(null);
  const [newKw, setNewKw] = useState('');
  const [newKwMatch, setNewKwMatch] = useState('broad');
  const [newKwBid, setNewKwBid] = useState('0.25');
  const [showEdit, setShowEdit] = useState(false);

  // Adapter: map Bol campaign data to AdCampaign shape for CampaignWizard
  const campaignForWizard = useMemo<AdCampaign | null>(() => {
    if (!campaign) return null;
    return {
      id: campaign.id,
      tenant_id: campaign.tenant_id,
      connection_id: null,
      name: campaign.name,
      platform: 'bol_ads',
      campaign_type: 'sponsored_products',
      segment_id: null,
      audience_type: null,
      audience_config: {},
      product_ids: null,
      category_ids: null,
      budget_type: campaign.daily_budget ? 'daily' : 'lifetime',
      budget_amount: campaign.daily_budget ?? campaign.total_budget ?? null,
      bid_strategy: (campaign.targeting_type === 'AUTO' ? 'auto' : 'manual_cpc') as any,
      target_roas: null,
      status: campaign.status as any,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      platform_campaign_id: campaign.bolcom_campaign_id,
      platform_status: campaign.status,
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      revenue: 0,
      roas: null,
      ai_suggested: false,
      ai_suggestion_id: null,
      created_at: campaign.created_at ?? '',
      updated_at: campaign.updated_at ?? '',
    };
  }, [campaign]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => (
            <Card key={i}><CardContent className="pt-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-24" />
            </CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>
        <Card><CardContent className="p-4 space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded" />)}
        </CardContent></Card>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Campagne niet gevonden</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/ads/bolcom')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Terug
        </Button>
      </div>
    );
  }

  const isActive = campaign.status === 'active' || campaign.status === 'ENABLED';
  const firstAdGroupId = adGroups[0]?.id;

  const handleToggleStatus = () => {
    updateCampaignStatus.mutate(isActive ? 'paused' : 'active');
  };

  const handleSaveBid = (keywordId: string) => {
    const bid = parseFloat(bidValue);
    if (!isNaN(bid) && bid > 0) {
      updateKeywordBid.mutate({ keywordId, bid });
    }
    setEditingBid(null);
  };

  const handleAddKeyword = () => {
    if (!addKwGroup || !newKw.trim()) return;
    addKeyword.mutate({
      adgroupId: addKwGroup,
      keyword: newKw.trim(),
      matchType: newKwMatch,
      bid: parseFloat(newKwBid) || 0.25,
    });
    setNewKw('');
    setAddKwGroup(null);
  };

  const handleAddNegative = () => {
    if (!negKeyword.trim() || !firstAdGroupId) return;
    addNegativeKeyword.mutate({
      adgroupId: firstAdGroupId,
      keyword: negKeyword.trim(),
      matchType: negMatchType,
    });
    setNegKeyword('');
    setNegModalOpen(false);
  };

  const periods: Period[] = ['7d', '30d', '90d'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => navigate('/admin/ads')} className="hover:underline">Ads</button>
            <span>/</span>
            <button onClick={() => navigate('/admin/ads/bolcom')} className="hover:underline">Bol.com</button>
            <span>/</span>
            <span>{campaign.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge className={statusColors[campaign.status] || 'bg-muted'}>{campaign.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleToggleStatus} disabled={updateCampaignStatus.isPending}>
            {isActive ? <><Pause className="h-4 w-4 mr-2" /> Pauzeren</> : <><Play className="h-4 w-4 mr-2" /> Hervatten</>}
          </Button>
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Bewerken
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Type</p><p className="text-lg font-semibold">{campaign.targeting_type || campaign.campaign_type}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Dagbudget</p><p className="text-lg font-semibold">{formatCurrency(campaign.daily_budget)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Totaalbudget</p><p className="text-lg font-semibold">{campaign.total_budget ? formatCurrency(campaign.total_budget) : 'Onbeperkt'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Start / Eind</p><p className="text-sm font-semibold">{campaign.start_date ? format(new Date(campaign.start_date), 'dd-MM-yyyy') : '—'} / {campaign.end_date ? format(new Date(campaign.end_date), 'dd-MM-yyyy') : '—'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Laatste sync</p><p className="text-sm font-semibold">{campaign.synced_at ? format(new Date(campaign.synced_at), 'dd MMM HH:mm', { locale: nl }) : '—'}</p></CardContent></Card>
      </div>

      {/* Period selector + Chart */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Performance</CardTitle>
          <div className="flex gap-1">
            {periods.map(p => (
              <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)}>{p}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Geen performance data voor deze periode</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={v => format(new Date(v), 'dd/MM')} className="text-xs" />
                <YAxis yAxisId="left" tickFormatter={v => `€${v}`} className="text-xs" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} className="text-xs" />
                <Tooltip formatter={(v: number, name: string) => name === 'acos' ? `${v?.toFixed(1)}%` : `€${v?.toFixed(2)}`} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="spend" stroke="hsl(var(--destructive))" name="Spend" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" name="Omzet" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="acos" stroke="hsl(var(--accent-foreground))" name="ACoS" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Ad Groups accordion */}
      <Card>
        <CardHeader>
          <CardTitle>Ad Groups & Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          {adGroups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Geen ad groups gevonden</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {adGroups.map(ag => {
                const agKws = positiveKeywords.filter(k => k.adgroup_id === ag.id);
                const agPerf = adGroupPerf[ag.id];
                const acos = agPerf && agPerf.revenue > 0 ? (agPerf.spend / agPerf.revenue) * 100 : null;

                return (
                  <AccordionItem key={ag.id} value={ag.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4 w-full pr-4">
                        <span className="font-medium">{ag.name}</span>
                        <Badge variant="outline" className={statusColors[ag.status] || ''}>{ag.status}</Badge>
                        <span className="text-sm text-muted-foreground ml-auto">Bod: {formatCurrency(ag.default_bid)}</span>
                        <span className="text-sm text-muted-foreground">{agKws.length} keywords</span>
                        <span className="text-sm text-muted-foreground">Spend: {formatCurrency(agPerf?.spend ?? 0)}</span>
                        <span className="text-sm text-muted-foreground">ACoS: {formatPct(acos)}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                      <Table className="min-w-[800px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Keyword</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead>Bod</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Impressies</TableHead>
                            <TableHead>Clicks</TableHead>
                            <TableHead>Spend</TableHead>
                            <TableHead>Orders</TableHead>
                            <TableHead>ACoS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agKws.map(kw => {
                            const perf = keywordPerf[kw.id];
                            const kwAcos = perf && perf.revenue > 0 ? (perf.spend / perf.revenue) * 100 : null;
                            const isEditing = editingBid === kw.id;

                            return (
                              <TableRow key={kw.id}>
                                <TableCell className="font-medium">{kw.keyword}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{kw.match_type}</Badge></TableCell>
                                <TableCell>
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={bidValue}
                                      onChange={e => setBidValue(e.target.value)}
                                      onBlur={() => handleSaveBid(kw.id)}
                                      onKeyDown={e => e.key === 'Enter' && handleSaveBid(kw.id)}
                                      className="w-20 h-7 text-sm"
                                      autoFocus
                                    />
                                  ) : (
                                    <button
                                      className="text-primary hover:underline cursor-pointer"
                                      onClick={() => { setEditingBid(kw.id); setBidValue(String(kw.bid ?? 0)); }}
                                    >
                                      {formatCurrency(kw.bid)}
                                    </button>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={kw.status === 'active'}
                                    onCheckedChange={checked =>
                                      toggleKeywordStatus.mutate({ keywordId: kw.id, status: checked ? 'active' : 'paused' })
                                    }
                                  />
                                </TableCell>
                                <TableCell>{perf?.impressions ?? 0}</TableCell>
                                <TableCell>{perf?.clicks ?? 0}</TableCell>
                                <TableCell>{formatCurrency(perf?.spend ?? 0)}</TableCell>
                                <TableCell>{perf?.orders ?? 0}</TableCell>
                                <TableCell>{formatPct(kwAcos)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>

                      {/* Add keyword inline */}
                      {addKwGroup === ag.id ? (
                        <div className="flex items-center gap-2 mt-3 px-4">
                          <Input placeholder="Keyword" value={newKw} onChange={e => setNewKw(e.target.value)} className="w-48" />
                          <select value={newKwMatch} onChange={e => setNewKwMatch(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                            <option value="broad">Broad</option>
                            <option value="phrase">Phrase</option>
                            <option value="exact">Exact</option>
                          </select>
                          <Input type="number" step="0.01" placeholder="Bod" value={newKwBid} onChange={e => setNewKwBid(e.target.value)} className="w-20" />
                          <Button size="sm" onClick={handleAddKeyword} disabled={addKeyword.isPending}>Toevoegen</Button>
                          <Button size="sm" variant="ghost" onClick={() => setAddKwGroup(null)}>Annuleren</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="mt-2 ml-4" onClick={() => setAddKwGroup(ag.id)}>
                          <Plus className="h-4 w-4 mr-1" /> Keyword toevoegen
                        </Button>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Negative Keywords */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Negatieve Keywords</CardTitle>
          <Button size="sm" onClick={() => setNegModalOpen(true)} disabled={!firstAdGroupId}>
            <Plus className="h-4 w-4 mr-1" /> Toevoegen
          </Button>
        </CardHeader>
        <CardContent>
          {negativeKeywords.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Geen negatieve keywords</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Match Type</TableHead>
                  <TableHead>Toegevoegd op</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negativeKeywords.map(kw => (
                  <TableRow key={kw.id}>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell><Badge variant="outline">{kw.match_type}</Badge></TableCell>
                    <TableCell>{kw.created_at ? format(new Date(kw.created_at), 'dd-MM-yyyy', { locale: nl }) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add negative keyword dialog */}
      <Dialog open={negModalOpen} onOpenChange={setNegModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Negatief keyword toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Keyword" value={negKeyword} onChange={e => setNegKeyword(e.target.value)} />
            <select value={negMatchType} onChange={e => setNegMatchType(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="broad">Broad</option>
              <option value="phrase">Phrase</option>
              <option value="exact">Exact</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNegModalOpen(false)}>Annuleren</Button>
            <Button onClick={handleAddNegative} disabled={addNegativeKeyword.isPending}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <CampaignWizard campaign={campaignForWizard} onClose={() => setShowEdit(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
