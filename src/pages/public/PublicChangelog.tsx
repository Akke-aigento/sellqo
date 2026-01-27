import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Bug, Zap, Shield } from 'lucide-react';

const changelogEntries = [
  {
    version: '1.5.0',
    date: '27 januari 2025',
    changes: [
      { type: 'feature', title: '14-dagen Trial Systeem', description: 'Automatische trial bij registratie met subscription tracking.' },
      { type: 'feature', title: 'Shop Health Score', description: 'Real-time gezondheidsmonitor voor je webshop op 6 gebieden.' },
      { type: 'feature', title: '7-stappen Onboarding', description: 'Verbeterde wizard inclusief plan selectie en guided setup.' },
      { type: 'improvement', title: 'Trial Banner', description: 'Countdown banner in dashboard met upgrade prompts.' },
    ],
  },
  {
    version: '1.4.0',
    date: '20 januari 2025',
    changes: [
      { type: 'feature', title: 'Visual Webshop Editor', description: 'Drag & drop builder voor je storefront pagina\'s.' },
      { type: 'feature', title: 'AI Business Coach', description: 'Proactieve suggesties gebaseerd op shop analytics.' },
      { type: 'improvement', title: 'Performance Verbeteringen', description: 'Snellere laadtijden voor grote productcatalogi.' },
    ],
  },
  {
    version: '1.3.0',
    date: '10 januari 2025',
    changes: [
      { type: 'feature', title: 'Bol.com VVB Labels', description: 'Fulfilled by Bol verzendlabels direct printen.' },
      { type: 'feature', title: 'WhatsApp Business Integratie', description: 'Klantcommunicatie via WhatsApp in unified inbox.' },
      { type: 'security', title: 'Verbeterde RLS Policies', description: 'Strengere data-isolatie tussen tenants.' },
    ],
  },
  {
    version: '1.2.0',
    date: '3 januari 2025',
    changes: [
      { type: 'feature', title: 'POS Kassasysteem', description: 'Verkoop fysiek met touch-interface en barcode scanner.' },
      { type: 'feature', title: 'Peppol E-Invoicing', description: 'B2B-compliant elektronische facturatie.' },
      { type: 'bugfix', title: 'Voorraad Sync Fix', description: 'Opgelost: voorraadaantallen synchroniseerden niet correct met Bol.com.' },
    ],
  },
];

const typeStyles = {
  feature: { icon: Sparkles, label: 'Nieuw', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  improvement: { icon: Zap, label: 'Verbeterd', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  bugfix: { icon: Bug, label: 'Bugfix', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  security: { icon: Shield, label: 'Security', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
};

export default function PublicChangelog() {
  return (
    <PublicPageLayout 
      title="Changelog" 
      subtitle="Alle updates en verbeteringen aan SellQo"
    >
      <div className="max-w-3xl mx-auto">
        {changelogEntries.map((entry, index) => (
          <div key={index} className="mb-12 relative">
            {/* Timeline line */}
            {index < changelogEntries.length - 1 && (
              <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-border" />
            )}
            
            {/* Version header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm z-10">
                {entry.version.split('.')[1]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Versie {entry.version}</h2>
                <p className="text-sm text-muted-foreground">{entry.date}</p>
              </div>
            </div>

            {/* Changes */}
            <div className="ml-12 space-y-4">
              {entry.changes.map((change, i) => {
                const style = typeStyles[change.type as keyof typeof typeStyles];
                const Icon = style.icon;
                return (
                  <div key={i} className="bg-card rounded-lg border border-border p-4">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className={style.className}>
                        <Icon className="w-3 h-3 mr-1" />
                        {style.label}
                      </Badge>
                      <div>
                        <h3 className="font-medium text-foreground">{change.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{change.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Subscribe */}
        <div className="text-center mt-16 pt-8 border-t border-border">
          <p className="text-muted-foreground mb-4">
            Wil je op de hoogte blijven van nieuwe features?
          </p>
          <p className="text-sm text-muted-foreground">
            Volg ons op social media of schrijf je in voor onze nieuwsbrief.
          </p>
        </div>
      </div>
    </PublicPageLayout>
  );
}
