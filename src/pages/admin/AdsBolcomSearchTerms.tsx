import { useBolcomSearchTerms, SearchTermRow } from '@/hooks/useBolcomSearchTerms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronLeft, ArrowUpDown, Loader2, Search, Hash, TrendingDown, AlertTriangle, Sparkles, Ban, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const fmt = (v: number) => `€${v.toFixed(2)}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function AdsBolcomSearchTerms() {
  const {
    searchTerms, summary, isLoading,
    period, setPeriod,
    search, setSearch,
    onlyNoConversions, setOnlyNoConversions,
    onlyWithAiSuggestion, setOnlyWithAiSuggestion,
    sortKey, sortDir, toggleSort,
    addAsNegativeKeyword, promoteToKeyword,
  } = useBolcomSearchTerms();

  // Modal state
  const [negModal, setNegModal] = useState<SearchTermRow | null>(null);
  const [negMatchType, setNegMatchType] = useState('exact');
  const [promoModal, setPromoModal] = useState<SearchTermRow | null>(null);
  const [promoMatchType, setPromoMatchType] = useState('exact');
  const [promoBid, setPromoBid] = useState('0.50');

  const handleAddNegative = () => {
    if (!negModal?.adgroup_id) return;
    addAsNegativeKeyword.mutate({
      searchTerm: negModal.search_term,
      adgroupId: negModal.adgroup_id,
      matchType: negMatchType,
    });
    setNegModal(null);
  };

  const handlePromote = () => {
    if (!promoModal?.adgroup_id) return;
    const bid = parseFloat(promoBid);
    if (isNaN(bid) || bid <= 0) return;
    promoteToKeyword.mutate({
      searchTerm: promoModal.search_term,
      adgroupId: promoModal.adgroup_id,
      matchType: promoMatchType,
      bid,
    });
    setPromoModal(null);
  };

  const SortHeader = ({ label, field }: { label: string; field: Parameters<typeof toggleSort>[0] }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        {sortKey === field && <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </TableHead>
  );

  const getRowClass = (t: SearchTermRow) => {
    if (t.spend > 5 && t.orders === 0) return 'bg-red-50 dark:bg-red-950/20';
    if (t.orders > 0 && t.acos < 15 && t.acos > 0) return 'bg-green-50 dark:bg-green-950/20';
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/admin/ads" className="hover:text-foreground">Ads</Link>
            <ChevronLeft className="h-3 w-3 rotate-180" />
            <Link to="/admin/ads/bolcom" className="hover:text-foreground">Bol.com</Link>
            <ChevronLeft className="h-3 w-3 rotate-180" />
            <span className="text-foreground">Zoektermen</span>
          </div>
          <h1 className="text-2xl font-bold">Bol.com Zoektermen</h1>
        </div>
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as const).map(p => (
            <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)}>
              {p}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unieke Zoektermen</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary.totalUnique}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Met Conversies</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.withConversions}</p>
            <p className="text-xs text-muted-foreground">{fmtPct(summary.withConversionsPct)} van totaal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Zonder Conversies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.noConversions}</p>
            <p className="text-xs text-red-500 font-medium">{fmt(summary.wastedSpend)} verspild</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI Suggesties</CardTitle>
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary.aiPending}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek zoekterm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={onlyNoConversions} onCheckedChange={setOnlyNoConversions} />
          <span className="text-sm">Alleen zonder conversies</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={onlyWithAiSuggestion} onCheckedChange={setOnlyWithAiSuggestion} />
          <span className="text-sm">Alleen met AI suggestie</span>
        </div>
      </div>

      {/* Table */}
      {searchTerms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Geen zoektermen gevonden</h3>
            <p className="text-muted-foreground">Synchroniseer je Bol.com advertenties om zoektermen te zien.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label="Zoekterm" field="search_term" />
                    <TableHead>Campagne</TableHead>
                    <SortHeader label="Impressies" field="impressions" />
                    <SortHeader label="Clicks" field="clicks" />
                    <SortHeader label="Spend" field="spend" />
                    <SortHeader label="Orders" field="orders" />
                    <SortHeader label="Revenue" field="revenue" />
                    <SortHeader label="ACoS" field="acos" />
                    <SortHeader label="CTR" field="ctr" />
                    <TableHead>Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchTerms.map(t => (
                    <TableRow key={`${t.search_term}-${t.campaign_id}`} className={getRowClass(t)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {t.search_term}
                          {t.ai_action && !t.ai_action_taken && (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-[10px]">
                              <Sparkles className="h-3 w-3 mr-1" />
                              {t.ai_action === 'suggested_negative' ? 'Negatief' : 'Keyword'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{t.campaign_name}</TableCell>
                      <TableCell>{t.impressions.toLocaleString()}</TableCell>
                      <TableCell>{t.clicks.toLocaleString()}</TableCell>
                      <TableCell>{fmt(t.spend)}</TableCell>
                      <TableCell>{t.orders}</TableCell>
                      <TableCell>{fmt(t.revenue)}</TableCell>
                      <TableCell>
                        <span className={t.acos > 30 ? 'text-red-600 font-medium' : t.acos > 0 && t.acos < 10 ? 'text-green-600 font-medium' : ''}>
                          {t.revenue > 0 ? fmtPct(t.acos) : '-'}
                        </span>
                      </TableCell>
                      <TableCell>{fmtPct(t.ctr)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => { setNegModal(t); setNegMatchType('exact'); }}
                            disabled={!t.adgroup_id}
                          >
                            <Ban className="h-3 w-3 mr-1" />Negatief
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => { setPromoModal(t); setPromoMatchType('exact'); setPromoBid('0.50'); }}
                            disabled={!t.adgroup_id}
                          >
                            <Plus className="h-3 w-3 mr-1" />Keyword
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Negative Keyword Modal */}
      <Dialog open={!!negModal} onOpenChange={() => setNegModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Negatief keyword toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Zoekterm:</p>
              <p className="font-medium">{negModal?.search_term}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Match type</label>
              <Select value={negMatchType} onValueChange={setNegMatchType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exact</SelectItem>
                  <SelectItem value="phrase">Phrase</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNegModal(null)}>Annuleren</Button>
            <Button onClick={handleAddNegative} disabled={addAsNegativeKeyword.isPending}>
              {addAsNegativeKeyword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote to Keyword Modal */}
      <Dialog open={!!promoModal} onOpenChange={() => setPromoModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promoveren tot keyword</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Zoekterm:</p>
              <p className="font-medium">{promoModal?.search_term}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Match type</label>
              <Select value={promoMatchType} onValueChange={setPromoMatchType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exact</SelectItem>
                  <SelectItem value="phrase">Phrase</SelectItem>
                  <SelectItem value="broad">Broad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Bod (€)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={promoBid}
                onChange={e => setPromoBid(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoModal(null)}>Annuleren</Button>
            <Button onClick={handlePromote} disabled={promoteToKeyword.isPending}>
              {promoteToKeyword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Toevoegen als keyword
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
