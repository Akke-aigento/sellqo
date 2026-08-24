import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalytics } from '@/hooks/useAnalytics';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS: Record<string, string> = {
  pending: '#fbbf24',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#22c55e',
  cancelled: '#ef4444',
  returned: '#f97316',
  refunded: '#a855f7',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'In afwachting',
  processing: 'In behandeling',
  shipped: 'Verzonden',
  delivered: 'Afgeleverd',
  cancelled: 'Geannuleerd',
  returned: 'Geretourneerd',
  refunded: 'Terugbetaald',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  format = 'number',
}: {
  title: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  format?: 'number' | 'currency' | 'percent';
}) {
  const formattedValue = format === 'currency' 
    ? formatCurrency(value)
    : format === 'percent'
    ? `${value.toFixed(1)}%`
    : value.toLocaleString('nl-NL');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        {change !== undefined && (
          <p className={`text-xs flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change).toFixed(1)}% t.o.v. vorige periode
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<number>(30);
  const { summary, dailyStats, orderStatus, topProducts, isLoading } = useAnalytics(period);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('admin.analytics.analytics')}</h1>
          <p className="text-muted-foreground">
            {t('admin.analytics.inzicht_in_je_winkelstatistieken')}
          </p>
        </div>
        <Tabs value={period.toString()} onValueChange={(v) => setPeriod(parseInt(v))}>
          <TabsList>
            <TabsTrigger value="7">{t('admin.marketing.7_dagen')}</TabsTrigger>
            <TabsTrigger value="30">{t('admin.marketing.30_dagen')}</TabsTrigger>
            <TabsTrigger value="90">{t('admin.marketing.90_dagen')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('admin.analytics.totale_omzet')}
          value={summary?.totalRevenue ?? 0}
          change={summary?.revenueChange}
          icon={DollarSign}
          format="currency"
        />
        <StatCard
          title={t('admin.customers.bestellingen')}
          value={summary?.totalOrders ?? 0}
          change={summary?.ordersChange}
          icon={ShoppingCart}
        />
        <StatCard
          title={t('admin.analytics.nieuwe_klanten')}
          value={summary?.totalCustomers ?? 0}
          change={summary?.customersChange}
          icon={Users}
        />
        <StatCard
          title={t('admin.analytics.gem_orderwaarde')}
          value={summary?.averageOrderValue ?? 0}
          icon={Package}
          format="currency"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>{t('admin.analytics.omzet_over_tijd')}</CardTitle>
            <CardDescription>{t('admin.analytics.dagelijkse_omzet_in_de_geselecteerde_periode')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `€${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Omzet']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Orders Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>{t('admin.analytics.bestellingen_over_tijd')}</CardTitle>
            <CardDescription>{t('admin.analytics.aantal_bestellingen_per_dag')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Bestellingen']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="orders" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Order Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.analytics.bestellingen_per_status')}</CardTitle>
            <CardDescription>{t('admin.analytics.verdeling_van_orderstatus')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {orderStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                    >
                      {orderStatus.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={STATUS_COLORS[entry.status] || '#94a3b8'} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [value, STATUS_LABELS[name] || name]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend 
                      formatter={(value) => STATUS_LABELS[value] || value}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('admin.customerDetail.geen_bestellingen_gevonden')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.analytics.top_producten')}</CardTitle>
            <CardDescription>{t('admin.analytics.best_verkopende_producten_op_basis_van')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `€${value}`}
                    />
                    <YAxis 
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={170}
                      tickFormatter={(value: string) =>
                        value && value.length > 28 ? `${value.slice(0, 28)}…` : value
                      }
                    />
                    <Tooltip 
                      formatter={(value: number, _name, item) => {
                        const qty = (item?.payload as { quantity?: number } | undefined)?.quantity;
                        return [
                          `${formatCurrency(value)}${qty !== undefined ? ` — ${qty} stuks` : ''}`,
                          'Omzet',
                        ];
                      }}
                      labelFormatter={(label: string) => label}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar 
                      dataKey="revenue" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('admin.analytics.geen_verkoopdata_gevonden')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Growth */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.analytics.klantgroei')}</CardTitle>
          <CardDescription>{t('admin.analytics.nieuwe_klanten_en_subscribers_per_dag')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats}>
                <defs>
                  <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSubscribers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="customers"
                  name="Nieuwe klanten"
                  stroke="#22c55e"
                  fillOpacity={1}
                  fill="url(#colorCustomers)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="subscribers"
                  name="Subscribers"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorSubscribers)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
