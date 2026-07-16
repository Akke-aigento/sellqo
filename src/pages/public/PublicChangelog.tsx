import { useState } from 'react';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sparkles, Bug, Zap, Shield, ChevronDown, ChevronUp, Link as LinkIcon, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

// Structural changelog. Titles/descriptions and dates are localized via i18n.
const changelogEntries: Array<{
  version: string;
  dateKey: string;
  changes: Array<{ id: string; type: 'feature' | 'improvement' | 'bugfix' | 'security' }>;
}> = [
  { version: '2026.07i', dateKey: 'jul_2026', changes: [{ id: 'reliable_import', type: 'improvement' }] },
  { version: '2026.07h', dateKey: 'jul_2026', changes: [{ id: 'connect_overview', type: 'improvement' }] },
  { version: '2026.07g', dateKey: 'jul_2026', changes: [{ id: 'accurate_stats', type: 'improvement' }] },
  { version: '2026.07f', dateKey: 'jul_2026', changes: [{ id: 'odoo_draft_mode', type: 'improvement' }] },
  { version: '2026.07e', dateKey: 'jul_2026', changes: [{ id: 'channel_visibility', type: 'feature' }] },
  { version: '2026.07d', dateKey: 'jul_2026', changes: [{ id: 'language_switcher', type: 'improvement' }] },
  { version: '2026.07c', dateKey: 'jul_2026', changes: [{ id: 'odoo_accounting', type: 'feature' }] },
  { version: '2026.07b', dateKey: 'jul_2026', changes: [{ id: 'peppol_status', type: 'improvement' }] },
  { version: '2026.07a', dateKey: 'jul_2026', changes: [{ id: 'billing_sepa', type: 'feature' }] },
  { version: '2025.q1', dateKey: 'q1_2025', changes: [
    { id: 'shop_health', type: 'feature' },
    { id: 'visual_editor', type: 'feature' },
    { id: 'ai_coach', type: 'feature' },
    { id: 'unified_inbox', type: 'feature' },
  ]},
  { version: '2024.q4', dateKey: 'q4_2024', changes: [
    { id: 'bol_vvb', type: 'feature' },
    { id: 'pos', type: 'feature' },
  ]},
];

const typeStyle = {
  feature: { icon: Sparkles, className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  improvement: { icon: Zap, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  bugfix: { icon: Bug, className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  security: { icon: Shield, className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
} as const;

const filterIds = ['all', 'feature', 'improvement', 'bugfix', 'security'] as const;

export default function PublicChangelog() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedVersions, setExpandedVersions] = useState<string[]>([changelogEntries[0].version]);
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const typeLabel = (type: string) => t(`public.changelog.types.${type}`);

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
    toast.success(t('public.changelog.copySuccess'));
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('changelog-subscribe', {
        body: { email: email.trim().toLowerCase() },
      });
      if (error || (data && data.success === false)) {
        throw new Error(error?.message ?? 'subscribe_failed');
      }
      toast.success(t('public.changelog.subscribeSuccess'));
      setEmail('');
    } catch (err) {
      console.error('changelog subscribe error:', err);
      toast.error(t('public.changelog.subscribeError'));
    } finally {
      setIsSubscribing(false);
    }
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
      title={t('public.changelog.title')}
      subtitle={t('public.changelog.subtitle')}
    >
      {/* Filters */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex flex-wrap justify-center gap-2">
          {filterIds.map((filterId) => (
            <button
              key={filterId}
              onClick={() => setActiveFilter(filterId)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === filterId
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`public.changelog.filters.${filterId}`)}
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
                      {t('public.changelog.version', { version: entry.version })}
                    </h2>
                    <p className="text-sm text-muted-foreground">{t(`public.changelog.dates.${entry.dateKey}`)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLink(entry.version);
                      }}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                      title={t('public.changelog.copyLink')}
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
                    const style = typeStyle[change.type];
                    const Icon = style.icon;
                    return (
                      <div key={i} className="bg-card rounded-lg border border-border p-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className={style.className}>
                            <Icon className="w-3 h-3 mr-1" />
                            {typeLabel(change.type)}
                          </Badge>
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{t(`public.changelog.changes.${change.id}.title`)}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{t(`public.changelog.changes.${change.id}.description`)}</p>
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
                  <span>{t('public.changelog.updatesCount', { count: entry.changes.length })}</span>
                  <span>•</span>
                  <div className="flex gap-1">
                    {Array.from(new Set(entry.changes.map(c => c.type))).map(type => {
                      const style = typeStyle[type as keyof typeof typeStyle];
                      return (
                        <Badge key={type} variant="outline" className={`${style.className} text-xs px-1.5 py-0`}>
                          {typeLabel(type)}
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
            <h2 className="text-xl font-bold text-foreground mb-2">{t('public.changelog.subscribeTitle')}</h2>
            <p className="text-muted-foreground mb-6">{t('public.changelog.subscribeText')}</p>
            <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm mx-auto">
              <Input 
                type="email"
                placeholder={t('public.changelog.subscribePlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={isSubscribing}>
                {isSubscribing ? t('public.changelog.subscribeSubmitting') : t('public.changelog.subscribeButton')}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-4">{t('public.changelog.subscribeNote')}</p>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
