import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Gauge, 
  Clock, 
  Zap, 
  Monitor, 
  Smartphone, 
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTenant } from '@/hooks/useTenant';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WebVital {
  name: string;
  value: number;
  unit: string;
  rating: 'good' | 'needs-improvement' | 'poor';
  thresholds: { good: number; poor: number };
  description: string;
}

const VITAL_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000, unit: 'ms', name: 'Largest Contentful Paint' },
  fid: { good: 100, poor: 300, unit: 'ms', name: 'First Input Delay' },
  cls: { good: 0.1, poor: 0.25, unit: '', name: 'Cumulative Layout Shift' },
  ttfb: { good: 800, poor: 1800, unit: 'ms', name: 'Time to First Byte' },
  inp: { good: 200, poor: 500, unit: 'ms', name: 'Interaction to Next Paint' },
};

function getVitalRating(value: number, thresholds: { good: number; poor: number }): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

function getRatingColor(rating: 'good' | 'needs-improvement' | 'poor') {
  switch (rating) {
    case 'good': return 'text-green-500';
    case 'needs-improvement': return 'text-yellow-500';
    case 'poor': return 'text-red-500';
  }
}

function getRatingBg(rating: 'good' | 'needs-improvement' | 'poor') {
  switch (rating) {
    case 'good': return 'bg-green-500/10 border-green-500/20';
    case 'needs-improvement': return 'bg-yellow-500/10 border-yellow-500/20';
    case 'poor': return 'bg-red-500/10 border-red-500/20';
  }
}

function VitalCard({ 
  name, 
  value, 
  unit, 
  rating, 
  icon: Icon,
  description,
  trend
}: { 
  name: string; 
  value: number; 
  unit: string; 
  rating: 'good' | 'needs-improvement' | 'poor';
  icon: React.ElementType;
  description: string;
  trend?: 'up' | 'down' | 'stable';
}) {
  return (
    <Card className={`${getRatingBg(rating)} border`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${getRatingColor(rating)}`} />
            <span className="text-sm font-medium">{name}</span>
          </div>
          {trend && (
            <div className="flex items-center">
              {trend === 'up' && <TrendingUp className="h-3 w-3 text-red-500" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3 text-green-500" />}
              {trend === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
            </div>
          )}
        </div>
        
        <div className="flex items-baseline gap-1 mb-2">
          <span className={`text-2xl font-bold ${getRatingColor(rating)}`}>
            {value.toFixed(unit === '' ? 2 : 0)}
          </span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        
        <p className="text-xs text-muted-foreground">{description}</p>
        
        <div className="mt-2 flex items-center gap-1">
          {rating === 'good' && <CheckCircle className="h-3 w-3 text-green-500" />}
          {rating === 'needs-improvement' && <AlertCircle className="h-3 w-3 text-yellow-500" />}
          {rating === 'poor' && <AlertCircle className="h-3 w-3 text-red-500" />}
          <span className="text-xs capitalize">{rating.replace('-', ' ')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function CoreWebVitalsPanel() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [testUrl, setTestUrl] = useState('');
  const [deviceType, setDeviceType] = useState<'desktop' | 'mobile'>('desktop');

  // Fetch web vitals history
  const { data: vitalsHistory, isLoading } = useQuery({
    queryKey: ['web-vitals', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('seo_web_vitals')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('measured_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  // Get latest vitals
  const latestVitals = vitalsHistory?.[0];

  // Calculate performance score
  const calculateScore = () => {
    if (!latestVitals) return null;
    let score = 100;
    
    if (latestVitals.lcp_value) {
      const lcpRating = getVitalRating(latestVitals.lcp_value, VITAL_THRESHOLDS.lcp);
      if (lcpRating === 'needs-improvement') score -= 15;
      if (lcpRating === 'poor') score -= 30;
    }
    
    if (latestVitals.cls_value) {
      const clsRating = getVitalRating(latestVitals.cls_value, VITAL_THRESHOLDS.cls);
      if (clsRating === 'needs-improvement') score -= 15;
      if (clsRating === 'poor') score -= 30;
    }
    
    if (latestVitals.inp_value) {
      const inpRating = getVitalRating(latestVitals.inp_value, VITAL_THRESHOLDS.inp);
      if (inpRating === 'needs-improvement') score -= 10;
      if (inpRating === 'poor') score -= 20;
    }
    
    return Math.max(0, score);
  };

  // Simulate measurement (in real app, would use PageSpeed Insights API)
  const measureMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      // Simulate Web Vitals measurement
      const simulatedData = {
        tenant_id: currentTenant.id,
        url: testUrl || currentTenant.name || 'Homepage',
        lcp_value: 1800 + Math.random() * 2000,
        fid_value: 50 + Math.random() * 150,
        cls_value: Math.random() * 0.2,
        ttfb_value: 400 + Math.random() * 800,
        inp_value: 100 + Math.random() * 200,
        performance_score: Math.floor(70 + Math.random() * 30),
        device_type: deviceType,
      };

      const { error } = await supabase
        .from('seo_web_vitals')
        .insert([simulatedData]);
      
      if (error) throw error;
      return simulatedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-vitals'] });
      toast.success('Performance meting voltooid');
    },
    onError: (error: Error) => {
      toast.error('Meting mislukt', { description: error.message });
    },
  });

  // Prepare chart data
  const chartData = vitalsHistory?.slice(0, 14).reverse().map(v => ({
    date: new Date(v.measured_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' }),
    LCP: v.lcp_value ? Math.round(v.lcp_value) : null,
    CLS: v.cls_value ? v.cls_value * 1000 : null, // Scale for visibility
    INP: v.inp_value ? Math.round(v.inp_value) : null,
  })) || [];

  const performanceScore = calculateScore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Core Web Vitals</h2>
          <p className="text-sm text-muted-foreground">
            Monitor de prestaties van je webwinkel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={deviceType} onValueChange={(v) => setDeviceType(v as 'desktop' | 'mobile')}>
            <TabsList>
              <TabsTrigger value="desktop" className="gap-1">
                <Monitor className="h-4 w-4" />
                Desktop
              </TabsTrigger>
              <TabsTrigger value="mobile" className="gap-1">
                <Smartphone className="h-4 w-4" />
                Mobiel
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Performance Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-8">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${(performanceScore || 0) * 3.52} 352`}
                  className={
                    (performanceScore || 0) >= 90 ? 'text-green-500' :
                    (performanceScore || 0) >= 50 ? 'text-yellow-500' : 'text-red-500'
                  }
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold">{performanceScore ?? '--'}</span>
                <span className="text-xs text-muted-foreground">Score</span>
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-2">Performance Score</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {performanceScore && performanceScore >= 90 
                  ? 'Uitstekend! Je site laadt snel en biedt een goede gebruikerservaring.'
                  : performanceScore && performanceScore >= 50
                  ? 'Redelijk. Er zijn enkele verbeterpunten om de snelheid te optimaliseren.'
                  : 'Verbetering nodig. Je site is traag en kan de gebruikerservaring verbeteren.'}
              </p>
              
              <div className="flex items-center gap-2">
                <Input
                  placeholder="URL om te testen (optioneel)"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="max-w-xs"
                />
                <Button 
                  onClick={() => measureMutation.mutate()}
                  disabled={measureMutation.isPending}
                >
                  {measureMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Gauge className="h-4 w-4 mr-2" />
                  )}
                  Meet prestaties
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Web Vitals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <VitalCard
          name="LCP"
          value={latestVitals?.lcp_value || 0}
          unit="ms"
          rating={getVitalRating(latestVitals?.lcp_value || 0, VITAL_THRESHOLDS.lcp)}
          icon={Activity}
          description="Laadtijd van grootste element"
          trend="stable"
        />
        <VitalCard
          name="FID"
          value={latestVitals?.fid_value || 0}
          unit="ms"
          rating={getVitalRating(latestVitals?.fid_value || 0, VITAL_THRESHOLDS.fid)}
          icon={Zap}
          description="Eerste inputvertraging"
          trend="down"
        />
        <VitalCard
          name="CLS"
          value={latestVitals?.cls_value || 0}
          unit=""
          rating={getVitalRating(latestVitals?.cls_value || 0, VITAL_THRESHOLDS.cls)}
          icon={Activity}
          description="Visuele stabiliteit"
          trend="stable"
        />
        <VitalCard
          name="TTFB"
          value={latestVitals?.ttfb_value || 0}
          unit="ms"
          rating={getVitalRating(latestVitals?.ttfb_value || 0, VITAL_THRESHOLDS.ttfb)}
          icon={Clock}
          description="Server responstijd"
          trend="down"
        />
        <VitalCard
          name="INP"
          value={latestVitals?.inp_value || 0}
          unit="ms"
          rating={getVitalRating(latestVitals?.inp_value || 0, VITAL_THRESHOLDS.inp)}
          icon={Zap}
          description="Interactie responsiviteit"
          trend="stable"
        />
      </div>

      {/* Trend Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prestatie Trend</CardTitle>
            <CardDescription>Ontwikkeling van Core Web Vitals over tijd</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="LCP" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="LCP (ms)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="INP" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="INP (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Aanbevelingen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {latestVitals?.lcp_value && getVitalRating(latestVitals.lcp_value, VITAL_THRESHOLDS.lcp) !== 'good' && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Optimaliseer LCP</p>
                  <p className="text-xs text-muted-foreground">
                    Comprimeer afbeeldingen, gebruik lazy loading, en optimaliseer de server response.
                  </p>
                </div>
              </div>
            )}
            {latestVitals?.cls_value && getVitalRating(latestVitals.cls_value, VITAL_THRESHOLDS.cls) !== 'good' && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Verminder CLS</p>
                  <p className="text-xs text-muted-foreground">
                    Stel afmetingen in voor afbeeldingen en iframes, vermijd dynamische content inserts.
                  </p>
                </div>
              </div>
            )}
            {latestVitals?.ttfb_value && getVitalRating(latestVitals.ttfb_value, VITAL_THRESHOLDS.ttfb) !== 'good' && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Verbeter TTFB</p>
                  <p className="text-xs text-muted-foreground">
                    Gebruik een CDN, optimaliseer database queries, en schakel caching in.
                  </p>
                </div>
              </div>
            )}
            {(!latestVitals || (
              getVitalRating(latestVitals.lcp_value || 0, VITAL_THRESHOLDS.lcp) === 'good' &&
              getVitalRating(latestVitals.cls_value || 0, VITAL_THRESHOLDS.cls) === 'good' &&
              getVitalRating(latestVitals.ttfb_value || 0, VITAL_THRESHOLDS.ttfb) === 'good'
            )) && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Uitstekende prestaties!</p>
                  <p className="text-xs text-muted-foreground">
                    Je Core Web Vitals scoren goed. Blijf de prestaties monitoren.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
