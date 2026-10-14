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
import { LiveScene } from '@/components/landing/LiveScene';
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
        { key: 'demo_bar', href: 'https://demo-bar.sellqo.shop/' },
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
    demo: {
      links: [
        { key: 'demo_seats', href: 'https://demo-concertzaal.sellqo.shop/producten/brussels-string-quartet' },
        { key: 'demo_festival', href: 'https://demo-festival.sellqo.shop/' },
        { key: 'demo_live', href: 'https://fonskecrawl.com/' },
      ],
    },
  },
};

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
        <LandingNavbar tone="dark" />
        <main>
          {/* Hero — zelfde donkere toon en scène als de homepage, vast op deze sector. */}
          <section className="relative overflow-hidden bg-[#13294a] pb-16 pt-[calc(6rem+var(--safe-top))] text-white md:pb-24 md:pt-32">
            <div className="pointer-events-none absolute -right-40 top-10 h-[620px] w-[620px] rounded-full bg-[#2b5a8f]/40 blur-3xl" aria-hidden="true" />
            <div className="container relative mx-auto grid items-center gap-12 px-4 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
              <div className="text-center lg:text-left">
                <p className="mb-5 text-sm font-semibold text-[#FF6B35]">{t(k('badge'))}</p>
                <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
                  {t(k('title1'))}
                  <br />
                  {t(k('title2'))}
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/75 md:text-xl lg:mx-0">{t(k('subtitle'))}</p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Link data-akke-goal="Start gratis" to={register}
                    className="inline-flex min-h-14 py-3 text-center items-center justify-center gap-2 rounded-lg bg-[#FF6B35] px-8 text-lg font-semibold text-white shadow-lg hover:bg-[#f15d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                    {t('landing.sector.common.cta_start')}<ArrowRight className="h-5 w-5" />
                  </Link>
                  <a href={cfg.demo.links[0].href} target="_blank" rel="noreferrer"
                    className="inline-flex min-h-14 py-3 text-center items-center justify-center gap-2 rounded-lg border-2 border-white/30 px-7 text-lg font-semibold text-white hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                    {t(k(cfg.demo.links[0].key))}<ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/65 lg:justify-start">
                  {['trust1', 'trust2', 'trust3'].map((tk) => (
                    <li key={tk} className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-emerald-400" />{t(k(tk))}</li>
                  ))}
                </ul>
              </div>
              <div>
                <LiveScene sector={sector} />
                <p className="mx-auto mt-6 max-w-[520px] text-center text-sm text-white/70">{t(`landing.scene.${sector}.caption`)}</p>
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
              <Link to="/voorbeelden" className="mt-6 inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
                {t('landing.sector.common.demo_all')}<ArrowRight className="h-4 w-4" />
              </Link>
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
