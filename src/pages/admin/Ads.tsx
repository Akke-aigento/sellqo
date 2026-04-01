import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAdsOverview, type AdsPeriod } from '@/hooks/useAdsOverview';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Megaphone, TrendingUp, TrendingDown, ArrowRight, AlertTriangle,
  Sparkles, Package, ExternalLink, Loader2, Cable,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CHANNELS = [
  { id: 'bolcom', name: 'Bol.com', emoji: '🛒', color: 'bg-blue-500', enabled: true, link: '/admin/ads/bolcom' },
  { id: 'amazon', name: 'Amazon', emoji: '📦', color: 'bg-orange-500', enabled: false },
  { id: 'google', name: 'Google Ads', emoji: '🔍', color: 'bg-red-500', enabled: false },
  { id: 'meta', name: 'Meta', emoji: '📱', color: 'bg-indigo-500', enabled: false },
];

const PERIODS: { label: string; value: AdsPeriod }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

function formatCurrency(val: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(val);
}

function ChangeIndicator({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? 'text-green-600' : 'text-red-500';
  if (Math.abs(value) < 0.01) return null;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

export default function AdsPage() {
  const [period, setPeriod] = useState<AdsPeriod>(30);
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const {
    isLoading, hasData, kpis, bolConnection, chartData,
    recommendations, recommendationsCount, inventoryAlerts,
  } = useAdsOverview(period);

  const handleRecommendationAction = async (id: string, status: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('ads_ai_recommendations')
      .update({ status, applied_at: status === 'accepted' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) {
      toast.error('Actie mislukt');
    } else {
      toast.success(status === 'accepted' ? 'Aanbeveling toegepast' : 'Aanbeveling genegeerd');
      queryClient.invalidateQueries({ queryKey: ['ads-ai-recommendations'] });
    }
  };

  // Empty state
  if (!isLoading && !hasData && !bolConnection) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Ads Overzicht</h1>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Geen advertentiekanalen verbonden</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Verbind je eerste advertentiekanaal om je campagnes te beheren, performance te volgen en AI-aanbevelingen te ontvangen.
            </p>
            <Button asChild>
              <Link to="/admin/ads/bolcom">
                <Cable className="h-4 w-4 mr-2" />
                Verbind je eerste kanaal
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ads Overzicht</h1>
          <p className="text-muted-foreground">Cross-channel advertentie performance</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIODS.map(p => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Totale Spend" value={formatCurrency(kpis.spend)} change={kpis.spendChange} loading={isLoading} />
        <KPICard title="Totale Omzet" value={formatCurrency(kpis.revenue)} change={kpis.revenueChange} loading={isLoading} />
        <KPICard title="Blended ACoS" value={`${kpis.acos.toFixed(1)}%`} change={kpis.acosChange} inverse loading={isLoading} />
        <KPICard title="ROAS" value={`${kpis.roas.toFixed(2)}x`} change={kpis.roasChange * 10} loading={isLoading} />
      </div>

      {/* Channel Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CHANNELS.map(ch => (
          <Card key={ch.id} className={`relative ${!ch.enabled ? 'opacity-50' : ''}`}>
            {!ch.enabled && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] rounded-lg flex items-center justify-center z-10">
                <Badge variant="secondary" className="text-xs">Binnenkort beschikbaar</Badge>
              </div>
            )}
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{ch.emoji}</span>
                <span className="font-medium text-sm">{ch.name}</span>
                {ch.enabled && bolConnection && (
                  <Badge variant={bolConnection.is_active ? 'default' : 'secondary'} className="ml-auto text-[10px]">
                    {bolConnection.is_active ? 'Actief' : 'Inactief'}
                  </Badge>
                )}
              </div>
              {ch.enabled && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Spend</span>
                    <span className="font-medium">{formatCurrency(kpis.spend)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ACoS</span>
                    <span className="font-medium">{kpis.acos.toFixed(1)}%</span>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                    <Link to={ch.link!}>
                      Bekijk details <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance over tijd</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => format(new Date(v), 'd MMM', { locale: nl })}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v}`} className="text-muted-foreground" />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'spend' ? 'Spend' : 'Omzet']}
                  labelFormatter={(label) => format(new Date(label), 'd MMMM yyyy', { locale: nl })}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Legend formatter={(value) => (value === 'spend' ? 'Spend' : 'Omzet')} />
                <Line type="monotone" dataKey="spend" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* AI Recommendations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">AI Aanbevelingen</CardTitle>
              {recommendationsCount > 0 && (
                <Badge variant="default" className="text-xs">{recommendationsCount}</Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/ads/ai">Alle regels <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Geen openstaande aanbevelingen. AI analyseert continu je campagnes.
            </p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec: any) => (
                <div key={rec.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{rec.channel}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{rec.recommendation_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="default" onClick={() => handleRecommendationAction(rec.id, 'accepted')}>
                      Toepassen
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRecommendationAction(rec.id, 'rejected')}>
                      Negeren
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-base">Voorraad Alerts</CardTitle>
            {inventoryAlerts.length > 0 && (
              <Badge variant="secondary" className="text-xs">{inventoryAlerts.length}</Badge>
            )}
          </div>
          <CardDescription>Producten met voorraad onder de minimumdrempel voor advertenties</CardDescription>
        </CardHeader>
        <CardContent>
          {inventoryAlerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">✓</Badge>
              Alle geadverteerde producten zijn boven de voorraaddrempel
            </div>
          ) : (
            <div className="space-y-2">
              {inventoryAlerts.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{item.products?.name || 'Onbekend product'}</p>
                      <p className="text-xs text-muted-foreground">
                        Voorraad: {item.products?.stock ?? 0} (min: {item.min_stock_for_ads})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      {item.is_advertised ? 'Ads actief' : 'Gepauzeerd'}
                    </Badge>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/products/${item.product_id}`}>
                        Voorraad bijwerken
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({
  title, value, change, inverse = false, loading,
}: {
  title: string; value: string; change: number; inverse?: boolean; loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-4 pb-4">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-7 w-32" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-bold">{value}</span>
          <ChangeIndicator value={change} inverse={inverse} />
        </div>
      </CardContent>
    </Card>
  );
}
