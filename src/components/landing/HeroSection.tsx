// MKT-3 — hero: wie je bent kies je zelf (producten, horeca, events), en de scène ernaast
// toont meteen wat SellQo voor jou doet. Draait vanzelf door de drie soorten zaken tot
// de bezoeker zelf kiest.
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ExternalLink, ShoppingBag, Ticket, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { LiveScene, type SceneSector } from './LiveScene';

const SECTORS: { id: SceneSector; icon: LucideIcon; demo: string; more?: string }[] = [
  { id: 'retail', icon: ShoppingBag, demo: 'https://demo-webshop.sellqo.shop/' },
  { id: 'horeca', icon: UtensilsCrossed, demo: 'https://demo-pizzeria.sellqo.shop/', more: '/horeca' },
  { id: 'events', icon: Ticket, demo: 'https://fonskecrawl.com/', more: '/events' },
];

export function HeroSection() {
  const { t } = useTranslation();
  const [sector, setSector] = useState<SceneSector>('retail');
  const [chosen, setChosen] = useState(false);
  const [hover, setHover] = useState(false);
  const current = SECTORS.find((s) => s.id === sector)!;

  // Na elke ronde naar de volgende zaak, zolang de bezoeker nog niets koos.
  const next = useCallback(() => {
    if (chosen) return;
    setSector((s) => SECTORS[(SECTORS.findIndex((x) => x.id === s) + 1) % SECTORS.length].id);
  }, [chosen]);

  return (
    <section className="relative overflow-hidden bg-[#13294a] pb-16 pt-[calc(6rem+var(--safe-top))] text-white md:pb-24 md:pt-32">
      {/* Diepte zonder decoratie: een zachte gloed achter de scène */}
      <div className="pointer-events-none absolute -right-40 top-10 h-[620px] w-[620px] rounded-full bg-[#2b5a8f]/40 blur-3xl" aria-hidden="true" />
      <div className="container relative mx-auto grid items-center gap-12 px-4 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div className="text-center lg:text-left">
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
            {t('landing.hero.title1')}
            <br />
            {t('landing.hero.title2')}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/75 md:text-xl lg:mx-0">{t('landing.hero.subtitle')}</p>

          <div className="mt-8">
            <p id="hero-sector" className="mb-3 text-sm font-medium text-white/60">{t('landing.hero.doors.label')}</p>
            <div role="tablist" aria-labelledby="hero-sector" className="mx-auto grid max-w-xl grid-cols-3 gap-2 lg:mx-0">
              {SECTORS.map(({ id, icon: Icon }) => {
                const on = sector === id;
                return (
                  <button key={id} type="button" role="tab" aria-selected={on}
                    onClick={() => { setSector(id); setChosen(true); }}
                    className={cn('flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] lg:items-start lg:text-left',
                      on ? 'border-[#FF6B35] bg-white/10' : 'border-white/15 hover:border-white/40')}>
                    <Icon className={cn('h-5 w-5', on ? 'text-[#FF6B35]' : 'text-white/70')} aria-hidden="true" />
                    <span className="text-sm font-semibold">{t(`landing.hero.doors.${id}`)}</span>
                    <span className="hidden text-xs text-white/55 sm:block">{t(`landing.hero.doors.${id}_hint`)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link data-akke-goal="Start gratis" to="/auth?mode=register"
              className="inline-flex min-h-14 py-3 text-center items-center justify-center gap-2 rounded-lg bg-[#FF6B35] px-8 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-[#f15d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              {t('landing.hero.ctaPrimary')}<ArrowRight className="h-5 w-5" />
            </Link>
            <a href={current.demo} target="_blank" rel="noreferrer"
              className="inline-flex min-h-14 py-3 text-center items-center justify-center gap-2 rounded-lg border-2 border-white/30 px-7 text-lg font-semibold text-white transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              {t(`landing.hero.demo_${sector}`)}<ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/65 lg:justify-start">
            {['noCard', 'trial', 'support'].map((k) => (
              <li key={k} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />{t(`landing.hero.trust.${k}`)}</li>
            ))}
          </ul>
        </div>

        <div className="min-w-0" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          <LiveScene sector={sector} paused={hover} onLoopEnd={next} />
          <p className="mx-auto mt-6 max-w-[520px] text-center text-sm text-white/70" aria-live="polite">
            {t(`landing.scene.${sector}.caption`)}
            {current.more ? <> <Link to={current.more} className="font-semibold text-white underline-offset-4 hover:underline">{t(`landing.scene.${sector}.more`)}</Link></> : null}
          </p>
        </div>
      </div>
    </section>
  );
}
