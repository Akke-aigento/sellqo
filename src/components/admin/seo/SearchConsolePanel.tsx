import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  TrendingUp, 
  TrendingDown,
  MousePointerClick,
  Eye,
  BarChart3,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Link2,
  ExternalLink,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useTenant } from '@/hooks/useTenant';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

interface SearchConsoleData {
  id: string;
  query: string;
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
  date: string;
  country: string | null;
  device: string | null;
}

export function SearchConsolePanel() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState('7');
  const [searchFilter, setSearchFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');

  // Fetch search console data
  const { data: searchData = [], isLoading } = useQuery({
    queryKey: ['search-console', currentTenant?.id, dateRange],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('seo_search_console_data')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .gte('date', startDate)
        .order('clicks', { ascending: false });
      
      if (error) throw error;
      return data as SearchConsoleData[];
    },
    enabled: !!currentTenant?.id,
  });

  // Generate demo data mutation
  const generateDemoDataMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      const queries = [
        'online winkel', 'webshop producten', 'beste prijzen online',
        'snelle levering', 'gratis verzending', 'korting actie',
        'product review', 'vergelijk prijzen', 'betrouwbare webshop'
      ];
      
      const pages = ['/', '/producten', '/categorie/populair', '/aanbiedingen', '/over-ons'];
      const devices = ['desktop', 'mobile', 'tablet'];
      const countries = ['NL', 'BE', 'DE'];
      
      const demoData = [];
      
      for (let i = 0; i < 30; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        
        for (const query of queries.slice(0, 5 + Math.floor(Math.random() * 4))) {
          demoData.push({
            tenant_id: currentTenant.id,
            query,
            page: pages[Math.floor(Math.random() * pages.length)],
            clicks: Math.floor(Math.random() * 100) + 1,
            impressions: Math.floor(Math.random() * 1000) + 100,
            ctr: Math.random() * 10,
            position: Math.random() * 30 + 1,
            date,
            country: countries[Math.floor(Math.random() * countries.length)],
            device: devices[Math.floor(Math.random() * devices.length)],
          });
        }
      }

      // Insert in batches
      const batchSize = 50;
      for (let i = 0; i < demoData.length; i += batchSize) {
        const batch = demoData.slice(i, i + batchSize);
        const { error } = await supabase
          .from('seo_search_console_data')
          .insert(batch);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-console'] });
      toast.success('Demo data gegenereerd');
    },
    onError: (error: Error) => {
      toast.error('Genereren mislukt', { description: error.message });
    },
  });

  // Aggregate stats
  const totalClicks = searchData.reduce((sum, d) => sum + d.clicks, 0);
  const totalImpressions = searchData.reduce((sum, d) => sum + d.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgPosition = searchData.length > 0 
    ? searchData.reduce((sum, d) => sum + (d.position || 0), 0) / searchData.length 
    : 0;

  // Aggregate by query
  const queryStats = searchData.reduce((acc, d) => {
    if (!acc[d.query]) {
      acc[d.query] = { query: d.query, clicks: 0, impressions: 0, positions: [] };
    }
    acc[d.query].clicks += d.clicks;
    acc[d.query].impressions += d.impressions;
    if (d.position) acc[d.query].positions.push(d.position);
    return acc;
  }, {} as Record<string, { query: string; clicks: number; impressions: number; positions: number[] }>);

  const topQueries = Object.values(queryStats)
    .map(q => ({
      ...q,
      ctr: q.impressions > 0 ? (q.clicks / q.impressions) * 100 : 0,
      avgPosition: q.positions.length > 0 
        ? q.positions.reduce((a, b) => a + b, 0) / q.positions.length 
        : null,
    }))
    .filter(q => !searchFilter || q.query.toLowerCase().includes(searchFilter.toLowerCase()))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20);

  // Daily trend data
  const dailyTrend = searchData.reduce((acc, d) => {
    if (!acc[d.date]) {
      acc[d.date] = { date: d.date, clicks: 0, impressions: 0 };
    }
    acc[d.date].clicks += d.clicks;
    acc[d.date].impressions += d.impressions;
    return acc;
  }, {} as Record<string, { date: string; clicks: number; impressions: number }>);

  const chartData = Object.values(dailyTrend)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      date: format(new Date(d.date), 'd MMM', { locale: dateLocale }),
    }));

  // Device breakdown
  const deviceStats = searchData.reduce((acc, d) => {
    const device = d.device || 'unknown';
    if (!acc[device]) {
      acc[device] = { device, clicks: 0, impressions: 0 };
    }
    acc[device].clicks += d.clicks;
    acc[device].impressions += d.impressions;
    return acc;
  }, {} as Record<string, { device: string; clicks: number; impressions: number }>);

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      default: return Monitor;
    }
  };

  const isConnected = searchData.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('admin.seo.searchConsolePanel.search_console')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('admin.seo.searchConsolePanel.bekijk_hoe_je_site_presteert_in')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t('admin.seo.searchConsolePanel.laatste_7_dagen')}</SelectItem>
              <SelectItem value="28">{t('admin.seo.searchConsolePanel.laatste_28_dagen')}</SelectItem>
              <SelectItem value="90">{t('admin.seo.searchConsolePanel.laatste_3_maanden')}</SelectItem>
            </SelectContent>
          </Select>
          
          {!isConnected && (
            <Button
              variant="outline"
              onClick={() => generateDemoDataMutation.mutate()}
              disabled={generateDemoDataMutation.isPending}
            >
              {generateDemoDataMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4 mr-2" />
              )}
              Demo data laden
            </Button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">{t('admin.seo.searchConsolePanel.google_search_console_koppelen')}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {t('admin.seo.searchConsolePanel.koppel_je_google_search_console_account')}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" disabled>
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('admin.seo.searchConsolePanel.koppel_search_console')}
              </Button>
              <span className="text-xs text-muted-foreground">{t('admin.seo.searchConsolePanel.binnenkort_beschikbaar')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-xs">{t('admin.seo.searchConsolePanel.klikken')}</span>
            </div>
            <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-xs">{t('admin.adsBolcomCampaignDetail.impressies')}</span>
            </div>
            <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">{t('admin.seo.searchConsolePanel.gem_ctr')}</span>
            </div>
            <p className="text-2xl font-bold">{avgCtr.toFixed(1)}%</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">{t('admin.seo.searchConsolePanel.gem_positie')}</span>
            </div>
            <p className="text-2xl font-bold">{avgPosition.toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>

      {isConnected && (
        <>
          {/* Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.seo.coreWebVitalsPanel.prestatie_trend')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="hsl(var(--chart-1))" 
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.2}
                      name="Klikken"
                    />
                    <Area 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="impressions" 
                      stroke="hsl(var(--chart-2))" 
                      fill="hsl(var(--chart-2))"
                      fillOpacity={0.1}
                      name="Impressies"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Queries */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t('admin.seo.searchConsolePanel.top_zoekopdrachten')}</CardTitle>
                  <Input
                    placeholder={t('admin.seo.searchConsolePanel.zoek_query')}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-48"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('admin.seo.searchConsolePanel.query')}</TableHead>
                          <TableHead className="text-right">{t('admin.seo.searchConsolePanel.klikken_2')}</TableHead>
                          <TableHead className="text-right">{t('admin.adsBolcomCampaignDetail.impressies')}</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">{t('admin.seo.searchConsolePanel.positie')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topQueries.map((q, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{q.query}</TableCell>
                            <TableCell className="text-right">{q.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{q.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <span className={q.ctr > 5 ? 'text-green-500' : q.ctr > 2 ? 'text-yellow-500' : ''}>
                                {q.ctr.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge 
                                variant="outline" 
                                className={
                                  (q.avgPosition || 100) <= 10 ? 'bg-green-500/10 text-green-500' :
                                  (q.avgPosition || 100) <= 20 ? 'bg-yellow-500/10 text-yellow-500' :
                                  'bg-red-500/10 text-red-500'
                                }
                              >
                                {q.avgPosition?.toFixed(1) || '-'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('admin.seo.searchConsolePanel.apparaat_verdeling')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.values(deviceStats).map((d) => {
                    const Icon = getDeviceIcon(d.device);
                    const percentage = totalClicks > 0 ? (d.clicks / totalClicks) * 100 : 0;
                    
                    return (
                      <div key={d.device} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="capitalize">{d.device}</span>
                          </div>
                          <span className="font-medium">{d.clicks.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {percentage.toFixed(1)}% van alle klikken
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
