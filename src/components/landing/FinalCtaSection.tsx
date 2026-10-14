// MKT-3 — slot: dezelfde donkere toon als de hero, zodat de pagina opent en sluit
// met dezelfde stem.
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function FinalCtaSection() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden bg-[#13294a] py-20 text-white md:py-28">
      <div className="pointer-events-none absolute -left-40 -top-24 h-[480px] w-[480px] rounded-full bg-[#2b5a8f]/40 blur-3xl" aria-hidden="true" />
      <div className="container relative mx-auto max-w-4xl px-4">
        <h2 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">{t('landing.finalCta.heading')}</h2>
        <p className="mt-5 max-w-2xl text-lg text-white/75 md:text-xl">{t('landing.finalCta.subheading')}</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link data-akke-goal="Start gratis" to="/auth?mode=register"
            className="inline-flex min-h-14 py-3 text-center items-center justify-center gap-2 rounded-lg bg-[#FF6B35] px-8 text-lg font-semibold text-white shadow-lg hover:bg-[#f15d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {t('landing.finalCta.cta')}<ArrowRight className="h-5 w-5" />
          </Link>
          <Link to="/pricing"
            className="inline-flex min-h-14 py-3 text-center items-center justify-center rounded-lg border-2 border-white/30 px-7 text-lg font-semibold text-white hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {t('landing.finalCta.cta_pricing')}
          </Link>
        </div>
        <p className="mt-6 text-sm text-white/60">{t('landing.finalCta.trust')}</p>
      </div>
    </section>
  );
}
