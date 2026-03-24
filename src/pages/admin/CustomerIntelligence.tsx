import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, TrendingUp, AlertTriangle, Users, Heart, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomerIntelligence, type RFMSegment, type CustomerRFM } from '@/hooks/useCustomerIntelligence';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CHURN_COLORS = { low: 'text-green-600', medium: 'text-yellow-600', high: 'text-orange-600', critical: 'text-red-600' };
const CHURN_BG = { low: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800' };

export default function CustomerIntelligence() {
  const { data, isLoading } = useCustomerIntelligence();
  const navigate = useNavigate();
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'clv' | 'churn' | 'rfm' | 'spent'>('clv');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data || data.customers.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" /> Customer Intelligence</h1>
          <p className="text-muted-foreground">RFM-analyse, CLV voorspelling & churn-detectie</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Nog geen klantdata</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Voeg klanten toe of importeer ze om de intelligence dashboard te activeren.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { customers, distribution, stats } = data;

  const filtered = segmentFilter === 'all' ? customers : customers.filter(c => c.segment === segmentFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'clv') return b.clv_predicted - a.clv_predicted;
    if (sortBy === 'spent') return b.total_spent - a.total_spent;
    if (sortBy === 'rfm') return b.rfm_score - a.rfm_score;
    // churn: critical first
    const churnOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return churnOrder[a.churn_risk] - churnOrder[b.churn_risk];
  });

  const revenueBySegment = distribution.map(d => ({
    name: d.label,
    omzet: Math.round(d.revenue),
    klanten: d.count,
    fill: d.color,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" /> Customer Intelligence
        </h1>
        <p className="text-muted-foreground">RFM-analyse, CLV voorspelling & churn-detectie op basis van {stats.total} klanten</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totaal klanten</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{distribution.length} segmenten geïdentificeerd</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gem. CLV</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats.avgCLV.toLocaleString('nl-NL')}</div>
            <p className="text-xs text-muted-foreground">Voorspelde levenslange waarde</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risico-klanten</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.atRisk}</div>
            <p className="text-xs text-muted-foreground">Hebben aandacht nodig</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Churn Rate</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.churnRate}%</div>
            <p className="text-xs text-muted-foreground">Hoog/kritiek risico</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* RFM Segment Distribution - Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RFM Segmentverdeling</CardTitle>
            <CardDescription>Klanten per segment</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ label, count }) => `${label} (${count})`}
                  labelLine
                >
                  {distribution.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} klanten`, 'Aantal']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Segment - Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Omzet per segment</CardTitle>
            <CardDescription>Totale omzet per klantsegment</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueBySegment} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `€${v.toLocaleString('nl-NL')}`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`€${value.toLocaleString('nl-NL')}`, 'Omzet']} />
                <Bar dataKey="omzet" radius={[0, 4, 4, 0]}>
                  {revenueBySegment.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Segment Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Segmenten</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {distribution.map(d => (
            <Card 
              key={d.segment} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSegmentFilter(d.segment === segmentFilter ? 'all' : d.segment)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="font-medium text-sm">{d.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{d.count}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{d.description}</p>
                <p className="text-sm font-semibold">€{Math.round(d.revenue).toLocaleString('nl-NL')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Klantoverzicht
                {segmentFilter !== 'all' && (
                  <Button variant="ghost" size="sm" className="ml-2" onClick={() => setSegmentFilter('all')}>
                    Filter wissen
                  </Button>
                )}
              </CardTitle>
              <CardDescription>{sorted.length} klanten</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Alle segmenten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle segmenten</SelectItem>
                  {distribution.map(d => (
                    <SelectItem key={d.segment} value={d.segment}>{d.label} ({d.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clv">CLV ↓</SelectItem>
                  <SelectItem value="spent">Besteed ↓</SelectItem>
                  <SelectItem value="rfm">RFM Score ↓</SelectItem>
                  <SelectItem value="churn">Churn risico ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klant</TableHead>
                  <TableHead className="text-center">R</TableHead>
                  <TableHead className="text-center">F</TableHead>
                  <TableHead className="text-center">M</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Besteed</TableHead>
                  <TableHead className="text-right">CLV</TableHead>
                  <TableHead className="text-center">Churn</TableHead>
                  <TableHead className="text-right">Laatste bestelling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 50).map(c => (
                  <TableRow 
                    key={c.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/customers/${c.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <RFMDot score={c.recency_score} />
                    </TableCell>
                    <TableCell className="text-center">
                      <RFMDot score={c.frequency_score} />
                    </TableCell>
                    <TableCell className="text-center">
                      <RFMDot score={c.monetary_score} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {distribution.find(d => d.segment === c.segment)?.label ?? c.segment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      €{c.total_spent.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      €{c.clv_predicted.toLocaleString('nl-NL')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${CHURN_BG[c.churn_risk]}`} variant="secondary">
                        {c.churn_risk === 'low' ? 'Laag' : c.churn_risk === 'medium' ? 'Gemiddeld' : c.churn_risk === 'high' ? 'Hoog' : 'Kritiek'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {c.days_since_last_order !== null ? `${c.days_since_last_order}d geleden` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sorted.length > 50 && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Top 50 van {sorted.length} klanten getoond
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RFMDot({ score }: { score: number }) {
  const colors = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];
  return (
    <div className="flex items-center justify-center">
      <div className={`w-6 h-6 rounded-full ${colors[score]} flex items-center justify-center text-white text-xs font-bold`}>
        {score}
      </div>
    </div>
  );
}
