// MKT-1 — sectorpagina's op sellqo.app: /horeca en /events.
// Eén kern (webshop, kassa, bestellingen), per sector een eigen verhaal. Bewijs is altijd
// echt: een live demowinkel of een echte zaak die op SellQo draait, nooit verzonnen cijfers.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeEuro, Bike, CalendarDays, ChefHat, CircleCheck, Clock, CreditCard, ExternalLink,
  Globe, Mail, PauseCircle, QrCode, ScanLine, ShieldCheck, Ticket, Users, Wheat, type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { ForcedLightMode } from '@/components/ForcedLightMode';
import { PageMeta } from '@/components/seo/PageMeta';
import { PricingSection } from '@/components/landing/PricingSection';
import { SIGNUP_SECTOR_KEY } from '@/lib/signupSector';

type Sector = 'horeca' | 'events';

interface SectorConfig {
  path: string;
  /** Plan dat bij deze sector hoort; getoond zodra het actief is in pricing_plans. */
  planId?: string;
  features: { key: string; icon: LucideIcon }[];
  steps: string[];
  faq: string[];
  /** Live voorbeeld: in een telefoonkader (iframe) of als link. */
  demo: { frame?: string; links: { key: string; href: string }[] };
}

const CONFIG: Record<Sector, SectorConfig> = {
  horeca: {
    path: '/horeca',
    planId: 'horeca',
    features: [
      { key: 'site', icon: Globe },
      { key: 'pickup', icon: Bike },
      { key: 'qr', icon: QrCode },
      { key: 'kitchen', icon: ChefHat },
      { key: 'pos', icon: CreditCard },
      { key: 'allergens', icon: Wheat },
      { key: 'pause', icon: PauseCircle },
      { key: 'pay', icon: BadgeEuro },
    ],
    steps: ['s1', 's2', 's3'],
    faq: ['q1', 'q2', 'q3', 'q4', 'q5'],
    demo: {
      frame: 'https://demo-pizzeria.sellqo.shop/',
      links: [
        { key: 'demo_online', href: 'https://demo-pizzeria.sellqo.shop/' },
        { key: 'demo_table', href: 'https://demo-pizzeria.sellqo.shop/menu?tafel=4' },
      ],
    },
  },
  events: {
    path: '/events',
    features: [
      { key: 'dates', icon: CalendarDays },
      { key: 'types', icon: Ticket },
      { key: 'capacity', icon: Users },
      { key: 'mail', icon: Mail },
      { key: 'scan', icon: ScanLine },
      { key: 'crew', icon: ShieldCheck },
      { key: 'overview', icon: Clock },
      { key: 'pay', icon: BadgeEuro },
    ],
    steps: ['s1', 's2', 's3'],
    faq: ['q1', 'q2', 'q3', 'q4'],
    demo: { links: [{ key: 'demo_live', href: 'https://fonskecrawl.com/' }] },
  },
};

function PhoneFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="relative mx-auto w-[300px] max-w-full rounded-[2.5rem] border-[10px] border-foreground/90 bg-foreground/90 shadow-2xl">
      <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-foreground/90" />
      <iframe src={src} title={title} loading="lazy" className="h-[580px] w-full rounded-[1.9rem] bg-white" />
    </div>
  );
}

export function SectorLanding({ sector }: { sector: Sector }) {
  const { t } = useTranslation();
  const cfg = CONFIG[sector];
  const k = (key: string) => `landing.sector.${sector}.${key}`;
  const register = '/auth?mode=register';
  // Interesse onthouden: de onboarding selecteert deze sector dan al voor.
  useEffect(() => { try { localStorage.setItem(SIGNUP_SECTOR_KEY, sector); } catch { /* geen opslag */ } }, [sector]);

  return (
    <ForcedLightMode>
      <PageMeta title={t(k('meta_title'))} description={t(k('meta_desc'))} path={cfg.path} />
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main>
          {/* Hero */}
          <section className="relative overflow-hidden pb-16 pt-[calc(6rem+var(--safe-top))] md:pb-24 md:pt-32">
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
            <div className="container mx-auto grid items-center gap-12 px-4 lg:grid-cols-[1.15fr_1fr]">
              <div className="text-center lg:text-left">
                <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                  {t(k('badge'))}
                </span>
                <h1 className="mb-6 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                  <span className="gradient-text">{t(k('title1'))}</span>
                  <br />
                  <span className="text-foreground">{t(k('title2'))}</span>
                </h1>
                <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl lg:mx-0">{t(k('subtitle'))}</p>
                <div className="mb-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Button size="lg" asChild className="h-auto min-h-[44px] rounded-lg bg-accent px-8 py-4 text-lg text-accent-foreground shadow-lg hover:bg-accent/90">
                    <Link data-akke-goal="Start gratis" to={register} className="flex items-center gap-2">{t('landing.sector.common.cta_start')}<ArrowRight className="h-5 w-5" /></Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="h-auto min-h-[44px] rounded-lg border-2 px-8 py-4 text-lg">
                    <a href={cfg.demo.links[0].href} target="_blank" rel="noreferrer" className="flex items-center gap-2">{t(k(cfg.demo.links[0].key))}<ExternalLink className="h-4 w-4" /></a>
                  </Button>
                </div>
                <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                  {['trust1', 'trust2', 'trust3'].map((tk) => (
                    <li key={tk} className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-green-600" />{t(k(tk))}</li>
                  ))}
                </ul>
              </div>
              <div>
                {cfg.demo.frame ? (
                  <>
                    <PhoneFrame src={cfg.demo.frame} title={t(k('demo_title'))} />
                    <p className="mt-4 text-center text-sm text-muted-foreground">{t(k('frame_caption'))}</p>
                  </>
                ) : (
                  <div className="rounded-2xl border bg-card p-8 shadow-lg">
                    <p className="text-sm font-semibold uppercase tracking-wide text-accent">{t(k('proof_label'))}</p>
                    <p className="mt-3 text-2xl font-bold">{t(k('proof_title'))}</p>
                    <p className="mt-3 text-muted-foreground">{t(k('proof_text'))}</p>
                    <a href={cfg.demo.links[0].href} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                      {t(k(cfg.demo.links[0].key))}<ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Waarom */}
          <section className="bg-secondary/30 py-16 md:py-20">
            <div className="container mx-auto max-w-4xl px-4 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">{t(k('why_title'))}</h2>
              <p className="text-lg leading-relaxed text-muted-foreground">{t(k('why_text'))}</p>
            </div>
          </section>

          {/* Functies */}
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
              <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">{t(k('features_title'))}</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {cfg.features.map(({ key, icon: Icon }) => (
                  <div key={key} className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div>
                    <h3 className="mb-2 font-semibold">{t(k(`f_${key}`))}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t(k(`f_${key}_text`))}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Zo werkt het */}
          <section className="bg-secondary/30 py-16 md:py-24">
            <div className="container mx-auto px-4">
              <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">{t('landing.sector.common.how_title')}</h2>
              <ol className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
                {cfg.steps.map((s, i) => (
                  <li key={s} className="text-center">
                    <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{i + 1}</span>
                    <h3 className="mb-2 font-semibold">{t(k(`${s}_title`))}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t(k(`${s}_text`))}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Probeer het zelf */}
          <section className="py-16 md:py-20">
            <div className="container mx-auto max-w-3xl px-4 text-center">
              <h2 className="mb-4 text-3xl font-bold">{t(k('demo_title'))}</h2>
              <p className="mb-8 text-muted-foreground">{t(k('demo_text'))}</p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                {cfg.demo.links.map((l) => (
                  <Button key={l.key} variant="outline" size="lg" asChild className="border-2">
                    <a href={l.href} target="_blank" rel="noreferrer" className="flex items-center gap-2">{t(k(l.key))}<ExternalLink className="h-4 w-4" /></a>
                  </Button>
                ))}
              </div>
            </div>
          </section>

          {/* PRICE-2 — dezelfde prijzen als overal, met het tabblad van deze sector open. */}
          <PricingSection initialTab={sector} />

          {/* FAQ */}
          <section className="py-16 md:py-24">
            <div className="container mx-auto max-w-3xl px-4">
              <h2 className="mb-8 text-center text-3xl font-bold md:text-4xl">{t('landing.faq.heading')}</h2>
              <Accordion type="single" collapsible className="space-y-3">
                {cfg.faq.map((q) => (
                  <AccordionItem key={q} value={q} className="rounded-lg border bg-card px-4">
                    <AccordionTrigger className="text-left font-medium">{t(k(`${q}`))}</AccordionTrigger>
                    <AccordionContent className="leading-relaxed text-muted-foreground">{t(k(`${q}_a`))}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          {/* Slot */}
          <section className="bg-gradient-to-br from-primary to-primary/90 py-16 text-primary-foreground md:py-20">
            <div className="container mx-auto max-w-3xl px-4 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">{t(k('final_title'))}</h2>
              <p className="mb-8 text-lg opacity-90">{t('landing.sector.common.final_text')}</p>
              <Button size="lg" asChild className="h-auto min-h-[44px] rounded-lg bg-accent px-8 py-4 text-lg text-accent-foreground hover:bg-accent/90">
                <Link data-akke-goal="Start gratis" to={register} className="flex items-center gap-2">{t('landing.sector.common.cta_start')}<ArrowRight className="h-5 w-5" /></Link>
              </Button>
            </div>
          </section>
        </main>
        <LandingFooter />
      </div>
    </ForcedLightMode>
  );
}

export function HorecaPage() { return <SectorLanding sector="horeca" />; }
export function EventsPage() { return <SectorLanding sector="events" />; }
export default HorecaPage;
