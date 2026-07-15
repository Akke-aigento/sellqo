import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Target, Users, Zap, Heart, Globe, Shield, ShoppingBag, Building2, Rocket, Award, MapPin, FileCheck, Sparkles } from 'lucide-react';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';

const statKeys = [
  { icon: MapPin, key: 'belgian' },
  { icon: Globe, key: 'languages' },
  { icon: FileCheck, key: 'peppol' },
  { icon: Sparkles, key: 'ai' },
] as const;

const timelineKeys = [
  { key: 'q1_2024', icon: Rocket },
  { key: 'q3_2024', icon: Users },
  { key: 'q4_2024', icon: ShoppingBag },
  { key: 'q1_2025', icon: Award },
] as const;

const valueKeys = [
  { key: 'simplicity', icon: Target },
  { key: 'entrepreneurs', icon: Users },
  { key: 'innovation', icon: Zap },
  { key: 'belgian', icon: Heart },
  { key: 'global', icon: Globe },
  { key: 'privacy', icon: Shield },
] as const;

const pressLogos = [
  { name: 'De Tijd', placeholder: 'DE TIJD' },
  { name: 'Tweakers', placeholder: 'TWEAKERS' },
  { name: 'Sprout', placeholder: 'SPROUT' },
  { name: 'Emerce', placeholder: 'EMERCE' },
];

export default function About() {
  const { t } = useTranslation();
  return (
    <>
    <PageMeta
      title={t('public.about.meta.title')}
      description={t('public.about.meta.description')}
      path="/about"
    />
    <PublicPageLayout 
      title={t('public.about.title')}
      subtitle={t('public.about.subtitle')}
    >
      {/* Mission Section */}
      <section className="max-w-4xl mx-auto mb-16">
        <div className="bg-card rounded-2xl border border-border p-8 md:p-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">{t('public.about.mission.title')}</h2>
          <p className="text-lg text-muted-foreground mb-6">{t('public.about.mission.p1')}</p>
          <p className="text-muted-foreground">{t('public.about.mission.p2')}</p>
          <p className="text-muted-foreground mt-4 pt-4 border-t border-border text-sm">
            <span className="font-medium text-foreground">Legal entity:</span> SellQo is a SaaS product
            developed and operated by <span className="font-medium text-foreground">Nomadix BV</span>,
            a Belgian company registered under VAT/company number BE 1017.500.207, with registered
            office at Beekstraat 49, 3051 Oud-Heverlee, Belgium. Contact:{' '}
            <a href="mailto:info@sellqo.app" className="text-accent hover:underline">info@sellqo.app</a>.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-5xl mx-auto mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {statKeys.map((stat, index) => (
            <div 
              key={index}
              className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-xl border border-accent/30 p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-3">
                <stat.icon className="w-6 h-6 text-accent" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground mb-1">{t(`public.about.stats.${stat.key}.value`)}</p>
              <p className="text-sm text-muted-foreground">{t(`public.about.stats.${stat.key}.label`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline Section */}
      <section className="max-w-4xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">{t('public.about.timeline.title')}</h2>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 md:left-1/2 md:-translate-x-0.5 top-0 bottom-0 w-0.5 bg-border" />
          
          {timelineKeys.map((item, index) => (
            <div 
              key={index}
              className={`relative flex items-start gap-6 mb-8 ${
                index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              }`}
            >
              {/* Timeline dot */}
              <div className="absolute left-4 md:left-1/2 md:-translate-x-1/2 w-8 h-8 rounded-full bg-accent flex items-center justify-center z-10">
                <item.icon className="w-4 h-4 text-accent-foreground" />
              </div>
              
              {/* Content */}
              <div className={`ml-16 md:ml-0 md:w-[calc(50%-2rem)] ${
                index % 2 === 0 ? 'md:pr-8 md:text-right' : 'md:pl-8'
              }`}>
                <span className="text-sm font-medium text-accent">{t(`public.about.timeline.items.${item.key}.date`)}</span>
                <h3 className="text-lg font-semibold text-foreground mt-1">{t(`public.about.timeline.items.${item.key}.title`)}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t(`public.about.timeline.items.${item.key}.description`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Values Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">{t('public.about.values.title')}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {valueKeys.map((value, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <value.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t(`public.about.values.items.${value.key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`public.about.values.items.${value.key}.description`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">{t('public.about.team.title')}</h2>
        <div className="max-w-2xl mx-auto bg-card rounded-2xl border border-border p-8 text-center">
          <div className="w-14 h-14 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-accent" />
          </div>
          <p
            className="text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: t('public.about.team.description') }}
          />
        </div>
      </section>

      {/* Press/Featured Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">{t('public.about.press.title')}</h2>
        <p className="text-center text-muted-foreground mb-8">{t('public.about.press.subtitle')}</p>
        <div className="flex flex-wrap justify-center gap-6 max-w-3xl mx-auto">
          {pressLogos.map((press, index) => (
            <div 
              key={index}
              className="bg-secondary/50 rounded-lg px-8 py-4 text-muted-foreground font-bold text-lg tracking-wider opacity-60 hover:opacity-100 transition-opacity"
            >
              {press.placeholder}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">{t('public.about.cta.title')}</h2>
        <p className="text-muted-foreground mb-6">{t('public.about.cta.description')}</p>
        <Button asChild size="lg">
          <Link to="/auth?mode=register">{t('public.about.cta.button')}</Link>
        </Button>
      </section>
    </PublicPageLayout>
    </>
  );
}
