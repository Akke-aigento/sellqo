import { Link } from 'react-router-dom';
import { ArrowRight, Check, ExternalLink, ShoppingBag, UtensilsCrossed, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const DEMO_HOST = 'demo-webshop.sellqo.shop';

export function HeroSection() {
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.1 });
  const { t } = useTranslation();

  const trustBadges = [
    { icon: Check, text: t('landing.hero.trust.noCard') },
    { icon: Check, text: t('landing.hero.trust.trial') },
    { icon: Check, text: t('landing.hero.trust.setup') },
    { icon: Check, text: t('landing.hero.trust.support') },
  ];


  return (
    <section className="relative pt-[calc(6rem+var(--safe-top))] md:pt-32 pb-16 md:pb-24 overflow-hidden">
      {/* Background gradient - enhanced navy to lighter blue */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10 -z-10" />
      
      {/* Abstract shapes - stronger */}
      <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10" />

      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'grid lg:grid-cols-2 gap-12 lg:gap-16 items-center',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          {/* Left column - Text content */}
          <div className="text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-tight mb-6">
              <span className="gradient-text">{t('landing.hero.title1')}</span>
              <br />
              <span className="text-foreground">{t('landing.hero.title2')}</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>

            {/* MKT-1 — twee deuren: wat verkoop je? */}
            <div className="mb-8">
              <p className="mb-3 text-sm font-medium text-foreground/70">{t('landing.hero.doors.label')}</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-xl mx-auto lg:mx-0">
                {[
                  { to: '#features', icon: ShoppingBag, key: 'retail' },
                  { to: '/horeca', icon: UtensilsCrossed, key: 'horeca' },
                  { to: '/events', icon: Ticket, key: 'events' },
                ].map(({ to, icon: Icon, key }) => {
                  const inner = (
                    <>
                      <Icon className="h-5 w-5 text-accent" />
                      <span className="text-sm font-semibold text-foreground">{t(`landing.hero.doors.${key}`)}</span>
                      <span className="hidden text-xs text-muted-foreground sm:block">{t(`landing.hero.doors.${key}_hint`)}</span>
                    </>
                  );
                  const cls = 'flex flex-col items-center gap-1 rounded-xl border bg-card/80 p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md lg:items-start lg:text-left';
                  return to.startsWith('#') ? (
                    <button key={key} type="button" className={cls} onClick={() => document.querySelector(to)?.scrollIntoView({ behavior: 'smooth' })}>{inner}</button>
                  ) : (
                    <Link key={key} to={to} className={cls}>{inner}</Link>
                  );
                })}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
              <Button
                size="lg"
                asChild
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-4 px-8 h-auto min-h-[44px] shadow-lg hover:shadow-xl hover:brightness-110 transition-all rounded-lg"
              >
                <Link data-akke-goal="Start gratis" to="/auth?mode=register" className="flex items-center gap-2">
                  {t('landing.hero.ctaPrimary')}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="text-lg py-4 px-8 h-auto min-h-[44px] border-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all rounded-lg"
              >
                <a href={`https://${DEMO_HOST}/`} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  {t('landing.hero.ctaSecondary')}
                </a>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2">
              {trustBadges.map((badge, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <badge.icon className="w-4 h-4 text-green-500" />
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MKT-2 — rechts geen nagemaakt dashboard maar een echte winkel op SellQo. */}
          <div className="relative mx-auto w-full max-w-[640px]">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" aria-hidden="true" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" aria-hidden="true" />
                <span className="ml-3 flex-1 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">{DEMO_HOST}</span>
              </div>
              <iframe src={`https://${DEMO_HOST}/`} title={t('landing.hero.demo_title')} loading="lazy" className="block h-[420px] w-full bg-white md:h-[520px]" />
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">{t('landing.hero.demo_caption')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
