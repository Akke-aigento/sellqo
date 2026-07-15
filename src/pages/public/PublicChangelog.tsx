import { useState } from 'react';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sparkles, Bug, Zap, Shield, ChevronDown, ChevronUp, Link as LinkIcon, Mail } from 'lucide-react';
import { toast } from 'sonner';

const changelogEntries = [
  {
    version: '2026.07c',
    date: 'Juli 2026',
    changes: [
      { type: 'feature', title: 'Odoo boekhoudkoppeling', description: 'Per-tenant koppeling met je eigen Odoo: facturen en creditnota\'s worden automatisch in je verkoopdagboek geboekt, inclusief automatische Peppol-verzending via Odoo voor B2B-klanten.' },
    ],
  },
  {
    version: '2026.07b',
    date: 'Juli 2026',
    changes: [
      { type: 'improvement', title: 'Peppol-statussen gestroomlijnd', description: 'Één duidelijke Peppol-status per factuur en creditnota, met een filter op openstaande Peppol-acties in het factuuroverzicht.' },
    ],
  },
  {
    version: '2026.07a',
    date: 'Juli 2026',
    changes: [
      { type: 'feature', title: 'Facturatie & SEPA', description: 'Native facturatie met SEPA-domiciliëring, automatische aanmaningen (dunning) en creditnota\'s voor terugkerende abonnementen.' },
    ],
  },
  {
    version: '2025.q1',
    date: 'Q1 2025',
    changes: [
      { type: 'feature', title: 'Shop Health Score', description: 'Real-time gezondheidsmonitor voor je webshop op 6 gebieden.' },
      { type: 'feature', title: 'Visual Webshop Editor', description: 'Drag & drop builder voor je storefront pagina\'s zonder code te schrijven.' },
      { type: 'feature', title: 'AI Business Coach', description: 'Proactieve suggesties gebaseerd op shop analytics.' },
      { type: 'feature', title: 'WhatsApp unified inbox', description: 'Klantcommunicatie via WhatsApp geïntegreerd in de unified inbox.' },
    ],
  },
  {
    version: '2024.q4',
    date: 'Q4 2024',
    changes: [
      { type: 'feature', title: 'Bol.com VVB Labels', description: 'Fulfilled by Bol verzendlabels direct printen vanuit SellQo.' },
      { type: 'feature', title: 'POS Kassasysteem', description: 'Verkoop fysiek met touch-interface en barcode scanner — perfect voor pop-up shops en winkels.' },
    ],
  },
];

const typeStyles = {
  feature: { icon: Sparkles, label: 'Nieuw', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  improvement: { icon: Zap, label: 'Verbeterd', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  bugfix: { icon: Bug, label: 'Bugfix', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  security: { icon: Shield, label: 'Security', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
};

const filterTypes = [
  { id: 'all', label: 'Alles' },
  { id: 'feature', label: 'Features' },
  { id: 'improvement', label: 'Verbeteringen' },
  { id: 'bugfix', label: 'Bugfixes' },
  { id: 'security', label: 'Security' },
];

export default function PublicChangelog() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedVersions, setExpandedVersions] = useState<string[]>([changelogEntries[0].version]);
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const toggleVersion = (version: string) => {
    setExpandedVersions(prev => 
      prev.includes(version) 
        ? prev.filter(v => v !== version)
        : [...prev, version]
    );
  };

  const copyLink = (version: string) => {
    const url = `${window.location.origin}/changelog#v${version}`;
    navigator.clipboard.writeText(url);
    toast.success('Link gekopieerd!');
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubscribing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('Je ontvangt nu changelog updates per email!');
    setEmail('');
    setIsSubscribing(false);
  };

  // Filter entries
  const filteredEntries = changelogEntries.map(entry => ({
    ...entry,
    changes: activeFilter === 'all' 
      ? entry.changes 
      : entry.changes.filter(c => c.type === activeFilter)
  })).filter(entry => entry.changes.length > 0);

  return (
    <PublicPageLayout 
      title="Changelog" 
      subtitle="Alle updates en verbeteringen aan SellQo"
    >
      {/* Filters */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex flex-wrap justify-center gap-2">
          {filterTypes.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === filter.id
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {filteredEntries.map((entry, index) => {
          const isExpanded = expandedVersions.includes(entry.version);
          
          return (
            <div 
              key={index} 
              id={`v${entry.version}`}
              className="mb-8 relative scroll-mt-24"
            >
              {/* Timeline line */}
              {index < filteredEntries.length - 1 && (
                <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-border" />
              )}
              
              {/* Version header */}
              <button
                onClick={() => toggleVersion(entry.version)}
                className="flex items-center gap-4 mb-4 w-full text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm z-10">
                  {entry.version.split('.')[1]}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                      Versie {entry.version}
                    </h2>
                    <p className="text-sm text-muted-foreground">{entry.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLink(entry.version);
                      }}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                      title="Kopieer link"
                    >
                      <LinkIcon className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>

              {/* Changes */}
              {isExpanded && (
                <div className="ml-12 space-y-3 animate-fade-in">
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
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{change.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{change.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Collapsed summary */}
              {!isExpanded && (
                <div className="ml-12 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{entry.changes.length} updates</span>
                  <span>•</span>
                  <div className="flex gap-1">
                    {Array.from(new Set(entry.changes.map(c => c.type))).map(type => {
                      const style = typeStyles[type as keyof typeof typeStyles];
                      return (
                        <Badge key={type} variant="outline" className={`${style.className} text-xs px-1.5 py-0`}>
                          {style.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Newsletter Subscribe */}
        <div className="mt-16 pt-8 border-t border-border">
          <div className="bg-card rounded-2xl border border-border p-6 text-center">
            <Mail className="w-10 h-10 text-accent mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">
              Blijf op de hoogte van updates
            </h2>
            <p className="text-muted-foreground mb-6">
              Ontvang changelogs en product updates rechtstreeks in je inbox.
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
                {isSubscribing ? 'Bezig...' : 'Inschrijven'}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-4">
              Alleen relevante updates, geen spam. Je kunt je altijd uitschrijven.
            </p>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
