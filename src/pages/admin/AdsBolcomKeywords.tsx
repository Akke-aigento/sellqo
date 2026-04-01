import { useBolcomKeywords } from '@/hooks/useBolcomKeywords';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ArrowUpDown, Search, Hash, Target, DollarSign, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const fmt = (v: number) => `€${v.toFixed(2)}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function AdsBolcomKeywords() {
  const {
    keywords, campaigns, summary, isLoading,
    period, setPeriod,
    campaignFilter, setCampaignFilter,
    matchTypeFilter, setMatchTypeFilter,
    statusFilter, setStatusFilter,
    search, setSearch,
    sortKey, sortDir, toggleSort,
    selectedIds, toggleSelect, toggleSelectAll,
    updateKeywordBid, bulkUpdateStatus, bulkDelete,
  } = useBolcomKeywords();

  const [editingBid, setEditingBid] = useState<string | null>(null);
  const [bidValue, setBidValue] = useState('');

  const startEditBid = (id: string, current: number | null) => {
    setEditingBid(id);
    setBidValue(String(current ?? 0));
  };

  const saveBid = (id: string) => {
    const val = parseFloat(bidValue);
    if (!isNaN(val) && val >= 0) updateKeywordBid.mutate({ keywordId: id, bid: val });
    setEditingBid(null);
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

  const selected = Array.from(selectedIds);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/admin/ads" className="hover:text-foreground">Ads</Link>
            <span>/</span>
            <Link to="/admin/ads/bolcom" className="hover:text-foreground">Bol.com</Link>
            <span>/</span>
            <span className="text-foreground">Keywords</span>
          </div>
          <h1 className="text-2xl font-bold">Bol.com Keywords</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Hash className="h-4 w-4" /> Actieve Keywords
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.totalActive}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" /> Gemiddeld Bod
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(summary.avgBid)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Totale Spend
            </CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(summary.totalSpend)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Beste Keyword
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{summary.bestKeyword}</div>
            {summary.bestAcos > 0 && <p className="text-xs text-muted-foreground">ACoS: {fmtPct(summary.bestAcos)}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek keyword..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={campaignFilter ?? 'all'} onValueChange={v => setCampaignFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Campagne" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle campagnes</SelectItem>
            {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={matchTypeFilter ?? 'all'} onValueChange={v => setMatchTypeFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Match Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle types</SelectItem>
            <SelectItem value="exact">Exact</SelectItem>
            <SelectItem value="phrase">Phrase</SelectItem>
            <SelectItem value="broad">Broad</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter ?? 'all'} onValueChange={v => setStatusFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selected.length} geselecteerd</span>
          <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus.mutate({ ids: selected, status: 'paused' })}>Pauzeren</Button>
          <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus.mutate({ ids: selected, status: 'active' })}>Hervatten</Button>
          <Button size="sm" variant="destructive" onClick={() => bulkDelete.mutate(selected)}>Verwijderen</Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <Card><CardContent className="p-4 space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full rounded" />)}
        </CardContent></Card>
      ) : keywords.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">Geen keywords gevonden</h3>
            <p className="text-muted-foreground">Maak eerst een campagne aan of synchroniseer bestaande campagnes.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === keywords.length && keywords.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <SortHeader label="Keyword" field="keyword" />
                    <TableHead>Campagne</TableHead>
                    <TableHead>Ad Group</TableHead>
                    <TableHead>Match Type</TableHead>
                    <SortHeader label="Bod" field="bid" />
                    <TableHead>Status</TableHead>
                    <SortHeader label="Impressies" field="impressions" />
                    <SortHeader label="Clicks" field="clicks" />
                    <SortHeader label="Spend" field="spend" />
                    <SortHeader label="Orders" field="orders" />
                    <SortHeader label="Revenue" field="revenue" />
                    <SortHeader label="ACoS" field="acos" />
                    <SortHeader label="CTR" field="ctr" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map(k => {
                    const rowClass = k.acos > 30 ? 'bg-destructive/10' : k.acos > 0 && k.acos < 10 ? 'bg-green-500/10' : '';
                    return (
                      <TableRow key={k.id} className={rowClass}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(k.id)} onCheckedChange={() => toggleSelect(k.id)} />
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{k.keyword}</TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate">{k.campaign_name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate">{k.adgroup_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{k.match_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {editingBid === k.id ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={bidValue}
                              onChange={e => setBidValue(e.target.value)}
                              onBlur={() => saveBid(k.id)}
                              onKeyDown={e => e.key === 'Enter' && saveBid(k.id)}
                              className="w-20 h-7 text-sm"
                              autoFocus
                            />
                          ) : (
                            <span className="cursor-pointer hover:underline" onClick={() => startEditBid(k.id, k.bid)}>
                              {fmt(k.bid ?? 0)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={k.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {k.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{k.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{k.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{fmt(k.spend)}</TableCell>
                        <TableCell className="text-right">{k.orders}</TableCell>
                        <TableCell className="text-right">{fmt(k.revenue)}</TableCell>
                        <TableCell className="text-right">{k.acos > 0 ? fmtPct(k.acos) : '-'}</TableCell>
                        <TableCell className="text-right">{k.ctr > 0 ? fmtPct(k.ctr) : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
