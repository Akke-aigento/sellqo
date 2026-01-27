import { Euro, ShoppingBag, Users, TrendingUp, Heart, Clock, Bot, MessageSquare, Mail, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const statsData = [
  { label: 'Omzet Vandaag', value: '€12.453', change: '+18.2%', icon: Euro, positive: true },
  { label: 'Bestellingen', value: '847', change: '+12%', icon: ShoppingBag, positive: true },
  { label: 'Nieuwe Klanten', value: '234', change: '+8%', icon: Users, positive: true },
  { label: 'Health Score', value: '92%', change: '+4%', icon: Heart, positive: true },
];

const aiCoachSuggestion = {
  priority: 'high' as const,
  emoji: '📈',
  message: "Je bestseller 'Premium Headphones' is bijna uitverkocht. Bestel nu bij om €2.340 aan gemiste verkopen te voorkomen.",
  actions: ['Bestel nu', 'Later']
};

const inboxMessages = [
  { 
    name: 'Jan de Vries', 
    channel: 'email' as const, 
    preview: 'Vraag over bezorging van mijn bestelling...', 
    unread: false,
    time: '2 min'
  },
  { 
    name: 'Lisa Bakker', 
    channel: 'whatsapp' as const, 
    preview: 'Hallo, is dit product nog op voorraad?', 
    unread: true,
    time: '5 min'
  },
  { 
    name: 'Bol.com Klant', 
    channel: 'bol' as const, 
    preview: 'Wanneer wordt mijn bestelling verzonden?', 
    unread: true,
    time: '12 min'
  },
];

const channelStyles = {
  email: { icon: Mail, bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Email' },
  whatsapp: { icon: MessageSquare, bg: 'bg-green-500/10', text: 'text-green-500', label: 'WhatsApp' },
  bol: { icon: ShoppingBag, bg: 'bg-orange-500/10', text: 'text-orange-500', label: 'Bol.com' },
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
        <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center hover:bg-accent/30 transition-colors cursor-pointer relative">
          <MessageSquare className="w-3 h-3 text-accent" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
          <Bot className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
          <Heart className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
          <Zap className="w-3 h-3 text-muted-foreground" />
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

          {/* AI Coach Suggestion Card */}
          <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 rounded-xl p-4 border border-primary/20 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-semibold text-foreground">AI Coach</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                ⚠️ Hoog
              </span>
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed mb-3">
              {aiCoachSuggestion.emoji} {aiCoachSuggestion.message}
            </p>
            <div className="flex gap-2">
              <button className="flex-1 text-[10px] font-medium py-1.5 px-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                Bestel nu
              </button>
              <button className="flex-1 text-[10px] font-medium py-1.5 px-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                Later
              </button>
            </div>
          </div>
        </div>

        {/* Unified Inbox Preview */}
        <div className="bg-background rounded-xl p-4 border border-border/50 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-foreground">Klantberichten</h4>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 font-medium">
                2 ongelezen
              </span>
            </div>
            <span className="text-[10px] text-accent font-medium cursor-pointer hover:underline">
              Bekijk alles →
            </span>
          </div>
          <div className="space-y-2">
            {inboxMessages.map((message, index) => {
              const channel = channelStyles[message.channel];
              const ChannelIcon = channel.icon;
              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 py-2 px-2 rounded-lg transition-colors cursor-pointer",
                    message.unread ? "bg-accent/5 hover:bg-accent/10" : "hover:bg-secondary/50"
                  )}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-foreground">
                      {message.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[11px] font-medium",
                        message.unread ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {message.name}
                      </span>
                      <div className={cn("w-4 h-4 rounded flex items-center justify-center", channel.bg)}>
                        <ChannelIcon className={cn("w-2.5 h-2.5", channel.text)} />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {message.preview}
                    </p>
                  </div>

                  {/* Time & Unread */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] text-muted-foreground">{message.time}</span>
                    {message.unread && (
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Activity Indicator */}
        <div className="flex items-center justify-center gap-2 py-2 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping" />
          </div>
          <span className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Live:</span> 5 bezoekers op je shop
          </span>
        </div>
      </div>
    </div>
  );
}
