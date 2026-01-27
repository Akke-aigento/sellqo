import { Euro, ShoppingBag, Users, TrendingUp, Package, Heart, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const statsData = [
  { label: 'Omzet Vandaag', value: '€12.453', change: '+18.2%', icon: Euro, positive: true },
  { label: 'Bestellingen', value: '847', change: '+12%', icon: ShoppingBag, positive: true },
  { label: 'Nieuwe Klanten', value: '234', change: '+8%', icon: Users, positive: true },
  { label: 'Health Score', value: '92%', change: '+4%', icon: Heart, positive: true },
];

const recentOrders = [
  { id: '#1234', customer: 'Jan de Vries', amount: '€149,99', status: 'shipped' as const },
  { id: '#1233', customer: 'Lisa Bakker', amount: '€89,50', status: 'paid' as const },
  { id: '#1232', customer: 'Peter Jansen', amount: '€245,00', status: 'processing' as const },
];

const topProducts = [
  { name: 'Premium Headphones', sold: 234, revenue: '€5.850', progress: 85 },
  { name: 'Wireless Charger', sold: 189, revenue: '€2.835', progress: 65 },
  { name: 'Phone Case Pro', sold: 156, revenue: '€1.560', progress: 50 },
];

const statusStyles = {
  shipped: { label: 'Verzonden', bg: 'bg-green-500/10', text: 'text-green-600', dot: 'bg-green-500' },
  paid: { label: 'Betaald', bg: 'bg-blue-500/10', text: 'text-blue-600', dot: 'bg-blue-500' },
  processing: { label: 'In behandeling', bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500' },
};

export function HeroDashboardMockup() {
  return (
    <div className="relative bg-card rounded-2xl shadow-2xl border border-border overflow-hidden max-w-2xl mx-auto">
      {/* Desktop Mini-Sidebar - only visible on lg screens */}
      <div className="hidden lg:flex absolute left-0 top-0 bottom-0 w-12 bg-secondary/30 border-r border-border flex-col items-center py-4 gap-3 z-10">
        <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
          <Euro className="w-3 h-3 text-primary" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
          <ShoppingBag className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
          <Package className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
          <Heart className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
      {/* Browser Chrome Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-background/80 rounded-md px-3 py-1.5 text-xs text-muted-foreground text-center max-w-[200px] mx-auto">
            sellqo.app/dashboard
          </div>
        </div>
        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
          <span className="text-[10px] font-semibold text-accent">JD</span>
        </div>
      </div>

      {/* Dashboard Content - offset for sidebar on desktop */}
      <div className="p-4 space-y-4 lg:pl-16">
        {/* Trial Banner */}
        <div className="bg-gradient-to-r from-accent/20 via-accent/10 to-primary/10 rounded-xl p-3 border border-accent/30 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <span className="text-xs font-medium text-foreground">
                Je hebt nog <span className="font-bold text-accent">14 dagen</span> gratis trial
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-accent to-primary rounded-full" />
              </div>
              <span className="text-[10px] text-accent font-medium">100%</span>
            </div>
          </div>
        </div>

        {/* Health Score Badge */}
        <div className="flex items-center justify-between animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Shop Health Score</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">92%</span>
                <span className="text-[10px] text-green-600 font-medium">🟢 Uitstekend</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">3 verbeterpunten</p>
            <p className="text-xs text-accent font-medium">Bekijk tips →</p>
          </div>
        </div>

        {/* Stat Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statsData.map((stat, index) => (
            <div
              key={index}
              className="bg-background rounded-xl p-3 border border-border/50 animate-fade-in"
              style={{ animationDelay: `${0.2 + index * 0.1}s` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </span>
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-3 h-3 text-primary" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-foreground">{stat.value}</span>
                <span className={cn(
                  'text-[10px] font-medium flex items-center gap-0.5',
                  stat.positive ? 'text-green-600' : 'text-red-600'
                )}>
                  <TrendingUp className="w-2 h-2" />
                  {stat.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-3">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-background rounded-xl p-4 border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-foreground">Omzet Deze Week</h4>
              <span className="text-[10px] text-muted-foreground">7 dagen</span>
            </div>
            <div className="h-24 relative">
              <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="xMidYMid meet">
                {/* Gradient fill under line */}
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                <path
                  d="M0,45 C25,40 45,25 70,30 C95,35 115,15 140,20 C165,25 185,8 200,5 L200,60 L0,60 Z"
                  fill="url(#chartGradient)"
                  className="animate-fade-in"
                />
                {/* Line */}
                <path
                  d="M0,45 C25,40 45,25 70,30 C95,35 115,15 140,20 C165,25 185,8 200,5"
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="chart-line"
                />
                {/* Dots on data points */}
                {[
                  { x: 0, y: 45 },
                  { x: 33, y: 32 },
                  { x: 66, y: 30 },
                  { x: 100, y: 25 },
                  { x: 133, y: 20 },
                  { x: 166, y: 15 },
                  { x: 200, y: 5 },
                ].map((point, i) => (
                  <circle
                    key={i}
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill="hsl(var(--background))"
                    stroke="hsl(var(--accent))"
                    strokeWidth="2"
                    className="animate-fade-in"
                    style={{ animationDelay: `${0.5 + i * 0.1}s` }}
                  />
                ))}
              </svg>
              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[8px] text-muted-foreground pt-1">
                <span>Ma</span>
                <span>Di</span>
                <span>Wo</span>
                <span>Do</span>
                <span>Vr</span>
                <span>Za</span>
                <span>Zo</span>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-background rounded-xl p-4 border border-border/50">
            <h4 className="text-xs font-semibold text-foreground mb-3">Top Producten</h4>
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={index} className="animate-fade-in" style={{ animationDelay: `${0.3 + index * 0.1}s` }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center">
                        <Package className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] font-medium text-foreground truncate max-w-[80px]">
                        {product.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-foreground">{product.revenue}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-1000"
                      style={{ width: `${product.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Orders Table */}
        <div className="bg-background rounded-xl p-4 border border-border/50">
          <h4 className="text-xs font-semibold text-foreground mb-3">Recente Bestellingen</h4>
          <div className="space-y-2">
            {recentOrders.map((order, index) => {
              const status = statusStyles[order.status];
              return (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 animate-fade-in"
                  style={{ animationDelay: `${0.5 + index * 0.15}s` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-muted-foreground">{order.id}</span>
                    <span className="text-xs font-medium text-foreground">{order.customer}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-foreground">{order.amount}</span>
                    <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full', status.bg)}>
                      <div className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                      <span className={cn('text-[9px] font-medium', status.text)}>{status.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
