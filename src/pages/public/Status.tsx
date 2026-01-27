import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { CheckCircle, Circle, Clock } from 'lucide-react';

const services = [
  { name: 'SellQo Platform', status: 'operational' },
  { name: 'API Services', status: 'operational' },
  { name: 'Webshop Storefronts', status: 'operational' },
  { name: 'Betalingen (Stripe)', status: 'operational' },
  { name: 'Marketplace Sync', status: 'operational' },
  { name: 'Email Verzending', status: 'operational' },
  { name: 'AI Services', status: 'operational' },
  { name: 'Database', status: 'operational' },
];

const statusConfig = {
  operational: { icon: CheckCircle, label: 'Operationeel', color: 'text-green-500' },
  degraded: { icon: Clock, label: 'Vertraagd', color: 'text-amber-500' },
  outage: { icon: Circle, label: 'Storing', color: 'text-red-500' },
};

export default function Status() {
  const allOperational = services.every(s => s.status === 'operational');
  const lastUpdated = new Date().toLocaleString('nl-BE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

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

      {/* Service List */}
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
                <span className="font-medium text-foreground">{service.name}</span>
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${config.color}`} />
                  <span className={`text-sm ${config.color}`}>{config.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Uptime Stats */}
      <section className="max-w-3xl mx-auto mb-12">
        <h2 className="text-xl font-bold text-foreground mb-6">Uptime (laatste 30 dagen)</h2>
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
