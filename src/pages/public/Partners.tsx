import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { TrendingUp, Briefcase, HeartHandshake, Sparkles, MessageSquare, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const partnerTypeKeys = [
  { key: 'agencies', icon: Briefcase },
  { key: 'freelancers', icon: TrendingUp },
  { key: 'integrators', icon: HeartHandshake },
] as const;

export default function Partners() {
  const { t } = useTranslation();
  const benefits = t('public.partners.benefits', { returnObjects: true }) as string[];
  return (
    <PublicPageLayout 
      title={t('public.partners.title')}
      subtitle={t('public.partners.subtitle')}
    >
      {/* Intro */}
      <section className="max-w-3xl mx-auto text-center mb-12">
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-6">
          <Sparkles className="w-8 h-8 text-accent mx-auto mb-3" />
          <p className="text-foreground">{t('public.partners.intro')}</p>
        </div>
      </section>

      {/* Partner Types */}
      <section className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">{t('public.partners.sectionTitle')}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {partnerTypeKeys.map((type, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <type.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t(`public.partners.types.${type.key}.title`)}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t(`public.partners.types.${type.key}.description`)}</p>
              <ul className="space-y-2">
                {benefits.map((benefit, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center max-w-2xl mx-auto">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-6 h-6 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-4">{t('public.partners.ctaTitle')}</h2>
        <p className="text-muted-foreground mb-6">{t('public.partners.ctaText')}</p>
        <Button asChild variant="outline" size="lg">
          <Link to="/contact">{t('public.partners.ctaButton')}</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}
