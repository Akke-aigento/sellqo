// SHOWCASE-1 — /voorbeelden: alle publieke demowinkels als etalage. Elke tegel draagt de
// kleuren en het titellettertype van het thema van die winkel, zodat de pagina meteen ook
// toont hoe verschillend een SellQo-winkel kan ogen. Alles hier is echt en live:
// bestellen kan, er wordt niets aangerekend, en de demo's worden elke nacht teruggezet.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, ExternalLink, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { ForcedLightMode } from '@/components/ForcedLightMode';
import { PageMeta } from '@/components/seo/PageMeta';
import { cn } from '@/lib/utils';

type Sector = 'shop' | 'horeca' | 'events';

interface Demo {
  slug: string;
  name: string;
  sector: Sector;
  /** themapreset (naam vertaald via landing.examples.theme_*) */
  theme: string;
  bg: string;
  text: string;
  accent: string;
  font: string;
  /** pad in de ai-images-bucket */
  image: string;
  /** tweede knop: pad in de winkel + vertaalkey */
  extra?: { path: string; key: string };
}

const IMG = 'https://gczmfcabnoofnmfpzeop.supabase.co/storage/v1/render/image/public/ai-images/';

const DEMOS: Demo[] = [
  { slug: 'demo-concertzaal', name: 'Zaal De Linde', sector: 'events', theme: 'concertzaal', bg: '#14110f', text: '#f3ede4', accent: '#c9a227', font: 'Playfair Display', image: '3c8915ea-dea9-49b9-b7e5-871fcc2a19e0/nano/399c2462-83ff-403d-9752-20e589d81ed5.jpg', extra: { path: '/producten/brussels-string-quartet', key: 'extra_seats' } },
  { slug: 'demo-bar', name: 'Café De Wissel', sector: 'horeca', theme: 'bar', bg: '#12100c', text: '#f1e7d3', accent: '#e0a526', font: 'Bricolage Grotesque', image: 'dfa62de5-23b6-5deb-8772-f5d91ff06284/nano/3792df14-b1cb-4677-853f-504e57b38591.jpg', extra: { path: '/menu?tafel=4', key: 'extra_table' } },
  { slug: 'demo-kleding', name: 'Maison Lune', sector: 'shop', theme: 'kleding', bg: '#ffffff', text: '#111111', accent: '#111111', font: 'Space Grotesk', image: '801c9a93-04b1-56cc-bf46-1a3387062aec/nano/858cfa9d-3f82-4ef1-95b0-3ae1f498cae5.jpg' },
  { slug: 'demo-restaurant', name: 'Bistro Mirabelle', sector: 'horeca', theme: 'bistro', bg: '#f7f1e6', text: '#1f2a24', accent: '#2f5d46', font: 'Playfair Display', image: '22d87175-d697-5ee0-af73-a7f4ce087952/nano/2e4d76fc-434a-4bdc-8f1d-871741724d42.jpg', extra: { path: '/menu?tafel=4', key: 'extra_table' } },
  { slug: 'demo-tech', name: 'Voltaro', sector: 'shop', theme: 'tech', bg: '#0b0f17', text: '#e6edf6', accent: '#22d3ee', font: 'Space Grotesk', image: 'cb495693-afce-5116-9e77-8ccd038b2524/nano/492b3f9f-c019-48b7-9bd4-015bb4d6ef17.jpg' },
  { slug: 'demo-festival', name: 'Zomerfest Leuven', sector: 'events', theme: 'festival', bg: '#fff6ea', text: '#1d1033', accent: '#ff4f1f', font: 'Bricolage Grotesque', image: 'c1bde589-b846-4e17-98b5-49515d4ea953/nano/11f9c075-68e4-4785-b26d-dc09b52fd824.jpg', extra: { path: '/producten/zomerfest-2027', key: 'extra_days' } },
  { slug: 'demo-pizzeria', name: 'Pizzeria Fiamma', sector: 'horeca', theme: 'restaurant', bg: '#fffaf3', text: '#2a1a12', accent: '#b3261e', font: 'Poppins', image: '7879b472-2672-4212-8531-4c587870752d/nano/bff1485c-69c1-4e46-a661-2f0ea6736b1d.jpg', extra: { path: '/menu?tafel=4', key: 'extra_table' } },
  { slug: 'demo-beauty', name: 'Bloom & Balm', sector: 'shop', theme: 'beauty', bg: '#fbf3ef', text: '#3b2a2c', accent: '#c06c84', font: 'Playfair Display', image: '8c4ffd3a-a4d7-50ee-8d27-72fe909bf5cb/nano/7dda4a8c-bd4c-4297-8f5a-91088cfdd281.jpg' },
  { slug: 'demo-wijn', name: 'Vinotheek Lemmens', sector: 'shop', theme: 'wijn', bg: '#faf6f1', text: '#2a1418', accent: '#7a2334', font: 'Merriweather', image: '0c247ff0-b39a-53fd-b6ee-edace276cbf6/nano/49fc22ac-2210-45e3-9dd1-d1abe6e90708.jpg' },
  { slug: 'demo-koffie', name: 'Koffiebranderij Mokka', sector: 'shop', theme: 'koffie', bg: '#f4ede4', text: '#2b1d14', accent: '#b5651d', font: 'Bricolage Grotesque', image: '3f45003a-6fa1-575e-97fb-f7792badf2a7/nano/ee863a2b-cc38-49eb-9144-6f2f3c67fefe.jpg' },
  { slug: 'demo-webshop', name: 'Atelier Nord', sector: 'shop', theme: 'bloemen', bg: '#fbf7f4', text: '#2b2024', accent: '#3d5a4c', font: 'Playfair Display', image: '0e06e256-308a-4903-8b27-64959418a9ad/nano/efa47a94-610d-4678-9a43-9fdc311e2b45.jpg' },
];

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700&family=Merriweather:wght@700&family=Playfair+Display:wght@700&family=Poppins:wght@700&family=Space+Grotesk:wght@700&display=swap';
const FILTERS: ('all' | Sector)[] = ['all', 'shop', 'horeca', 'events'];
const shopUrl = (slug: string, path = '/') => `https://${slug}.sellqo.shop${path}`;
const imgUrl = (path: string, width: number) => `${IMG}${path}?width=${width}&quality=70`;

export default function Examples() {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`landing.examples.${x}`, o);
  const [filter, setFilter] = useState<'all' | Sector>('all');
  const shown = useMemo(() => DEMOS.filter((d) => filter === 'all' || d.sector === filter), [filter]);

  return (
    <ForcedLightMode>
      <PageMeta title={k('meta_title')} description={k('meta_desc')} path="/voorbeelden" image={imgUrl(DEMOS[0].image, 1200)} />
      <Helmet>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_HREF} />
      </Helmet>
      <div className="min-h-screen bg-background">
        <LandingNavbar tone="dark" />
        <main>
          <section className="relative overflow-hidden bg-[#13294a] pb-14 pt-[calc(6rem+var(--safe-top))] text-white md:pb-20 md:pt-32">
            <div className="pointer-events-none absolute -left-40 -top-20 h-[520px] w-[520px] rounded-full bg-[#2b5a8f]/40 blur-3xl" aria-hidden="true" />
            <div className="container relative mx-auto px-4">
              <div className="max-w-3xl">
                <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{k('title')}</h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75 md:text-xl">{k('subtitle')}</p>
              </div>
              <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label={k('filter_label')}>
                {FILTERS.map((f) => {
                  const n = f === 'all' ? DEMOS.length : DEMOS.filter((d) => d.sector === f).length;
                  return (
                    <button
                      key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
                      className={cn(
                        'min-h-11 rounded-full border-2 px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                        filter === f ? 'border-[#FF6B35] bg-[#FF6B35] text-white' : 'border-white/25 text-white/85 hover:border-white',
                      )}
                    >
                      {k(`filter_${f}`)} <span className="ml-1 opacity-70">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="bg-[#eef1f5] py-12 md:py-16" aria-live="polite">
            <ul className="container mx-auto grid list-none gap-6 px-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((d, i) => (
                <li
                  key={d.slug}
                  className={cn('group flex flex-col overflow-hidden rounded-2xl shadow-[0_1px_0_rgba(19,41,74,0.08)] ring-1 ring-black/5', i === 0 && filter === 'all' && 'lg:col-span-2')}
                  style={{ background: d.bg, color: d.text }}
                >
                  <a href={shopUrl(d.slug)} target="_blank" rel="noreferrer" className="relative block overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset" style={{ ['--tw-ring-color' as string]: d.accent }} tabIndex={-1} aria-hidden="true">
                    <img
                      src={imgUrl(d.image, i === 0 && filter === 'all' ? 1200 : 720)} alt="" loading={i < 3 ? 'eager' : 'lazy'} decoding="async"
                      className={cn('w-full object-cover', i === 0 && filter === 'all' ? 'aspect-[4/3] lg:aspect-[16/8]' : 'aspect-[4/3]')}
                    />
                    <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: d.bg, color: d.text }}>
                      {k(`sector_${d.sector}`)}
                    </span>
                  </a>
                  <div className="flex flex-1 flex-col gap-3 p-6">
                    <h2 className="text-2xl font-bold leading-tight sm:text-[1.7rem]" style={{ fontFamily: `'${d.font}', ui-serif, Georgia, serif` }}>{d.name}</h2>
                    <p className="max-w-prose text-[0.95rem] leading-relaxed" style={{ opacity: 0.82 }}>{k(`try_${d.slug.replace('demo-', '')}`)}</p>
                    <p className="text-sm" style={{ opacity: 0.6 }}>{k('theme_line', { theme: k(`theme_${d.theme}`) })}</p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-3">
                      <a
                        href={shopUrl(d.slug)} target="_blank" rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{ background: d.accent, color: contrastOn(d.accent) }}
                      >
                        {k('open_shop')}<ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                      {d.extra && (
                        <a
                          href={shopUrl(d.slug, d.extra.path)} target="_blank" rel="noreferrer"
                          className="inline-flex min-h-11 items-center gap-2 rounded-lg border-2 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          style={{ borderColor: `${d.text}33` }}
                        >
                          {k(d.extra.key)}
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="container mx-auto mt-8 px-4 text-sm text-muted-foreground">{k('note')}</p>
          </section>

          <section className="py-16 md:py-24">
            <div className="container mx-auto grid max-w-5xl items-center gap-10 px-4 md:grid-cols-[1.3fr_1fr]">
              <div>
                <h2 className="text-3xl font-bold md:text-4xl">{k('own_title')}</h2>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{k('own_text')}</p>
                <Link to="/contact" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#13294a] px-6 font-semibold text-white hover:bg-[#1c3a66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />{k('own_cta')}
                </Link>
              </div>
              <ol className="space-y-4">
                {['own_s1', 'own_s2', 'own_s3'].map((s, i) => (
                  <li key={s} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6B35] font-bold text-white">{i + 1}</span>
                    <p className="pt-1.5 leading-relaxed">{k(s)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="bg-[#13294a] py-16 text-white md:py-20">
            <div className="container mx-auto max-w-3xl px-4 text-center">
              <h2 className="text-3xl font-bold md:text-4xl">{k('final_title')}</h2>
              <p className="mt-4 text-lg text-white/75">{k('final_text')}</p>
              <Link data-akke-goal="Start gratis" to="/auth?mode=register"
                className="mt-8 inline-flex min-h-14 items-center gap-2 rounded-lg bg-[#FF6B35] px-8 text-lg font-semibold text-white hover:bg-[#f15d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                {t('landing.sector.common.cta_start')}<ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </main>
        <LandingFooter />
      </div>
    </ForcedLightMode>
  );
}

/** Wit of donker op de accentkleur, naar luminantie (WCAG). */
function contrastOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return (1.05) / (lum + 0.05) >= (lum + 0.05) / 0.05 ? '#ffffff' : '#111111';
}
