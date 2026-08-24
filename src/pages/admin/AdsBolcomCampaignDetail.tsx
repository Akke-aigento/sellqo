import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Pause, Play, Pencil, Plus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { BolCampaignEditForm } from '@/components/admin/ads/BolCampaignEditForm';
import { CampaignAIAnalysis } from '@/components/admin/ads/CampaignAIAnalysis';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

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
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    campaign, chartData, adGroups, positiveKeywords, negativeKeywords,
    keywordPerf, adGroupPerf, isLoading, period, setPeriod,
    updateCampaignStatus, updateKeywordBid, toggleKeywordStatus,
    addKeyword, addNegativeKeyword, deleteCampaign,
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
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncToBol = async () => {
    if (!id) return;
    setIsSyncing(true);
    const toastId = 'sync-bol';
    toast.loading('Synchroniseren naar Bol.com...', { id: toastId });
    try {
      const { data, error } = await supabase.functions.invoke('push-bol-campaign', {
        body: { campaign_id: id, force_repush: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Campagne gesynchroniseerd naar Bol.com', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Synchronisatie mislukt', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

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
        <p className="text-muted-foreground">{t('admin.adsBolcomCampaignDetail.campagne_niet_gevonden')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/ads/bolcom')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => navigate('/admin/ads')} className="hover:underline">{t('admin.adsBolcom.ads')}</button>
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncToBol} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline ml-2">{t('admin.adsBolcomCampaignDetail.synchroniseer')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleToggleStatus} disabled={updateCampaignStatus.isPending}>
            {isActive ? <><Pause className="h-4 w-4" /><span className="hidden sm:inline ml-2">{t('admin.adsBolcomCampaignDetail.pauzeren')}</span></> : <><Play className="h-4 w-4" /><span className="hidden sm:inline ml-2">{t('admin.adsBolcomCampaignDetail.hervatten')}</span></>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil className="h-4 w-4" /><span className="hidden sm:inline ml-2">{t('common.edit')}</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4" /><span className="hidden sm:inline ml-2">{t('common.delete')}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('admin.adsBolcomCampaignDetail.campagne_verwijderen')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('admin.adsBolcomCampaignDetail.de_campagne_wordt_gepauzeerd_op_bol')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteCampaign.mutate(undefined, { onSuccess: () => navigate('/admin/ads/bolcom') })}
                  disabled={deleteCampaign.isPending}
                >
                  {deleteCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Verwijderen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t('admin.marketing.contentHistoryList.type')}</p><p className="text-lg font-semibold">{campaign.targeting_type || campaign.campaign_type}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t('admin.ads.campaignWizard.dagbudget')}</p><p className="text-lg font-semibold">{formatCurrency(campaign.daily_budget)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t('admin.ads.campaignWizard.totaalbudget')}</p><p className="text-lg font-semibold">{campaign.total_budget ? formatCurrency(campaign.total_budget) : 'Onbeperkt'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t('admin.adsBolcomCampaignDetail.start_eind')}</p><p className="text-sm font-semibold">{campaign.start_date ? format(new Date(campaign.start_date), 'dd-MM-yyyy') : '—'} / {campaign.end_date ? format(new Date(campaign.end_date), 'dd-MM-yyyy') : '—'}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t('admin.ads.platformConnections.laatste_sync')}</p><p className="text-sm font-semibold">{campaign.synced_at ? format(new Date(campaign.synced_at), 'dd MMM HH:mm', { locale: dateLocale }) : '—'}</p></CardContent></Card>
      </div>

      {/* Period selector + Chart */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('admin.adsBolcom.performance')}</CardTitle>
          <div className="flex gap-1">
            {periods.map(p => (
              <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)}>{p}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">{t('admin.adsBolcomCampaignDetail.geen_performance_data_voor_deze_periode')}</p>
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


      {/* AI Campaign Optimizer */}
      <CampaignAIAnalysis campaignId={campaign.id} tenantId={campaign.tenant_id} />

      {/* Ad Groups accordion */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.adsBolcomCampaignDetail.ad_groups_keywords')}</CardTitle>
        </CardHeader>
        <CardContent>
          {adGroups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('admin.adsBolcomCampaignDetail.geen_ad_groups_gevonden')}</p>
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
                            <TableHead>{t('admin.adsBolcom.keyword')}</TableHead>
                            <TableHead>{t('admin.adsBolcom.match')}</TableHead>
                            <TableHead>{t('admin.adsBolcom.bod')}</TableHead>
                            <TableHead>{t('common.status')}</TableHead>
                            <TableHead>{t('admin.adsBolcomCampaignDetail.impressies')}</TableHead>
                            <TableHead>{t('admin.ads.campaignCard.clicks')}</TableHead>
                            <TableHead>{t('admin.ads.spend')}</TableHead>
                            <TableHead>{t('admin.adsBolcom.orders')}</TableHead>
                            <TableHead>{t('admin.ads.acos')}</TableHead>
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
                          <Input placeholder={t('admin.adsBolcom.keyword')} value={newKw} onChange={e => setNewKw(e.target.value)} className="w-48" />
                          <select value={newKwMatch} onChange={e => setNewKwMatch(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                            <option value="broad">{t('admin.ads.bolCampaignEditForm.broad')}</option>
                            <option value="phrase">{t('admin.ads.bolCampaignEditForm.phrase')}</option>
                            <option value="exact">{t('admin.ads.bolCampaignEditForm.exact')}</option>
                          </select>
                          <Input type="number" step="0.01" placeholder={t('admin.adsBolcom.bod')} value={newKwBid} onChange={e => setNewKwBid(e.target.value)} className="w-20" />
                          <Button size="sm" onClick={handleAddKeyword} disabled={addKeyword.isPending}>{t('common.add')}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setAddKwGroup(null)}>{t('common.cancel')}</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="mt-2 ml-4" onClick={() => setAddKwGroup(ag.id)}>
                          <Plus className="h-4 w-4 mr-1" /> {t('admin.adsBolcomCampaignDetail.keyword_toevoegen')}
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
          <CardTitle>{t('admin.adsBolcomCampaignDetail.negatieve_keywords')}</CardTitle>
          {firstAdGroupId ? (
            <Button size="sm" onClick={() => setNegModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{t('admin.adsBolcomCampaignDetail.voeg_eerst_producten_toe_aan_de')}</span>
          )}
        </CardHeader>
        <CardContent>
          {negativeKeywords.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">{t('admin.adsBolcomCampaignDetail.geen_negatieve_keywords')}</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.adsBolcom.keyword')}</TableHead>
                  <TableHead>{t('admin.adsBolcomCampaignDetail.match_type')}</TableHead>
                  <TableHead>{t('admin.adsBolcomCampaignDetail.toegevoegd_op')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negativeKeywords.map(kw => (
                  <TableRow key={kw.id}>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell><Badge variant="outline">{kw.match_type}</Badge></TableCell>
                    <TableCell>{kw.created_at ? format(new Date(kw.created_at), 'dd-MM-yyyy', { locale: dateLocale }) : '—'}</TableCell>
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
            <DialogTitle>{t('admin.adsBolcomCampaignDetail.negatief_keyword_toevoegen')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder={t('admin.adsBolcom.keyword')} value={negKeyword} onChange={e => setNegKeyword(e.target.value)} />
            <select value={negMatchType} onChange={e => setNegMatchType(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="broad">{t('admin.ads.bolCampaignEditForm.broad')}</option>
              <option value="phrase">{t('admin.ads.bolCampaignEditForm.phrase')}</option>
              <option value="exact">{t('admin.ads.bolCampaignEditForm.exact')}</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNegModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddNegative} disabled={addNegativeKeyword.isPending}>{t('common.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.adsBolcomCampaignDetail.campagne_bewerken')}</DialogTitle>
          </DialogHeader>
          {campaign && (
            <BolCampaignEditForm campaign={campaign} onClose={() => setShowEdit(false)} adGroupId={firstAdGroupId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
