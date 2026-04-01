import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Megaphone, Plus, ArrowUpRight, ArrowDownRight, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useBolcomAds, Period } from '@/hooks/useBolcomAds';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const formatCurrency = (val: number) => `€${val.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPct = (val: number) => `${val.toFixed(2)}%`;

function ChangeIndicator({ value, invert = false }: { value: number; invert?: boolean }) {
  if (Math.abs(value) < 0.01) return null;
  const isPositive = invert ? value < 0 : value > 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
      <Icon className="h-3 w-3 mr-0.5" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function AbsChangeIndicator({ value, suffix = 'pp', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  if (Math.abs(value) < 0.01) return null;
  const isPositive = invert ? value < 0 : value > 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
      <Icon className="h-3 w-3 mr-0.5" />
      {Math.abs(value).toFixed(2)}{suffix}
    </span>
  );
}

type SortKey = 'name' | 'status' | 'perf_spend' | 'perf_acos' | 'perf_impressions' | 'perf_clicks' | 'perf_orders';

export default function AdsBolcomPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { period, setPeriod, isLoading, hasData, kpis, chartData, campaigns, topKeywords, topSearchTerms } = useBolcomAds();
  const [sortKey, setSortKey] = useState<SortKey>('perf_spend');
  const [sortAsc, setSortAsc] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!currentTenant?.id || syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ads-bolcom-sync', {
        body: { tenant_id: currentTenant.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sync voltooid: ${data.campaigns_synced} campagnes, ${data.adgroups_synced} ad groups, ${data.keywords_synced} keywords, ${data.products_synced} producten`);
      queryClient.invalidateQueries({ queryKey: ['bolcom-ads'] });
    } catch (e: any) {
      toast.error('Sync mislukt: ' + (e.message || 'Onbekende fout'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const av = (a as any)[sortKey];
    const bv = (b as any)[sortKey];
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
  });

  const periods: Period[] = ['7d', '30d', '90d'];

  if (!isLoading && !hasData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="cursor-pointer hover:underline" onClick={() => navigate('/admin/ads')}>Ads</span>
          <ChevronRight className="h-3 w-3" /> <span>Bol.com</span>
        </div>
        <Card className="p-12 text-center">
          <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Nog geen Bol.com campagnes</h2>
          <p className="text-muted-foreground mb-4">Synchroniseer je Bol.com advertenties om te beginnen.</p>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {syncing ? 'Synchroniseren...' : 'Synchroniseer'}
          </Button>
        </Card>
      </div>
    );
  }

  const statusColor = (s: string) => {
    if (s === 'ENABLED' || s === 'active') return 'bg-green-500/10 text-green-700 border-green-200';
    if (s === 'PAUSED' || s === 'paused') return 'bg-muted text-muted-foreground';
    return 'bg-red-500/10 text-red-700 border-red-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="cursor-pointer hover:underline" onClick={() => navigate('/admin/ads')}>Ads</span>
            <ChevronRight className="h-3 w-3" /> <span>Bol.com</span>
          </div>
          <h1 className="text-2xl font-bold">Bol.com Ads</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            {periods.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${period === p ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {p}
              </button>
            ))}
          </div>
          <Button disabled variant="outline"><Plus className="h-4 w-4 mr-2" />Nieuwe campagne</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Spend</p>
          <p className="text-2xl font-bold">{formatCurrency(kpis.spend)}</p>
          <ChangeIndicator value={kpis.spendChange} />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Omzet</p>
          <p className="text-2xl font-bold">{formatCurrency(kpis.revenue)}</p>
          <ChangeIndicator value={kpis.revenueChange} />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">ACoS</p>
          <p className="text-2xl font-bold">{formatPct(kpis.acos)}</p>
          <AbsChangeIndicator value={kpis.acosChange} invert />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">CTR</p>
          <p className="text-2xl font-bold">{formatPct(kpis.ctr)}</p>
          <AbsChangeIndicator value={kpis.ctrChange} />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Conversieratio</p>
          <p className="text-2xl font-bold">{formatPct(kpis.convRate)}</p>
          <AbsChangeIndicator value={kpis.convRateChange} />
        </CardContent></Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} className="text-xs" />
                <YAxis yAxisId="left" tickFormatter={v => `€${v}`} className="text-xs" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} className="text-xs" />
                <Tooltip formatter={(v: number, name: string) => name === 'acos' ? `${v.toFixed(2)}%` : formatCurrency(v)} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="spend" stroke="hsl(var(--destructive))" name="Spend" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" name="Omzet" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="acos" stroke="hsl(var(--muted-foreground))" name="ACoS" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Campaigns table */}
      <Card>
        <CardHeader><CardTitle>Campagnes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {([['name','Naam'],['status','Status'],['daily_budget','Budget'],['targeting_type','Targeting'],['perf_spend','Spend'],['perf_acos','ACoS'],['perf_impressions','Impressies'],['perf_clicks','Clicks'],['perf_orders','Orders']] as [SortKey|string, string][]).map(([key, label]) => (
                  <TableHead key={key} className="cursor-pointer select-none" onClick={() => handleSort(key as SortKey)}>
                    {label} {sortKey === key ? (sortAsc ? '↑' : '↓') : ''}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCampaigns.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/admin/ads/bolcom/campaigns/${c.id}`)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge className={statusColor(c.status)}>{c.status}</Badge></TableCell>
                  <TableCell>{c.daily_budget ? `€${c.daily_budget}/dag` : c.total_budget ? `€${c.total_budget} totaal` : '-'}</TableCell>
                  <TableCell><Badge variant="outline">{c.targeting_type}</Badge></TableCell>
                  <TableCell>{formatCurrency(c.perf_spend)}</TableCell>
                  <TableCell>{formatPct(c.perf_acos)}</TableCell>
                  <TableCell>{c.perf_impressions.toLocaleString('nl-NL')}</TableCell>
                  <TableCell>{c.perf_clicks.toLocaleString('nl-NL')}</TableCell>
                  <TableCell>{c.perf_orders}</TableCell>
                </TableRow>
              ))}
              {sortedCampaigns.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Geen campagnes gevonden</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Keywords + Search Terms */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Top Keywords</CardTitle>
            <Button variant="link" size="sm" onClick={() => navigate('/admin/ads/bolcom/keywords')}>Alle keywords →</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Bod</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>ACoS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topKeywords.map((kw, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{kw.match_type}</Badge></TableCell>
                    <TableCell>{kw.bid ? `€${kw.bid}` : '-'}</TableCell>
                    <TableCell>{kw.clicks}</TableCell>
                    <TableCell>{formatPct(kw.acos)}</TableCell>
                  </TableRow>
                ))}
                {topKeywords.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Geen keyword data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Top Zoektermen</CardTitle>
            <Button variant="link" size="sm" onClick={() => navigate('/admin/ads/bolcom/search-terms')}>Alle zoektermen →</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zoekterm</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Spend</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>ACoS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSearchTerms.map((st, i) => (
                  <TableRow key={i} className={st.isWaste ? 'bg-red-500/5' : ''}>
                    <TableCell className={`font-medium ${st.isWaste ? 'text-red-600' : ''}`}>{st.search_term}</TableCell>
                    <TableCell>{st.clicks}</TableCell>
                    <TableCell>{formatCurrency(st.spend)}</TableCell>
                    <TableCell>{st.orders}</TableCell>
                    <TableCell>{formatPct(st.acos)}</TableCell>
                  </TableRow>
                ))}
                {topSearchTerms.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Geen zoekterm data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
