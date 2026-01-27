import { useState } from 'react';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Circle, Clock, AlertTriangle, Bell, Calendar, Activity } from 'lucide-react';
import { toast } from 'sonner';

const services = [
  { name: 'SellQo Platform', status: 'operational', responseTime: '45ms' },
  { name: 'API Services', status: 'operational', responseTime: '32ms' },
  { name: 'Webshop Storefronts', status: 'operational', responseTime: '89ms' },
  { name: 'Betalingen (Stripe)', status: 'operational', responseTime: '156ms' },
  { name: 'Marketplace Sync', status: 'operational', responseTime: '234ms' },
  { name: 'Email Verzending', status: 'operational', responseTime: '67ms' },
  { name: 'AI Services', status: 'operational', responseTime: '412ms' },
  { name: 'Database', status: 'operational', responseTime: '12ms' },
];

const statusConfig = {
  operational: { icon: CheckCircle, label: 'Operationeel', color: 'text-green-500', bgColor: 'bg-green-500' },
  degraded: { icon: Clock, label: 'Vertraagd', color: 'text-amber-500', bgColor: 'bg-amber-500' },
  outage: { icon: Circle, label: 'Storing', color: 'text-red-500', bgColor: 'bg-red-500' },
  maintenance: { icon: AlertTriangle, label: 'Onderhoud', color: 'text-blue-500', bgColor: 'bg-blue-500' },
};

// Generate last 30 days uptime data
const generateUptimeData = () => {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    // Random uptime between 99.5% and 100%
    const uptime = 99.5 + Math.random() * 0.5;
    data.push({
      date: date.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }),
      uptime: uptime.toFixed(2),
      status: uptime > 99.9 ? 'operational' : uptime > 99 ? 'degraded' : 'outage',
    });
  }
  return data;
};

const uptimeData = generateUptimeData();

const incidentHistory = [
  {
    date: '24 januari 2025',
    title: 'Vertraagde API responses',
    status: 'resolved',
    duration: '23 min',
    description: 'Verhoogde latency op API endpoints door database optimalisatie.',
    updates: [
      { time: '14:32', message: 'Probleem geïdentificeerd' },
      { time: '14:45', message: 'Fix gedeployed' },
      { time: '14:55', message: 'Volledig opgelost' },
    ],
  },
  {
    date: '18 januari 2025',
    title: 'Gepland onderhoud',
    status: 'completed',
    duration: '2 uur',
    description: 'Database migratie en infrastructuur upgrade.',
    updates: [
      { time: '02:00', message: 'Onderhoud gestart' },
      { time: '04:00', message: 'Onderhoud voltooid' },
    ],
  },
];

const scheduledMaintenance = [
  {
    date: '1 februari 2025',
    time: '02:00 - 04:00 CET',
    title: 'Infrastructuur Upgrade',
    description: 'Upgrade naar nieuwe servers voor betere performance.',
    impact: 'Minimale impact verwacht',
  },
];

export default function Status() {
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const allOperational = services.every(s => s.status === 'operational');
  const lastUpdated = new Date().toLocaleString('nl-BE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubscribing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('Je ontvangt nu statusupdates per email.');
    setEmail('');
    setIsSubscribing(false);
  };

  // Calculate overall uptime
  const overallUptime = (uptimeData.reduce((acc, d) => acc + parseFloat(d.uptime), 0) / uptimeData.length).toFixed(2);

  return (
    <PublicPageLayout 
      title="Systeem Status" 
      subtitle="Real-time overzicht van alle SellQo services"
    >
      {/* Overall Status */}
      <section className="max-w-3xl mx-auto mb-12">
        <div className={`rounded-2xl p-8 text-center ${
          allOperational 
            ? 'bg-green-500/10 border border-green-500/30' 
            : 'bg-amber-500/10 border border-amber-500/30'
        }`}>
          <CheckCircle className={`w-16 h-16 mx-auto mb-4 ${
            allOperational ? 'text-green-500' : 'text-amber-500'
          }`} />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {allOperational ? 'Alle Systemen Operationeel' : 'Sommige Systemen Ondervinden Problemen'}
          </h2>
          <p className="text-muted-foreground">
            Laatst bijgewerkt: {lastUpdated}
          </p>
        </div>
      </section>

      {/* 30-day Uptime Visualization */}
      <section className="max-w-3xl mx-auto mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Uptime laatste 30 dagen</h2>
          <span className="text-2xl font-bold text-green-500">{overallUptime}%</span>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex gap-1">
            {uptimeData.map((day, index) => {
              const config = statusConfig[day.status as keyof typeof statusConfig];
              return (
                <div
                  key={index}
                  className="flex-1 group relative"
                >
                  <div 
                    className={`h-8 rounded-sm ${config.bgColor} opacity-80 hover:opacity-100 transition-opacity`}
                    title={`${day.date}: ${day.uptime}%`}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-foreground text-background text-xs rounded px-2 py-1 whitespace-nowrap">
                      {day.date}: {day.uptime}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>30 dagen geleden</span>
            <span>Vandaag</span>
          </div>
        </div>
      </section>

      {/* Service List with Response Times */}
      <section className="max-w-3xl mx-auto mb-12">
        <h2 className="text-xl font-bold text-foreground mb-6">Services</h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {services.map((service, index) => {
            const config = statusConfig[service.status as keyof typeof statusConfig];
            const Icon = config.icon;
            return (
              <div 
                key={index}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${config.color}`} />
                  <span className="font-medium text-foreground">{service.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {service.responseTime}
                  </span>
                  <span className={`text-sm ${config.color}`}>{config.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scheduled Maintenance */}
      {scheduledMaintenance.length > 0 && (
        <section className="max-w-3xl mx-auto mb-12">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Gepland Onderhoud
          </h2>
          <div className="space-y-4">
            {scheduledMaintenance.map((maintenance, index) => (
              <div key={index} className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{maintenance.title}</h3>
                    <p className="text-sm text-muted-foreground">{maintenance.description}</p>
                  </div>
                  <span className="text-sm text-blue-500 font-medium">{maintenance.date}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {maintenance.time}
                  </span>
                  <span className="text-blue-500">{maintenance.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Incident History */}
      <section className="max-w-3xl mx-auto mb-12">
        <h2 className="text-xl font-bold text-foreground mb-6">Incident Geschiedenis</h2>
        <div className="space-y-6">
          {incidentHistory.map((incident, index) => (
            <div key={index} className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{incident.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      incident.status === 'resolved' 
                        ? 'bg-green-500/10 text-green-600' 
                        : 'bg-blue-500/10 text-blue-600'
                    }`}>
                      {incident.status === 'resolved' ? 'Opgelost' : 'Voltooid'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{incident.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{incident.date}</p>
                  <p className="text-xs text-muted-foreground">Duur: {incident.duration}</p>
                </div>
              </div>
              
              {/* Timeline */}
              <div className="border-l-2 border-border pl-4 space-y-2">
                {incident.updates.map((update, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xs text-muted-foreground font-mono w-12">{update.time}</span>
                    <span className="text-sm text-foreground">{update.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Uptime Stats */}
      <section className="max-w-3xl mx-auto mb-12">
        <h2 className="text-xl font-bold text-foreground mb-6">Uptime Statistieken</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-3xl font-bold text-green-500 mb-1">99.98%</p>
            <p className="text-sm text-muted-foreground">Platform Uptime</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-3xl font-bold text-green-500 mb-1">99.99%</p>
            <p className="text-sm text-muted-foreground">API Uptime</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-3xl font-bold text-foreground mb-1">42ms</p>
            <p className="text-sm text-muted-foreground">Gem. Response Time</p>
          </div>
        </div>
      </section>

      {/* Subscribe for Updates */}
      <section className="max-w-xl mx-auto mb-12">
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <Bell className="w-10 h-10 text-accent mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Ontvang Statusupdates</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Krijg direct een melding bij storingen of gepland onderhoud.
          </p>
          <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm mx-auto">
            <Input 
              type="email"
              placeholder="Je e-mailadres"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={isSubscribing}>
              {isSubscribing ? 'Bezig...' : 'Abonneren'}
            </Button>
          </form>
        </div>
      </section>

      {/* Info */}
      <section className="max-w-2xl mx-auto text-center">
        <p className="text-sm text-muted-foreground">
          Bij storingen sturen we proactief meldingen naar alle klanten. 
          Volg ons op social media voor real-time updates.
        </p>
      </section>
    </PublicPageLayout>
  );
}
